// Vortex live data.
// New tokens and migrations come from PumpPortal's free websocket.
// Prices, volume and buys/sells come from DexScreener's free API.
"use strict";

const PUMP_WS = "wss://pumpportal.fun/api/data";
const DEX = "https://api.dexscreener.com/tokens/v1/solana/";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const MAX_TOKENS = 300;
const K = 32.19; // pump.fun curve constant (30 SOL x 1.073B tokens, in billions)

// Vortex call rules (kept simple and shown on the calls page)
const CALL_RULES = { maxAgeMin: 30, minMcUsd: 15000, minBuys5m: 40, maxDevPct: 10 };

const feed = {
  tokens: new Map(),
  solUsd: store.get("solUsd", null),
  connected: false,
  calls: store.get("calls", []),
  listeners: new Set(),
  on(fn) { this.listeners.add(fn); },
  emit() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      wallet.checkOrders((m) => this.tokens.get(m));
      this.listeners.forEach((f) => f());
    });
  },
  get(mint) { return this.tokens.get(mint); },
};

// ---------- token helpers ----------
function progressFromMcSol(mcSol) {
  if (!(mcSol > 0)) return 0;
  const vSol = Math.sqrt(mcSol * K);
  return Math.max(0, Math.min(100, ((vSol - 30) / 85) * 100));
}
function column(t) {
  if (t.migrated) return "migrated";
  return t.progress >= 55 ? "stretch" : "new";
}
function upsert(mint, patch) {
  let t = feed.tokens.get(mint);
  if (!t) {
    t = { mint, symbol: "", name: "", image: "", created: Date.now(), src: "pump", progress: 0, migrated: false, socials: {}, lastDex: 0 };
    feed.tokens.set(mint, t);
  }
  Object.assign(t, patch);
  if (t.mcSol != null && !t.migrated) t.progress = progressFromMcSol(t.mcSol);
  if (t.migrated) t.progress = 100;
  return t;
}
function trim() {
  if (feed.tokens.size <= MAX_TOKENS) return;
  const list = [...feed.tokens.values()].sort((a, b) => a.created - b.created);
  const held = new Set(Object.keys(wallet.data?.positions || {}));
  for (const t of list) {
    if (feed.tokens.size <= MAX_TOKENS) break;
    if (!held.has(t.mint)) feed.tokens.delete(t.mint);
  }
}

// ---------- PumpPortal websocket ----------
let ws, retry = 1000;
function connect() {
  setStatus("Connecting…", false);
  try { ws = new WebSocket(PUMP_WS); } catch { return reconnect(); }
  ws.onopen = () => {
    retry = 1000; feed.connected = true; setStatus("Live feed", true);
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    ws.send(JSON.stringify({ method: "subscribeMigration" }));
  };
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.txType === "create" && m.mint) onCreate(m);
    else if (m.txType === "migrate" && m.mint) onMigrate(m);
  };
  ws.onclose = () => { feed.connected = false; reconnect(); };
  ws.onerror = () => ws.close();
}
function reconnect() {
  setStatus("Reconnecting…", false);
  setTimeout(connect, retry);
  retry = Math.min(retry * 2, 30000);
}
function onCreate(m) {
  const t = upsert(m.mint, {
    symbol: (m.symbol || "").slice(0, 16), name: (m.name || "").slice(0, 40), created: Date.now(),
    src: m.pool === "bonk" ? "bonk" : "pump", dev: m.traderPublicKey,
    devPct: m.initialBuy ? (m.initialBuy / 1e9) * 100 : 0,
    mcSol: m.marketCapSol, priceSol: m.marketCapSol ? m.marketCapSol / 1e9 : null, uri: m.uri, fresh: Date.now(),
  });
  if (feed.solUsd && t.mcSol) t.mcUsd = t.mcSol * feed.solUsd;
  metaQueue.push(t.mint);
  trim();
  feed.emit();
}
function onMigrate(m) {
  const known = feed.tokens.has(m.mint);
  upsert(m.mint, { migrated: true, migratedAt: Date.now(), fresh: Date.now(), ...(known ? {} : { created: Date.now() - 3600e3 }) });
  dexSoon.add(m.mint);
  feed.emit();
}

