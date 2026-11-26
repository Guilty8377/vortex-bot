// Vortex token page: chart, live trades, holders, safety check and the paper buy / sell panel.
// Data comes from Jupiter's free data API (the same data jup.ag uses).
"use strict";

const JUPD = "https://datapi.jup.ag";
const tk = {
  mint: null, asset: null, chart: null, series: null, timers: [],
  tf: store.get("tf", "1_MINUTE"), ctype: store.get("ctype", "mcap"), cstyle: store.get("cstyle", "candles"),
  tab: "trades", side: "buy", trades: [], holders: [], holderCount: null, otype: "market",
  hotkeys: store.get("hotkeys", false),
};

const solscan = (a, kind = "account") => `https://solscan.io/${kind}/${a}`;
const timeAgo = (iso) => fmt.age((Date.now() - new Date(iso).getTime()) / 1000);

function tkToken() {
  // make sure the token exists in the shared list so paper trades and PnL work for any token
  const a = tk.asset;
  let t = feed.get(tk.mint);
  const priceSol = a?.usdPrice && feed.solUsd ? a.usdPrice / feed.solUsd : t?.priceSol;
  t = upsert(tk.mint, {
    symbol: t?.symbol || a?.symbol || "?", name: t?.name || a?.name || "", image: t?.image || a?.icon || "",
    ...(a ? { priceUsd: a.usdPrice, priceSol, mcUsd: a.mcap, liqUsd: a.liquidity ?? t?.liqUsd } : {}),
    ...(t ? {} : { created: a?.createdAt ? Date.parse(a.createdAt) : Date.now() }),
  });
  if (a?.twitter) t.socials.x ||= a.twitter;
  if (a?.telegram) t.socials.tg ||= a.telegram;
  if (a?.website) t.socials.web ||= a.website;
  return t;
}

// ---------- header ----------
function renderHead() {
  const a = tk.asset, t = tkToken();
  $("#tk-av").innerHTML = avatar(t);
  $("#tk-sym").textContent = t.symbol;
  $("#tk-name").textContent = t.name;
  $("#tk-addr").textContent = tk.mint;
  $("#tk-soc").innerHTML = socials(t.socials) + ` <a href="${solscan(tk.mint, "token")}" target="_blank" rel="noopener" title="Solscan">🔍</a>`;
  document.title = `${t.symbol} · Vortex`;
  const s = a?.stats5m, h = a?.stats1h;
  const stat = (k, v, cls = "") => `<div><dt>${k}</dt><dd class="num ${cls}">${v}</dd></div>`;
  const ch = (v) => (v == null ? "" : v >= 0 ? "up" : "down");
  $("#tk-stats").innerHTML =
    stat("Market cap", fmt.usd(a?.mcap ?? t.mcUsd)) +
    stat("Price", a?.usdPrice ? "$" + a.usdPrice.toPrecision(3) : "–") +
    stat("Liquidity", fmt.usd(a?.liquidity ?? t.liqUsd)) +
    stat("Holders", a?.holderCount?.toLocaleString() ?? "–") +
    stat("5m", fmt.pct(s?.priceChange), ch(s?.priceChange)) +
    stat("1h", fmt.pct(h?.priceChange), ch(h?.priceChange)) +
    stat("Age", a?.createdAt ? timeAgo(a.createdAt) : fmt.age((Date.now() - t.created) / 1000));
}

