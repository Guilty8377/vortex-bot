// Vortex calls page: every auto call, how it did, and live paper tests of simple selling plans.
"use strict";

const cp = { sort: "new", range: store.get("callRange", 168) };

// selling plans tested on every call with pretend 0.1 SOL each
const PLANS = [
  { name: "Sell at x2, stop at −30%", tp: "x2", sl: "d30", tpX: 2, slX: 0.7 },
  { name: "Sell at x3, stop at −40%", tp: "x3", sl: "d40", tpX: 3, slX: 0.6 },
  { name: "Half at x2, hold the rest", half: true },
  { name: "Just hold", hold: true },
];
function planResult(plan, c) {
  const nowX = c.now && c.mcAtCall ? c.now / c.mcAtCall : 1;
  const h = c.hits || {};
  let mult;
  if (plan.hold) mult = nowX;
  else if (plan.half) mult = h.x2 && (!h.d30 || h.x2 < h.d30) ? 0.5 * 2 + 0.5 * nowX : nowX;
  else {
    const tp = h[plan.tp], sl = h[plan.sl];
    if (tp && (!sl || tp < sl)) mult = plan.tpX;
    else if (sl) mult = plan.slX;
    else mult = nowX; // still open
  }
  return 0.1 * (1 - FEE) * mult * (1 - FEE); // pretend 0.1 SOL in, 1% fee in and out
}

function inRange() {
  const since = Date.now() - cp.range * 3600e3;
  return feed.calls.filter((c) => c.t >= since);
}

function renderCallStats(list) {
  const n = list.length;
  const pct = (k) => (n ? Math.round((list.filter((c) => c.hits?.[k]).length / n) * 100) + "%" : "–");
  const best = list.reduce((m, c) => Math.max(m, c.peak / c.mcAtCall || 0), 0);
  const label = cp.range == 24 ? "24 hours" : cp.range == 168 ? "7 days" : "30 days";
  $("#call-stats").innerHTML =
    `<div><small>${label}</small><b>${n} calls</b></div>
     <div><small>Reached +30%</small><b>${pct("x1_3")}</b></div>
     <div><small>Reached x2</small><b>${pct("x2")}</b></div>
     <div><small>Best</small><b class="up">x${best ? best.toFixed(1) : "–"}</b></div>`;
}

function renderTests(list) {
  $("#call-tests").innerHTML = PLANS.map((plan) => {
    const outs = list.map((c) => planResult(plan, c));
    const put = list.length * 0.1, back = outs.reduce((a, b) => a + b, 0);
    const pnl = back - put, pct = put ? (pnl / put) * 100 : 0;
    const wins = outs.filter((o) => o > 0.1).length;
    return `<div class="test"><h3>${plan.name}</h3>
      <div class="big ${pnl >= 0 ? "up" : "down"}">${list.length ? (pnl >= 0 ? "▲ +" : "▼ ") + Math.abs(pct).toFixed(1) + "%" : "–"}</div>
      <p>${list.length} trades · ${wins} winners · ${pnl >= 0 ? "+" : ""}${pnl.toFixed(3)} SOL</p></div>`;
  }).join("");
}