// ---------- token metadata (image + socials) from the token's IPFS file ----------
const metaQueue = [];
let metaBusy = 0;
setInterval(() => {
  while (metaBusy < 3 && metaQueue.length) {
    const t = feed.tokens.get(metaQueue.shift());
    if (!t || !t.uri || t.metaDone) continue;
    metaBusy++;
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 7000);
    fetch(t.uri, { signal: ctl.signal }).then((r) => r.json()).then((j) => {
      t.metaDone = true;
      if (j.image && !t.image) t.image = j.image;
      if (j.twitter) t.socials.x = j.twitter;
      if (j.telegram) t.socials.tg = j.telegram;
      if (j.website) t.socials.web = j.website;
      feed.emit();
    }).catch(() => { t.metaDone = true; }).finally(() => metaBusy--);
  }
}, 400);

// ---------- DexScreener prices ----------
const dexSoon = new Set();
async function pollDex() {
  const now = Date.now();
  const pick = [...dexSoon];
  dexSoon.clear();
  const candidates = [...feed.tokens.values()]
    .filter((t) => !pick.includes(t.mint) && now - t.created > 8000)
    .sort((a, b) => (a.lastDex - b.lastDex) || (b.created - a.created));
  for (const t of candidates) { if (pick.length >= 30) break; pick.push(t.mint); }
  if (!pick.length) return;
  pick.forEach((m) => { const t = feed.tokens.get(m); if (t) t.lastDex = now; });
  try {
    const r = await fetch(DEX + pick.join(","));
    if (!r.ok) throw new Error(r.status);
    const pairs = await r.json();
    const best = {};
    for (const p of pairs) {
      const mint = p.baseToken?.address;
      if (!pick.includes(mint)) continue;
      if (!best[mint] || (p.liquidity?.usd || 0) > (best[mint].liquidity?.usd || 0)) best[mint] = p;
    }
    for (const [mint, p] of Object.entries(best)) applyPair(mint, p);
    feed.emit();
  } catch { /* free API hiccup, try again next round */ }
}
function applyPair(mint, p) {
  const t = feed.tokens.get(mint);
  if (!t) return;
  const quoteSol = p.quoteToken?.address === SOL_MINT;
  const priceUsd = +p.priceUsd || null;
  const priceSol = quoteSol ? +p.priceNative : (priceUsd && feed.solUsd ? priceUsd / feed.solUsd : t.priceSol);
  const migrated = t.migrated || (p.dexId && p.dexId !== "pumpfun" && t.src === "pump" && t.mint.endsWith("pump"));
  upsert(mint, {
    symbol: t.symbol || p.baseToken.symbol, name: t.name || p.baseToken.name,
    image: t.image || p.info?.imageUrl || "", priceUsd, priceSol,
    mcUsd: p.marketCap || p.fdv || t.mcUsd, mcSol: priceSol ? priceSol * 1e9 : t.mcSol,
    vol5m: p.volume?.m5 ?? 0, vol1h: p.volume?.h1 ?? 0, buys5m: p.txns?.m5?.buys ?? 0, sells5m: p.txns?.m5?.sells ?? 0,
    liqUsd: p.liquidity?.usd ?? null, ch5m: p.priceChange?.m5 ?? null, ch1h: p.priceChange?.h1 ?? null,
    dexId: p.dexId, pairUrl: p.url, migrated, migratedAt: migrated && !t.migratedAt ? Date.now() : t.migratedAt,
  });
  for (const s of p.info?.socials || []) {
    if (s.type === "twitter") t.socials.x ||= s.url;
    if (s.type === "telegram") t.socials.tg ||= s.url;
  }
  if (p.info?.websites?.[0]) t.socials.web ||= p.info.websites[0].url;
  if (t.created && p.pairCreatedAt && p.pairCreatedAt < t.created) t.created = p.pairCreatedAt;
  checkCall(t);
}
// Jupiter's free price API knows brand-new tokens before DexScreener lists them
const JUP = "https://lite-api.jup.ag/price/v3?ids=";
async function pollJup() {
  const held = Object.keys(wallet.data?.positions || {});
  const ids = [...new Set([...held, ...[...feed.tokens.values()].filter((t) => !t.dexId && !t.migrated)
    .sort((a, b) => b.created - a.created).map((t) => t.mint)])].slice(0, 50);
  held.forEach((m) => { if (!feed.tokens.has(m)) { const p = wallet.data.positions[m]; upsert(m, { symbol: p.symbol, name: p.name, image: p.image, created: Date.now() - 3600e3 }); } });
  if (!ids.length) return;
  try {
    const r = await fetch(JUP + ids.join(","));
    if (!r.ok) return;
    const j = await r.json();
    for (const [mint, v] of Object.entries(j)) {
      const t = feed.tokens.get(mint);
      if (!t || !v?.usdPrice || (t.dexId && Date.now() - t.lastDex < 8000)) continue;
      const old = t.priceUsd;
      const priceSol = feed.solUsd ? v.usdPrice / feed.solUsd : t.priceSol;
      upsert(mint, { priceUsd: v.usdPrice, priceSol, mcUsd: v.usdPrice * 1e9, mcSol: priceSol ? priceSol * 1e9 : t.mcSol,
        liqUsd: v.liquidity ?? t.liqUsd, ch5m: old ? ((v.usdPrice - t.firstUsd) / t.firstUsd) * 100 : t.ch5m });
      t.firstUsd ||= v.usdPrice;
    }
    feed.emit();
  } catch {}
}
async function pollSol() {
  try {
    const r = await fetch(DEX + SOL_MINT);
    const pairs = await r.json();
    const p = pairs.filter((x) => x.baseToken?.address === SOL_MINT && x.quoteToken?.symbol === "USDC")
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (p) { feed.solUsd = +p.priceUsd; store.set("solUsd", feed.solUsd); $("#st-sol").textContent = "SOL $" + feed.solUsd.toFixed(2); }
  } catch {}
}