// ---------- safety check ----------
function safety() {
  const au = tk.asset?.audit || {};
  const checks = [];
  const add = (ok, text, why) => checks.push({ ok, text, why });
  add(au.mintAuthorityDisabled !== false, au.mintAuthorityDisabled === false ? "Mint authority ON" : "Mint authority off", "If on, the dev can print more tokens");
  add(au.freezeAuthorityDisabled !== false, au.freezeAuthorityDisabled === false ? "Freeze authority ON" : "Freeze authority off", "If on, the dev can freeze your tokens so you cannot sell");
  if (au.topHoldersPercentage != null) add(au.topHoldersPercentage < 35, `Top 10 hold ${au.topHoldersPercentage.toFixed(0)}%`, "Big holders can dump on everyone else");
  if (au.sniperPct != null) add(au.sniperPct < 20, `Snipers ${au.sniperPct.toFixed(0)}%`, "Wallets that bought in the first seconds");
  if (au.devMints != null) add(au.devMints <= 3, `Dev made ${au.devMints} token${au.devMints === 1 ? "" : "s"}`, "Devs who launch lots of tokens often rug");
  if (au.devMigrations != null) add(au.devMigrations > 0, `Dev migrated ${au.devMigrations} before`, "A dev with past migrations has had real buyers before");
  if (au.botHoldersPercentage != null) add(au.botHoldersPercentage < 5, `Bots hold ${au.botHoldersPercentage.toFixed(1)}%`, "Bot wallets fake activity");
  if (tk.asset?.organicScoreLabel) add(tk.asset.organicScoreLabel !== "low", `Organic activity ${tk.asset.organicScoreLabel}`, "Low means most trading looks fake");
  if (au.iconReused) add(false, "Logo copied from another token", "Copycat tokens are a common scam");
  const t = feed.get(tk.mint);
  if (t?.devPct) add(t.devPct < 10, `Dev bought ${t.devPct.toFixed(1)}% at launch`, "A big dev buy can be dumped at any time");
  return checks;
}
function renderSafety() {
  if (!tk.asset) return;
  const c = safety();
  const score = c.length ? Math.round((c.filter((x) => x.ok).length / c.length) * 100) : null;
  const el = $("#tk-score");
  el.textContent = score == null ? "–" : score + "/100";
  el.className = "score " + (score >= 70 ? "good" : score >= 45 ? "mid" : "bad");
  $("#tk-checks").innerHTML = c.map((x) => `<li class="${x.ok ? "ok" : "no"}" title="${esc(x.why)}">
    <span aria-hidden="true">${x.ok ? "✔" : "✖"}</span> ${esc(x.text)}<small>${esc(x.why)}</small></li>`).join("");
  const call = feed.calls.find((x) => x.mint === tk.mint);
  $("#tk-call").innerHTML = call
    ? `<p><b class="up">⚡ Called ${fmt.age((Date.now() - call.t) / 1000)} ago</b><br><span class="muted">${esc(call.reason)}</span></p>
       <p class="num">MC at call ${fmt.usd(call.mcAtCall)} · best since x${(call.peak / call.mcAtCall).toFixed(2)}</p>`
    : `<p class="muted small">Vortex has not called this token. Calls need ${CALL_RULES.minBuys5m}+ buys in 5 minutes, ${fmt.usd(CALL_RULES.minMcUsd)}+ market cap, more buys than sells and a dev holding ${CALL_RULES.maxDevPct}% or less.</p>`;
}

