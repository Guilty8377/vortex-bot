// Vortex top traders: paper leaderboard (you vs the Vortex call plans) and public KOL wallets.
"use strict";

const tr = { follow: new Set(store.get("follow", [])), bal: {}, holds: {}, open: null, loading: false };

// ---------- paper leaderboard ----------
function myStats() {
  if (!wallet.ready()) return null;
  const byMint = {};
  for (const x of wallet.data.trades) {
    const m = (byMint[x.mint] ||= { in: 0, out: 0, buys: 0 });
    if (x.side === "buy") { m.in += x.sol; m.buys++; } else m.out += x.sol;
  }
  const closed = Object.entries(byMint).filter(([mint]) => !wallet.data.positions[mint]).map(([, m]) => m);
  const value = wallet.value((mm) => feed.get(mm));
  const pnl = wallet.data.balance + value - wallet.data.start;
  const spent = Object.values(byMint).reduce((a, m) => a + m.in, 0);
  const best = closed.reduce((b, m) => Math.max(b, m.in ? m.out / m.in : 0), 0);
  return {
    name: "You", me: true, pnl, ret: spent ? (pnl / spent) * 100 : 0,
    win: closed.length ? (closed.filter((m) => m.out > m.in).length / closed.length) * 100 : null,
    trades: Object.values(byMint).reduce((a, m) => a + m.buys, 0), best: best || null,
  };
}
function planStats() {
  const list = feed.calls.filter((c) => Date.now() - c.t < 30 * 86400e3);
  return PLANS.map((plan) => {
    const outs = list.map((c) => planResult(plan, c));
    const put = list.length * 0.1, back = outs.reduce((a, b) => a + b, 0);
    return {
      name: "Vortex plan: " + plan.name, pnl: back - put, ret: put ? ((back - put) / put) * 100 : 0,
      win: list.length ? (outs.filter((o) => o > 0.1).length / list.length) * 100 : null,
      trades: list.length, best: outs.length ? Math.max(...outs) / 0.1 : null,
    };
  });
}
function renderBoard() {
  const rows = [myStats(), ...planStats()].filter(Boolean).sort((a, b) => b.ret - a.ret);
  $("#lb-body").innerHTML = rows.map((r, i) => `<tr class="${r.me ? "me" : ""}">
    <td class="muted">${i + 1}</td>
    <td><span class="who"><span class="ph">${r.me ? "★" : "⚡"}</span>${esc(r.name)}</span></td>
    <td class="num ${r.pnl >= 0 ? "up" : "down"}">${r.pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(r.pnl, 3)} SOL</td>
    <td class="num ${r.ret >= 0 ? "up" : "down"}">${fmt.pct(r.ret)}</td>
    <td class="num">${r.win == null ? "–" : r.win.toFixed(0) + "%"}</td>
    <td class="num">${r.trades}</td>
    <td class="num">${r.best ? "x" + r.best.toFixed(2) : "–"}</td></tr>`).join("")
    + (wallet.ready() ? "" : `<tr><td colspan="7" class="muted">Pick a starting balance to join the board.</td></tr>`);
}