// ---------- Vortex calls ----------
function checkCall(t) {
  const call = feed.calls.find((c) => c.mint === t.mint);
  if (call) {
    if (t.mcUsd > (call.peak || 0)) { call.peak = t.mcUsd; saveCalls(); }
    return;
  }
  const ageMin = (Date.now() - t.created) / 60000;
  const R = CALL_RULES;
  if (ageMin > R.maxAgeMin || !(t.mcUsd >= R.minMcUsd) || !(t.buys5m >= R.minBuys5m)) return;
  if (t.buys5m <= t.sells5m || (t.devPct || 0) > R.maxDevPct) return;
  const c = { mint: t.mint, symbol: t.symbol, name: t.name, image: t.image, t: Date.now(), mcAtCall: t.mcUsd, peak: t.mcUsd,
    reason: `${t.buys5m} buys in 5m at ${fmt.usd(t.mcUsd)}` };
  feed.calls.unshift(c);
  feed.calls = feed.calls.slice(0, 200);
  saveCalls();
  sound.call();
  notify.send(`Vortex call: ${t.symbol}`, c.reason, t.image);
}
function saveCalls() { store.set("calls", feed.calls); }

// ---------- status bar ----------
function setStatus(text, ok) {
  const el = $("#st-live");
  el.classList.toggle("ok", ok);
  el.innerHTML = '<span class="dot"></span> ' + text;
}

// ---------- save / restore a snapshot so the board is not empty on reload ----------
function snapshot() {
  const list = [...feed.tokens.values()].filter((t) => Date.now() - t.created < 2 * 3600e3).slice(-200)
    .map(({ fresh, ...t }) => t);
  store.set("snap", { t: Date.now(), list });
}
(function restore() {
  const s = store.get("snap", null);
  if (!s || Date.now() - s.t > 30 * 60e3) return;
  for (const t of s.list) feed.tokens.set(t.mint, { ...t, lastDex: 0 });
})();

if (feed.solUsd) $("#st-sol").textContent = "SOL $" + feed.solUsd.toFixed(2);
connect();
pollSol();
setInterval(pollDex, 2500);
setInterval(pollJup, 3000);
setInterval(() => document.visibilityState === "visible" && pollSol(), 60000);
setInterval(snapshot, 15000);
setInterval(() => wallet.checkOrders((m) => feed.tokens.get(m)), 2000); // also runs when the tab is in the background
