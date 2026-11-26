// Vortex portfolio: paper wallet, positions, value over time and trade history with CSV export.
"use strict";

const pf = { chart: null, series: null };

// remember total value once a minute so the value-over-time chart has something to draw
function snapEquity() {
  if (!wallet.ready()) return;
  const eq = store.get("equity", []);
  const v = wallet.data.balance + wallet.value((m) => feed.get(m));
  const t = Math.floor(Date.now() / 1000);
  if (!eq.length || t - eq[eq.length - 1].time >= 60) eq.push({ time: t, value: +v.toFixed(4) });
  else eq[eq.length - 1].value = +v.toFixed(4);
  store.set("equity", eq.slice(-2000));
}
setInterval(snapEquity, 15000);

function feesPaid() { return (wallet.data?.trades || []).reduce((a, x) => a + (x.fee || 0), 0); }

function renderPfStats() {
  if (!wallet.ready()) {
    $("#pf-stats").innerHTML = `<div style="grid-column:1/-1"><small>No paper wallet yet</small><b>–</b>
      <span><button class="chip" onclick="askStart()">Pick a starting balance</button></span></div>`;
    return;
  }
  const value = wallet.value((m) => feed.get(m));
  const total = wallet.data.balance + value, pnl = total - wallet.data.start;
  const npos = Object.keys(wallet.data.positions).length;
  $("#pf-stats").innerHTML = `
    <div><small>Wallet balance</small><b>${fmt.sol(wallet.data.balance, 3)} SOL</b><span>${feed.solUsd ? "≈ " + fmt.usd(wallet.data.balance * feed.solUsd) : ""}</span></div>
    <div><small>Positions value</small><b>${fmt.sol(value, 3)} SOL</b><span>${npos} open</span></div>
    <div><small>Total PnL</small><b class="${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(pnl, 3)} SOL</b>
      <span>${fmt.pct((pnl / wallet.data.start) * 100)} on ${wallet.data.start} SOL</span></div>
    <div><small>Vortex fees paid</small><b>${fmt.sol(feesPaid(), 4)} SOL</b><span>1% per buy and per sell · no subscription</span></div>`;
}

function renderPfWallet() {
  const el = $("#pf-wallet");
  if (!wallet.ready()) { el.innerHTML = '<p class="muted">You have not started yet.</p><button class="primary" onclick="askStart()">Pick a starting balance</button>'; return; }
  const d = wallet.data;
  el.innerHTML = `
    <div class="row2"><span class="muted">Started</span><span>${new Date(d.created).toLocaleString()}</span></div>
    <div class="row2"><span class="muted">Money put in</span><b class="num">${fmt.sol(d.start, 3)} SOL</b></div>
    <div class="row2"><span class="muted">Trades made</span><b class="num">${d.trades.length}</b></div>
    <label class="small muted" for="pf-dep-amt">Add more pretend SOL</label>
    <div class="pf-dep"><input id="pf-dep-amt" class="mini-in" type="number" min="0.1" step="0.1" value="5"><span class="small muted">SOL</span>
      <button class="chip" id="pf-dep">Add</button></div>
    <div class="pf-btns"><button class="danger" id="pf-reset">Reset wallet</button></div>
    <p class="small muted">Adding SOL also raises "money put in", so it does not count as profit.</p>`;
}

function renderPfPositions() {
  const el = $("#pf-pos");
  const held = Object.values(wallet.data?.positions || {});
  $("#pf-npos").textContent = held.length;
  $("#pf-clock").textContent = new Date().toLocaleTimeString();
  if (!held.length) { el.innerHTML = '<p class="empty">No positions yet. Use a ⚡ quick buy on the home page or buy from a token page.</p>'; return; }
  el.innerHTML = `<table class="tbl wide"><thead><tr><th>Token</th><th>Cost</th><th>Worth now</th><th>PnL</th><th>MC</th><th>Auto sell</th><th></th></tr></thead><tbody>${
    held.map((p) => {
      const t = feed.get(p.mint) || { ...p, socials: {} };
      const i = posInfo(t) || { value: null, pnl: null, pct: null };
      const o = wallet.data.orders?.[p.mint];
      return `<tr><td><span class="tok" data-open="${p.mint}"><span class="av">${avatar(t)}</span>${esc(p.symbol)}</span></td>
        <td class="num">${fmt.sol(p.cost, 3)}</td><td class="num">${fmt.sol(i.value, 3)}</td>
        <td class="num ${i.pnl >= 0 ? "up" : "down"}">${i.pnl == null ? "–" : (i.pnl >= 0 ? "▲ +" : "▼ ") + fmt.sol(i.pnl, 4) + " (" + i.pct.toFixed(1) + "%)"}</td>
        <td class="num">${fmt.usd(t.mcUsd)}</td>
        <td class="num">${o ? `${o.tp ? "TP x" + o.tp : ""} ${o.sl ? "SL −" + o.sl + "%" : ""}` : '<span class="muted">none</span>'}</td>
        <td><button class="sell" data-sell="${p.mint}" data-f="0.5">50%</button><button class="sell" data-sell="${p.mint}" data-f="1">Sell all</button></td></tr>`;
    }).join("")}</tbody></table>`;
}