// ---------- chart ----------
function heikin(c) {
  const out = [];
  for (let i = 0; i < c.length; i++) {
    const x = c[i], close = (x.open + x.high + x.low + x.close) / 4;
    const open = i ? (out[i - 1].open + out[i - 1].close) / 2 : (x.open + x.close) / 2;
    out.push({ time: x.time, open, close, high: Math.max(x.high, open, close), low: Math.min(x.low, open, close) });
  }
  return out;
}
function makeChart() {
  const box = $("#chart");
  if (tk.chart) { tk.chart.remove(); tk.chart = null; }
  if (!window.LightweightCharts) { box.innerHTML = '<p class="empty">Chart could not load.</p>'; return; }
  box.innerHTML = "";
  tk.chart = LightweightCharts.createChart(box, {
    autoSize: true,
    layout: { background: { color: "transparent" }, textColor: "#a98f9a", fontFamily: "Manrope" },
    grid: { vertLines: { color: "rgba(169,143,154,.08)" }, horzLines: { color: "rgba(169,143,154,.08)" } },
    timeScale: { timeVisible: true, secondsVisible: true, borderColor: "rgba(169,143,154,.18)" },
    rightPriceScale: { borderColor: "rgba(169,143,154,.18)" },
    crosshair: { mode: 0 },
  });
  tk.series = tk.chart.addCandlestickSeries({
    upColor: "#3ee0a7", downColor: "#ff7a93", borderVisible: false, wickUpColor: "#3ee0a7", wickDownColor: "#ff7a93",
    priceFormat: { type: "custom", minMove: 1e-12, formatter: (v) => (tk.ctype === "mcap" ? fmt.usd(v) : v < 0.01 ? v.toPrecision(3) : v.toFixed(4)) },
  });
  loadCandles(true);
}
async function loadCandles(fit) {
  if (!tk.series) return;
  const mint = tk.mint;
  try {
    const r = await fetch(`${JUPD}/v2/charts/${mint}?interval=${tk.tf}&to=${Date.now()}&candles=300&type=${tk.ctype}&quote=usd`);
    const j = await r.json();
    if (mint !== tk.mint || !tk.series) return;
    let c = (j.candles || []).map((x) => ({ time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }));
    if (tk.cstyle === "heikin") c = heikin(c);
    tk.series.setData(c);
    // mark my paper buys and sells on the chart
    const mine = (wallet.data?.trades || []).filter((x) => x.mint === mint).map((x) => ({
      time: Math.floor(x.t / 1000), position: x.side === "buy" ? "belowBar" : "aboveBar",
      color: x.side === "buy" ? "#2fe0a0" : "#ff6b9a", shape: x.side === "buy" ? "arrowUp" : "arrowDown", text: x.side === "buy" ? "B" : "S",
    })).filter((m) => c.length && m.time >= c[0].time).sort((a, b) => a.time - b.time);
    const step = c.length > 1 ? c[1].time - c[0].time : 60;
    tk.series.setMarkers(mine.map((m) => ({ ...m, time: m.time - ((m.time - c[0].time) % step) })));
    if (fit) tk.chart.timeScale().fitContent();
  } catch {}
}