// ---------- KOL wallets ----------
const ULTRA = "https://lite-api.jup.ag/ultra/v1/holdings/";
async function loadBalances() {
  if (tr.loading) return;
  tr.loading = true;
  for (const k of KOLS) {
    if (!$("#p-traders").classList.contains("on")) break;
    try {
      const j = await (await fetch(ULTRA + k.wallet)).json();
      tr.bal[k.wallet] = j.uiAmount;
      tr.holds[k.wallet] ||= { raw: j.tokens };
      tr.holds[k.wallet].raw = j.tokens;
      renderKols();
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  tr.loading = false;
}
async function loadBags(w) {
  if (!tr.holds[w]?.raw) {
    try { const j = await (await fetch(ULTRA + w)).json(); tr.bal[w] = j.uiAmount; tr.holds[w] = { raw: j.tokens }; }
    catch { tr.holds[w] = { raw: {}, bags: [] }; renderKols(); return; }
  }
  const h = tr.holds[w];
  // most wallets hold thousands of tiny spam tokens, so only price the biggest unfrozen amounts
  const cand = Object.entries(h.raw).map(([mint, accts]) => ({ mint, amt: accts.reduce((a, x) => a + (x.isFrozen ? 0 : x.uiAmount), 0) }))
    .filter((x) => x.amt > 0 && x.mint !== SOL_MINT).sort((a, b) => b.amt - a.amt).slice(0, 500);
  // DexScreener allows more requests than Jupiter's free price API, 30 tokens per call
  const best = {};
  for (let i = 0; i < cand.length; i += 30) {
    try {
      const pairs = await (await fetch(DEX + cand.slice(i, i + 30).map((x) => x.mint).join(","))).json();
      for (const p of pairs) {
        const m = p.baseToken?.address;
        if (m && (!best[m] || (p.liquidity?.usd || 0) > (best[m].liquidity?.usd || 0))) best[m] = p;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  const bags = cand.filter((x) => best[x.mint]).map((x) => {
    const p = best[x.mint];
    return { ...x, usd: x.amt * (+p.priceUsd || 0), symbol: p.baseToken.symbol, icon: p.info?.imageUrl || "", mc: p.marketCap || p.fdv };
  }).filter((x) => x.usd >= 50).sort((a, b) => b.usd - a.usd).slice(0, 12);
  h.bags = bags; h.t = Date.now();
  renderKols();
}
function renderKols() {
  const list = [...KOLS].sort((a, b) => tr.follow.has(b.wallet) - tr.follow.has(a.wallet));
  $("#kol-body").innerHTML = list.map((k) => {
    const i = KOLS.indexOf(k) + 1, open = tr.open === k.wallet, h = tr.holds[k.wallet];
    const row = `<tr class="row${open ? " open" : ""}" data-kol="${k.wallet}" tabindex="0" aria-label="${esc(k.name)}, ${open ? "hide" : "show"} holdings">
      <td><button class="star${tr.follow.has(k.wallet) ? " on" : ""}" data-follow="${k.wallet}" aria-label="Follow ${esc(k.name)}">★</button></td>
      <td class="muted">${i}</td>
      <td><span class="who"><span class="ph">${esc(k.name[0])}</span>${esc(k.name)}</span></td>
      <td class="num">${fmt.short(k.wallet)} <button class="mini" data-copy="${k.wallet}" aria-label="Copy wallet">⧉</button></td>
      <td class="num">${tr.bal[k.wallet] != null ? fmt.sol(tr.bal[k.wallet], 2) + " SOL" : "…"}</td>
      <td class="num">${h?.bags ? h.bags.length + " worth $50+" : open ? "loading…" : "click to see"}</td>
      <td class="links"><a href="https://solscan.io/account/${k.wallet}" target="_blank" rel="noopener">Solscan</a>
        <a href="https://kolscan.io/account/${k.wallet}" target="_blank" rel="noopener">Kolscan</a></td>
      <td><button class="chip small-chip" data-copytrade="${k.wallet}" data-name="${esc(k.name)}">Copy</button></td></tr>`;
    if (!open) return row;
    const bags = h?.bags;
    return row + `<tr class="hold-row"><td colspan="8">${!bags ? '<p class="empty">Checking what this wallet holds…</p>'
      : bags.length ? `<div class="holds">${bags.map((b) => `<div class="hold" data-open="${b.mint}">
          <span class="av">${b.icon ? `<img src="${esc(b.icon)}" alt="" loading="lazy">` : `<span class="ph">${esc(b.symbol[0])}</span>`}</span>
          <div><b>${esc(b.symbol)}</b><span class="num">MC ${fmt.usd(b.mc)}</span></div>
          <span class="num">${fmt.usd(b.usd)}</span></div>`).join("")}</div>`
      : '<p class="empty">No meme bags worth over $50 right now. They may be holding SOL only.</p>'}</td></tr>`;
  }).join("");
}
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-follow]");
  if (f) {
    e.stopPropagation();
    const w = f.dataset.follow;
    tr.follow.has(w) ? tr.follow.delete(w) : tr.follow.add(w);
    store.set("follow", [...tr.follow]);
    toast(tr.follow.has(w) ? "Following. They now show at the top" : "Unfollowed");
    renderKols();
    return;
  }
  const r = e.target.closest("[data-kol]");
  if (!r || e.target.closest("a,[data-copy],[data-copytrade]")) return;
  const w = r.dataset.kol;
  tr.open = tr.open === w ? null : w;
  renderKols();
  if (tr.open && (!tr.holds[w]?.bags || Date.now() - tr.holds[w].t > 60000)) loadBags(w);
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.("[data-kol]")) e.target.click(); });

pages.traders = {
  open() {
    stopToken(); renderBoard(); renderKols(); loadBalances();
    clearInterval(tr.timer);
    tr.timer = setInterval(() => $("#p-traders").classList.contains("on") ? renderBoard() : clearInterval(tr.timer), 3000);
  },
};