function renderCallList(list) {
  const rows = [...list];
  if (cp.sort === "best") rows.sort((a, b) => b.peak / b.mcAtCall - a.peak / a.mcAtCall);
  $("#c-list-h").textContent = `Calls in the last ${cp.range == 24 ? "24 hours" : cp.range == 168 ? "7 days" : "30 days"}`;
  const amt = +$("#c-amt").value || 0.1;
  $("#call-list").innerHTML = rows.length ? rows.slice(0, 100).map((c) => {
    const t = feed.get(c.mint) || { ...c, socials: {} };
    const x = c.now ? c.now / c.mcAtCall : 1, peak = c.peak / c.mcAtCall;
    const migrated = t.migrated || c.migratedAtCall;
    return `<li class="call" data-open="${c.mint}">
      <span class="av">${avatar(t)}</span>
      <div>
        <div class="l1"><b>$${esc(c.symbol)}</b><span class="name">${esc(c.name)}</span>
          <span class="tag mom">⚡ Momentum</span>${migrated ? '<span class="tag mig">Migrated</span>' : ""}
          ${wallet.data?.positions[c.mint] ? '<span class="tag good">you hold</span>' : ""}</div>
        <div class="meta"><span>${fmt.age((Date.now() - c.t) / 1000)} ago</span>
          <span>MC at call <b>${fmt.usd(c.mcAtCall)}</b></span><span>MC now <b>${fmt.usd(c.now)}</b></span>
          <span>${esc(c.reason)}</span></div>
      </div>
      <div class="call-right">
        <span class="x ${x >= 1 ? "up" : "down"}">${x >= 1 ? "▲" : "▼"} x${x.toFixed(2)}</span>
        <span class="peak">peak x${peak.toFixed(2)}</span>
        <div class="call-btns">
          <button class="snipe" data-snipe="${c.mint}" aria-label="Paper buy ${amt} SOL of ${esc(c.symbol)}">Snipe ${amt}</button>
          <a class="ext" href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener">pump.fun</a>
        </div>
      </div>
    </li>`;
  }).join("") : `<li class="empty">No calls in this time range yet. Keep Vortex open and calls will appear here as tokens pass the rules.</li>`;
}

function renderCalls() {
  if (!$("#p-calls").classList.contains("on")) return;
  const list = inRange();
  renderCallStats(list); renderTests(list); renderCallList(list);
}

// keep prices fresh for called tokens that have dropped off the home board
async function pollCallPrices() {
  const ids = feed.calls.filter((c) => Date.now() - c.t < 30 * 86400e3 && !(feed.get(c.mint)?.lastDex > Date.now() - 10000))
    .slice(0, 50).map((c) => c.mint);
  if (!ids.length) return;
  try {
    const j = await (await fetch(JUP + ids.join(","))).json();
    for (const [mint, v] of Object.entries(j)) {
      const c = feed.calls.find((x) => x.mint === mint);
      if (c && v?.usdPrice) trackCall(c, v.usdPrice * 1e9);
    }
    renderCalls();
  } catch {}
}
setInterval(() => document.visibilityState === "visible" && pollCallPrices(), 6000);

// ---------- controls ----------
$("#r-age").textContent = CALL_RULES.maxAgeMin;
$("#r-mc").textContent = fmt.usd(CALL_RULES.minMcUsd);
$("#r-buys").textContent = CALL_RULES.minBuys5m;
$("#r-dev").textContent = CALL_RULES.maxDevPct;
$("#c-amt").value = store.get("quick", 0.1);
$("#c-amt").addEventListener("change", renderCalls);

function seg(id, attr, key, after) {
  $$("#" + id + " button").forEach((b) => b.classList.toggle("on", b.dataset[attr] == cp[key]));
  $("#" + id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    cp[key] = b.dataset[attr]; after?.();
    $$("#" + id + " button").forEach((x) => x.classList.toggle("on", x === b));
    renderCalls();
  });
}
seg("c-sort", "s", "sort");
seg("c-range", "r", "range", () => store.set("callRange", +cp.range));

const alertBtn = $("#c-alerts");
function paintAlerts() { alertBtn.textContent = notify.on() ? "🔔 Alerts on" : "🔕 Turn on alerts"; alertBtn.classList.toggle("on", notify.on()); }
alertBtn.addEventListener("click", async () => { await notify.toggle(); paintAlerts(); });
paintAlerts();

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-snipe]");
  if (!b) return;
  e.stopPropagation();
  const c = feed.calls.find((x) => x.mint === b.dataset.snipe);
  let t = feed.get(b.dataset.snipe);
  if (!t && c) t = upsert(c.mint, { symbol: c.symbol, name: c.name, image: c.image, created: c.t });
  if (t && !t.priceSol && c?.now && feed.solUsd) t.priceSol = c.now / 1e9 / feed.solUsd;
  if (t && wallet.buy(t, $("#c-amt").value)) renderCalls();
}, true);

feed.on(renderCalls);
setInterval(renderCalls, 2000);
pages.calls = { open() { stopToken(); paintAlerts(); renderCalls(); pollCallPrices(); } };

route();