// ---------- trades / holders / my trades ----------
async function loadAsset() {
  try {
    const r = await fetch(`${JUPD}/v1/assets/search?query=${tk.mint}`);
    const j = await r.json();
    const a = (j || []).find((x) => x.id === tk.mint);
    if (a) tk.asset = a;
  } catch {}
  renderHead(); renderSafety(); renderPos();
}
async function loadTrades() {
  try {
    const j = await (await fetch(`${JUPD}/v1/txs/${tk.mint}?dir=desc`)).json();
    tk.trades = j.txs || [];
  } catch {}
  if (tk.tab === "trades") renderTab();
}
async function loadHolders() {
  try {
    const j = await (await fetch(`${JUPD}/v1/holders/${tk.mint}`)).json();
    tk.holders = j.holders || []; tk.holderCount = j.count;
    $("#tk-hc").textContent = j.count ?? "";
  } catch {}
  if (tk.tab === "holders") renderTab();
}
function renderTab() {
  const el = $("#tk-tab");
  const supply = tk.asset?.totalSupply || 1e9;
  if (tk.tab === "trades") {
    el.innerHTML = tk.trades.length ? `<table class="tbl"><thead><tr><th>Age</th><th>Type</th><th>USD</th><th>SOL</th><th>MC</th><th>Trader</th></tr></thead><tbody>${
      tk.trades.slice(0, 60).map((x) => `<tr class="${x.type === "buy" ? "up" : "down"}">
        <td class="muted">${timeAgo(x.timestamp)}</td><td>${x.type === "buy" ? "▲ Buy" : "▼ Sell"}</td>
        <td class="num">${fmt.usd(x.usdVolume)}</td><td class="num">${fmt.sol(x.nativeVolume, 3)}</td>
        <td class="num">${fmt.usd(x.usdPrice * supply)}</td>
        <td><a class="num" href="${solscan(x.traderAddress)}" target="_blank" rel="noopener">${fmt.short(x.traderAddress)}</a>
          ${(x.holderTags || []).map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</td></tr>`).join("")
    }</tbody></table>` : '<p class="empty">Loading trades…</p>';
  } else if (tk.tab === "holders") {
    const pool = tk.asset?.graduatedPool, dev = tk.asset?.dev;
    el.innerHTML = tk.holders.length ? `<table class="tbl"><thead><tr><th>#</th><th>Wallet</th><th>%</th><th>Amount</th><th>SOL</th><th>Tags</th></tr></thead><tbody>${
      tk.holders.slice(0, 50).map((h, i) => {
        const tags = [...(h.holderTags || [])];
        if (h.address === pool || h.address === tk.mint) tags.unshift("pool");
        if (h.address === dev) tags.unshift("dev");
        return `<tr><td class="muted">${i + 1}</td><td><a class="num" href="${solscan(h.address)}" target="_blank" rel="noopener">${fmt.short(h.address)}</a></td>
          <td class="num">${((h.amount / supply) * 100).toFixed(2)}%</td><td class="num">${(h.amount / 1e6).toFixed(2)}M</td>
          <td class="num">${fmt.sol(h.solBalanceDisplay, 2)}</td><td>${tags.map((g) => `<span class="tag${g === "dev" || g === "sniper" || g === "insider" ? " bad" : ""}">${esc(g)}</span>`).join("")}</td></tr>`;
      }).join("")
    }</tbody></table>` : '<p class="empty">Loading holders…</p>';
  } else if (tk.tab === "bubbles") {
    drawBubbles();
  } else {
    const mine = (wallet.data?.trades || []).filter((x) => x.mint === tk.mint);
    el.innerHTML = mine.length ? `<table class="tbl"><thead><tr><th>When</th><th>Type</th><th>SOL</th><th>Tokens</th><th>Fee</th></tr></thead><tbody>${
      mine.map((x) => `<tr class="${x.side === "buy" ? "up" : "down"}"><td class="muted">${fmt.age((Date.now() - x.t) / 1000)} ago</td>
        <td>${x.side === "buy" ? "▲ Buy" : "▼ Sell"}</td><td class="num">${fmt.sol(x.sol, 3)}</td>
        <td class="num">${(x.tokens / 1e6).toFixed(2)}M</td><td class="num">${fmt.sol(x.fee, 4)}</td></tr>`).join("")
    }</tbody></table>` : '<p class="empty">You have not paper traded this token yet.</p>';
  }
}

// ---------- buy / sell panel ----------
function paintSide() {
  const buy = tk.side === "buy";
  $$(".bs-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.side === tk.side));
  $("#tk-amt-l").textContent = buy ? "Amount (SOL)" : "Amount (% of your holding)";
  $("#tk-unit").textContent = buy ? "SOL" : "%";
  $("#tk-amt").value = buy ? store.get("quick", 0.1) : 100;
  $("#tk-presets").innerHTML = (buy ? [0.1, 0.25, 0.5, 1] : [25, 50, 100]).map((v) => `<button type="button" data-v="${v}">${v}${buy ? "" : "%"}</button>`).join("");
  $("#tk-go").textContent = buy ? "Buy" : "Sell";
  $("#tk-go").className = "primary " + (buy ? "" : "sell-go");
  $("#tk-adv").hidden = !buy || tk.otype !== "market";
  $("#tk-otype").hidden = !buy;
  $("#tk-limit").hidden = !buy || tk.otype !== "limit";
  $("#tk-dca").hidden = !buy || tk.otype !== "dca";
  $$("#tk-otype button").forEach((b) => b.classList.toggle("on", b.dataset.o === tk.otype));
  if (buy) $("#tk-go").textContent = tk.otype === "limit" ? "Place limit buy" : tk.otype === "dca" ? "Start DCA" : "Buy";
  if (buy) $("#tk-amt-l").textContent = tk.otype === "dca" ? "Amount each time (SOL)" : "Amount (SOL)";
}
$("#tk-otype").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { tk.otype = b.dataset.o; paintSide(); } });
function pendingHtml() {
  const lim = (wallet.data?.limits || []).filter((x) => x.mint === tk.mint);
  const dca = (wallet.data?.dca || []).filter((x) => x.mint === tk.mint);
  if (!lim.length && !dca.length) return "";
  return `<h3>Waiting orders</h3>` + lim.map((l) => `<div class="row2"><span>Limit ${fmt.sol(l.sol, 2)} SOL at ${fmt.usd(l.mc)}</span>
      <button class="mini" data-cancel="limits" data-id="${l.id}" aria-label="Cancel limit order">✕</button></div>`).join("")
    + dca.map((d) => `<div class="row2"><span>DCA ${fmt.sol(d.sol, 2)} SOL every ${d.every}m · ${d.left} left</span>
      <button class="mini" data-cancel="dca" data-id="${d.id}" aria-label="Cancel DCA">✕</button></div>`).join("");
}
function renderPos() {
  const t = feed.get(tk.mint);
  const el = $("#tk-pos");
  if (!t || !wallet.data?.positions[t.mint]) { el.innerHTML = pendingHtml() + `<p class="small muted">Balance ${wallet.ready() ? fmt.sol(wallet.data.balance, 3) + " SOL" : "–"}</p>`; return; }
  const i = posInfo(t), o = wallet.data.orders?.[t.mint];
  el.innerHTML = `<h3>Your position</h3>
    <div class="row2"><span class="muted">Cost</span><b class="num">${fmt.sol(i.p.cost, 3)} SOL</b></div>
    <div class="row2"><span class="muted">Worth now</span><b class="num">${fmt.sol(i.value, 3)} SOL</b></div>
    <div class="row2"><span class="muted">PnL</span><b class="num ${i.pnl >= 0 ? "up" : "down"}">${i.pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(i.pnl, 4)} (${i.pct?.toFixed(1)}%)</b></div>
    ${o ? `<div class="row2"><span class="muted">Auto sell</span><span class="num">${o.tp ? "TP x" + o.tp : ""} ${o.sl ? "SL −" + o.sl + "%" : ""}
      <button class="mini" id="tk-cancel" title="Cancel take profit and stop loss">✕</button></span></div>` : ""}
    ${pendingHtml()}
    <p class="small muted">Balance ${fmt.sol(wallet.data.balance, 3)} SOL</p>`;
}
$$(".bs-tabs button").forEach((b) => b.addEventListener("click", () => { tk.side = b.dataset.side; paintSide(); }));
$("#tk-presets").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (b) $("#tk-amt").value = b.dataset.v; });
$("#tk-pos").addEventListener("click", (e) => {
  const c = e.target.closest("[data-cancel]");
  if (c) { wallet.cancel(c.dataset.cancel, +c.dataset.id); renderPos(); toast("Order cancelled"); return; }
  if (e.target.id === "tk-cancel") { wallet.setOrder(tk.mint, null, null); renderPos(); toast("Auto sell cancelled"); } });