function renderPfTrades() {
  const list = wallet.data?.trades || [];
  $("#pf-ntr").textContent = list.length;
  $("#pf-trades").innerHTML = list.length ? `<table class="tbl wide"><thead><tr><th>When</th><th>Type</th><th>Token</th><th>SOL</th><th>Tokens</th><th>Price (SOL)</th><th>Fee</th></tr></thead><tbody>${
    list.slice(0, 100).map((x) => `<tr class="${x.side === "buy" ? "up" : "down"}">
      <td class="muted">${new Date(x.t).toLocaleString()}</td><td>${x.side === "buy" ? "▲ Buy" : "▼ Sell"}</td>
      <td><span class="tok" data-open="${x.mint}">${esc(x.symbol)}</span></td><td class="num">${fmt.sol(x.sol, 3)}</td>
      <td class="num">${(x.tokens / 1e6).toFixed(2)}M</td><td class="num">${x.price ? x.price.toPrecision(3) : "–"}</td>
      <td class="num">${fmt.sol(x.fee, 4)}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">No trades yet.</p>';
}

function renderPfChart() {
  const box = $("#pf-chart");
  const eq = store.get("equity", []);
  $("#pf-eq-note").textContent = eq.length ? "saved once a minute while Vortex is open" : "";
  if (!window.LightweightCharts) return;
  if (!pf.chart) {
    pf.chart = LightweightCharts.createChart(box, {
      autoSize: true, layout: { background: { color: "transparent" }, textColor: "#a98f9a", fontFamily: "Manrope" },
      grid: { vertLines: { color: "rgba(169,143,154,.08)" }, horzLines: { color: "rgba(169,143,154,.08)" } },
      timeScale: { timeVisible: true, borderColor: "#201c24" }, rightPriceScale: { borderColor: "#201c24" },
    });
    pf.series = pf.chart.addAreaSeries({ lineColor: "#e0173f", topColor: "rgba(224,23,63,.32)", bottomColor: "rgba(224,23,63,0)", lineWidth: 2 });
  }
  pf.series.setData(eq);
  if (pf.line) { pf.series.removePriceLine(pf.line); pf.line = null; }
  if (wallet.ready()) pf.line = pf.series.createPriceLine({ price: wallet.data.start, color: "#8b8794", lineStyle: 2, title: "start" });
}

function renderPortfolio(full) {
  if (!$("#p-portfolio").classList.contains("on")) return;
  renderPfStats(); renderPfPositions();
  if (full) { renderPfWallet(); renderPfTrades(); renderPfChart(); }
}

// ---------- actions ----------
$("#p-portfolio").addEventListener("click", (e) => {
  if (e.target.id === "pf-dep") {
    const v = +$("#pf-dep-amt").value;
    if (!(v > 0)) return toast("Enter an amount above 0");
    wallet.data.balance += v; wallet.data.start += v; wallet.save();
    toast(`Added ${v} pretend SOL`); renderPortfolio(true);
  }
  if (e.target.id === "pf-reset") {
    if (!confirm("Reset your paper wallet? All positions and trade history will be deleted. This cannot be undone.")) return;
    store.set("equity", []);
    wallet.reset();
  }
});
$("#pf-csv").addEventListener("click", () => {
  const list = wallet.data?.trades || [];
  if (!list.length) return toast("No trades to export yet");
  const rows = [["time", "side", "token", "mint", "sol", "tokens", "price_sol", "fee_sol"],
    ...list.map((x) => [new Date(x.t).toISOString(), x.side, x.symbol, x.mint, x.sol, x.tokens, x.price, x.fee])];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `vortex-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
// sells from this page also refresh the tables
document.addEventListener("click", (e) => { if (e.target.closest("[data-sell]")) setTimeout(() => renderPortfolio(true), 50); });
$("#start-form").addEventListener("submit", () => setTimeout(() => renderPortfolio(true), 50));

feed.on(() => renderPortfolio(false));
pages.portfolio = {
  open() {
    stopToken(); snapEquity(); renderPortfolio(true);
    clearInterval(pf.timer);
    pf.timer = setInterval(() => $("#p-portfolio").classList.contains("on") ? renderPortfolio(false) : clearInterval(pf.timer), 2000);
  },
};