$("#tk-go").addEventListener("click", () => {
  const t = tkToken();
  if (!t.priceSol) return toast("Price still loading, try again in a second");
  if (tk.side === "buy" && tk.otype === "limit") {
    if (!wallet.ready()) return askStart();
    const mc = +$("#tk-lmc").value, sol = +$("#tk-amt").value;
    if (!(mc > 0) || !(sol > 0)) return toast("Enter a market cap and an amount");
    if (t.mcUsd && mc >= t.mcUsd) return toast(`Market cap is already ${fmt.usd(t.mcUsd)}. Use Market to buy now`);
    wallet.addLimit(t, mc, sol); toast(`Limit buy placed: ${sol} SOL when MC drops to ${fmt.usd(mc)}`); renderPos(); return;
  }
  if (tk.side === "buy" && tk.otype === "dca") {
    if (!wallet.ready()) return askStart();
    const sol = +$("#tk-amt").value, every = Math.max(1, +$("#tk-dmin").value || 5), n = Math.min(50, Math.max(2, +$("#tk-dn").value || 4));
    if (!(sol > 0)) return toast("Enter an amount");
    if (sol * n > wallet.data.balance) return toast(`That needs ${fmt.sol(sol * n, 2)} SOL but you have ${fmt.sol(wallet.data.balance, 2)}`);
    wallet.addDca(t, sol, every, n); toast(`DCA started: ${sol} SOL every ${every} min, ${n} times`); renderPos(); return;
  }
  if (tk.side === "buy") {
    if (!wallet.buy(t, $("#tk-amt").value)) return;
    const tp = +$("#tk-tp").value || null, sl = +$("#tk-sl").value || null;
    if (tp || sl) { wallet.setOrder(t.mint, tp, sl); toast(`Bought. Auto sell set: ${tp ? "TP x" + tp : ""} ${sl ? "SL −" + sl + "%" : ""}`); }
  } else {
    if (!wallet.data?.positions[t.mint]) return toast("You do not hold this token");
    const f = Math.min(100, Math.max(1, +$("#tk-amt").value || 100)) / 100;
    wallet.sell(t, f);
  }
  renderPos(); loadCandles(false);
  if (tk.tab === "mine") renderTab();
});

// ---------- hotkeys ----------
$("#tk-hk").checked = tk.hotkeys;
$("#tk-hk").addEventListener("change", (e) => { tk.hotkeys = e.target.checked; store.set("hotkeys", tk.hotkeys); toast(tk.hotkeys ? "Hotkeys on" : "Hotkeys off"); });
document.addEventListener("keydown", (e) => {
  if (!tk.hotkeys || !$("#p-token").classList.contains("on") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const t = tkToken();
  const buys = { 1: 0.1, 2: 0.25, 3: 0.5, 4: 1 }, sells = { q: 0.25, w: 0.5, e: 0.75, r: 1 };
  const k = e.key.toLowerCase();
  if (buys[k]) { e.preventDefault(); if (wallet.buy(t, buys[k])) { renderPos(); loadCandles(false); } }
  else if (sells[k]) {
    e.preventDefault();
    if (!wallet.data?.positions[t.mint]) return toast("You do not hold this token");
    if (wallet.sell(t, sells[k])) { renderPos(); loadCandles(false); }
  }
});

// ---------- bubble map ----------
const BUB_COLORS = ["#dc143c", "#7aa7ff", "#ffb35c", "#2fe0a0", "#c084fc", "#ff6b9a", "#5eead4", "#facc15"];
function drawBubbles() {
  const el = $("#tk-tab");
  if (!tk.holders.length) { el.innerHTML = '<p class="empty">Loading holders…</p>'; return; }
  el.innerHTML = `<div class="bub-wrap"><canvas id="bub" aria-label="Bubble map of the top holders"></canvas>
    <p class="small muted bub-key">Bubble size is how much each wallet holds. Wallets funded by the same wallet share a colour, which can mean one person controls them all. Red ring: dev, sniper or insider. Grey: pool.</p>
    <p class="small" id="bub-tip" aria-live="polite"></p></div>`;
  const cv = $("#bub"), box = cv.parentElement.getBoundingClientRect();
  const W = Math.max(300, box.width - 20), H = 320, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const supply = tk.asset?.totalSupply || 1e9, pool = tk.asset?.graduatedPool, dev = tk.asset?.dev;
  const funders = {};
  let ci = 0;
  const nodes = tk.holders.slice(0, 60).map((h, i) => {
    const pct = (h.amount / supply) * 100;
    const f = h.addressInfo?.fundingAddress;
    if (f && !(f in funders)) funders[f] = null;
    return { h, pct, f, r: Math.max(5, Math.sqrt(pct) * 14), x: W / 2 + Math.cos(i * 2.4) * (20 + i * 4), y: H / 2 + Math.sin(i * 2.4) * (20 + i * 3),
      isPool: h.address === pool || h.address === tk.mint, bad: h.address === dev || (h.holderTags || []).some((g) => g === "sniper" || g === "insider") };
  });
  // a funder only gets its own colour if it funded 2 or more of these wallets
  const counts = {};
  nodes.forEach((n) => { if (n.f) counts[n.f] = (counts[n.f] || 0) + 1; });
  for (const f of Object.keys(counts)) if (counts[f] > 1) funders[f] = BUB_COLORS[ci++ % BUB_COLORS.length];
  for (let it = 0; it < 220; it++) {
    for (const a of nodes) {
      a.x += (W / 2 - a.x) * 0.01; a.y += (H / 2 - a.y) * 0.01;
      for (const b of nodes) {
        if (a === b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r + 2;
        if (d < min) { const m = (min - d) / 2; a.x -= (dx / d) * m; a.y -= (dy / d) * m; b.x += (dx / d) * m; b.y += (dy / d) * m; }
        else if (a.f && a.f === b.f && funders[a.f]) { a.x += dx * 0.002; a.y += dy * 0.002; }
      }
      a.x = Math.max(a.r, Math.min(W - a.r, a.x)); a.y = Math.max(a.r, Math.min(H - a.r, a.y));
    }
  }
  const draw = (hover) => {
    ctx.clearRect(0, 0, W, H);
    // lines between wallets with the same funder
    ctx.lineWidth = 1;
    for (const a of nodes) for (const b of nodes) if (a !== b && a.f && a.f === b.f && funders[a.f] && a.h.address < b.h.address) {
      ctx.strokeStyle = funders[a.f] + "66"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.isPool ? "#3a3640" : (funders[n.f] || "#2a2530") + (n === hover ? "" : "cc");
      ctx.fill();
      ctx.lineWidth = n.bad ? 3 : 1; ctx.strokeStyle = n.bad ? "#ff6b9a" : "#0e0d11"; ctx.stroke();
      if (n.r > 14) { ctx.fillStyle = "#fff"; ctx.font = "700 10px Manrope"; ctx.textAlign = "center"; ctx.fillText(n.pct.toFixed(1) + "%", n.x, n.y + 3); }
    }
  };
  draw();
  const hit = (ev) => { const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; return nodes.find((n) => Math.hypot(n.x - x, n.y - y) <= n.r); };
  cv.addEventListener("mousemove", (ev) => {
    const n = hit(ev); draw(n); cv.style.cursor = n ? "pointer" : "default";
    $("#bub-tip").textContent = n ? `${fmt.short(n.h.address)} holds ${n.pct.toFixed(2)}%${n.isPool ? " (pool)" : ""}${n.bad ? " · dev / sniper / insider" : ""}${n.f && funders[n.f] ? " · funded by " + fmt.short(n.f) + ", same as other wallets" : ""}` : "";
  });
  cv.addEventListener("click", (ev) => { const n = hit(ev); if (n) window.open("https://solscan.io/account/" + n.h.address, "_blank", "noopener"); });
}

// ---------- controls ----------
function segClick(id, key, attr, after) {
  $("#" + id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    tk[key] = b.dataset[attr]; store.set(key, tk[key]);
    $$("#" + id + " button").forEach((x) => x.classList.toggle("on", x === b));
    after();
  });
  $$("#" + id + " button").forEach((x) => x.classList.toggle("on", x.dataset[attr] === tk[key]));
}
segClick("tf", "tf", "tf", () => loadCandles(true));
segClick("ctype", "ctype", "ct", () => loadCandles(true));
segClick("cstyle", "cstyle", "cs", () => loadCandles(true));
$$(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
  tk.tab = b.dataset.tab;
  $$(".tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
  renderTab();
}));
$("#tk-copy").addEventListener("click", () => navigator.clipboard?.writeText(tk.mint).then(() => toast("Address copied")));

// ---------- open / close ----------
function stopToken() { tk.timers.forEach(clearInterval); tk.timers = []; }
pages.token = {
  open(mint) {
    stopToken();
    if (!mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) { location.hash = "#home"; return; }
    const changed = mint !== tk.mint;
    store.set("recent", [mint, ...store.get("recent", []).filter((m) => m !== mint)].slice(0, 30));
    tk.mint = mint;
    if (changed) { tk.asset = null; tk.trades = []; tk.holders = []; $("#tk-checks").innerHTML = '<li class="empty">Loading…</li>'; $("#tk-tab").innerHTML = ""; }
    tkToken(); renderHead(); paintSide(); renderTab(); renderPos();
    makeChart(); loadAsset(); loadTrades(); loadHolders();
    const fast = tk.tf === "1_SECOND" || tk.tf === "15_SECOND";
    tk.timers.push(setInterval(() => $("#p-token").classList.contains("on") ? loadCandles(false) : stopToken(), fast ? 2000 : 5000));
    tk.timers.push(setInterval(loadTrades, 3000));
    tk.timers.push(setInterval(loadAsset, 5000));
    tk.timers.push(setInterval(loadHolders, 20000));
  },
};
const _home = pages.home.open;
pages.home.open = () => { stopToken(); document.title = "Vortex | paper trading terminal"; _home(); };
for (const k of ["calls", "traders", "portfolio", "fees", "learn", "help"]) pages[k] ||= { open: stopToken };

