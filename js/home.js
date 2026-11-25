// Vortex home page: live new / final stretch / migrated columns, signals list and quick buy.
"use strict";

const home = {
  src: "all",
  safe: store.get("safe", false),
  stars: new Set(store.get("stars", [])),
  q: { new: "", stretch: "", migrated: "" },
  mobileCol: "new",
};

function avatar(t, cls = "") {
  const letter = esc((t.symbol || "?")[0].toUpperCase());
  return t.image
    ? `<img class="${cls}" src="${esc(t.image)}" alt="${esc(t.symbol)} logo" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;ph ${cls}&quot;>${letter}</span>'">`
    : `<span class="ph ${cls}">${letter}</span>`;
}

function risky(t) {
  return (t.devPct || 0) >= 10 || (t.sells5m > 20 && t.sells5m > t.buys5m * 2);
}

function tagsFor(t) {
  const out = [];
  if (feed.calls.some((c) => c.mint === t.mint)) out.push('<span class="tag call">⚡ Vortex call</span>');
  if ((t.devPct || 0) >= 10) out.push(`<span class="tag bad">dev bought ${t.devPct.toFixed(0)}%</span>`);
  else if (t.devPct > 0) out.push(`<span class="tag good">dev ${t.devPct.toFixed(1)}%</span>`);
  if (t.sells5m > 20 && t.sells5m > t.buys5m * 2) out.push('<span class="tag bad">heavy selling</span>');
  if (!t.socials.x && !t.socials.tg && !t.socials.web && t.metaDone) out.push('<span class="tag">no socials</span>');
  if (wallet.data?.positions[t.mint]) out.push('<span class="tag good">you hold</span>');
  return out.join("");
}

function socials(s) {
  const a = [];
  if (s.x) a.push(`<a href="${esc(s.x)}" target="_blank" rel="noopener" title="X / Twitter" aria-label="X page">𝕏</a>`);
  if (s.tg) a.push(`<a href="${esc(s.tg)}" target="_blank" rel="noopener" title="Telegram" aria-label="Telegram">✈</a>`);
  if (s.web) a.push(`<a href="${esc(s.web)}" target="_blank" rel="noopener" title="Website" aria-label="Website">🌐</a>`);
  return a.join(" ");
}

function card(t, col) {
  const age = (Date.now() - t.created) / 1000;
  const pr = t.progress || 0;
  const ringC = t.migrated ? "#7aa7ff" : pr >= 70 ? "#ffb35c" : "#2fe0a0";
  const tot = (t.buys5m || 0) + (t.sells5m || 0);
  const bPct = tot ? Math.round((t.buys5m / tot) * 100) : 50;
  const mc = t.mcUsd ?? (t.mcSol && feed.solUsd ? t.mcSol * feed.solUsd : null);
  const mcCls = mc >= 30000 ? "hi" : mc >= 10000 ? "mid" : "";
  const fresh = t.fresh && Date.now() - t.fresh < 1500 ? " fresh" : "";
  const ch = t.ch5m;
  const amt = +$("#quick-amt").value || 0.1;
  return `<article class="card${fresh}" tabindex="0" data-open="${t.mint}" aria-label="${esc(t.symbol)} ${esc(t.name)}">
    <div>
      <div class="ring" style="--p:${pr.toFixed(0)}%;--rc:${ringC}" title="Bonding curve about ${pr.toFixed(0)}% full">
        ${avatar(t)}${t.migrated ? "" : `<span class="pct">${pr.toFixed(0)}%</span>`}
      </div>
      <span class="addr">${fmt.short(t.mint)}</span>
    </div>
    <div class="mid">
      <div class="l1">
        <span class="src ${t.src}">${t.src.toUpperCase()}</span>
        <b>${esc(t.symbol || "…")}</b><span class="name">${esc(t.name)}</span>
        <button class="mini" data-copy="${t.mint}" title="Copy address" aria-label="Copy address">⧉</button>
        <button class="mini${home.stars.has(t.mint) ? " on" : ""}" data-star="${t.mint}" title="Watchlist" aria-label="Add to watchlist">★</button>
      </div>
      <div class="l2">
        <span class="age${age > 300 ? " old" : ""}" title="Age">${fmt.age(age)}</span>
        <span class="soc">${socials(t.socials)}</span>
        ${ch != null ? `<span class="${ch >= 0 ? "up" : "down"} num" title="Price change 5 minutes">${fmt.pct(ch)}</span>` : ""}
      </div>
      <div class="tags">${tagsFor(t)}</div>
    </div>
    <div style="display:grid">
      <div class="box">
        <div class="row2"><span><small>V</small>${fmt.usd(t.vol5m)}</span><span><small>MC</small><b class="mc ${mcCls}">${fmt.usd(mc)}</b></span></div>
        <div class="row2"><span title="Liquidity"><small>L</small>${t.liqUsd != null ? fmt.usd(t.liqUsd) : "–"}</span>
          <span title="${t.buys5m || 0} buys / ${t.sells5m || 0} sells in 5 minutes"><small>TX</small>${tot} <i class="bs" style="--b:${bPct}%"></i></span></div>
      </div>
      <button class="qb" data-buy="${t.mint}" aria-label="Paper buy ${amt} SOL of ${esc(t.symbol)}">⚡ ${amt} SOL</button>
    </div>
  </article>`;
}

function renderColumns() {
  const lists = { new: [], stretch: [], migrated: [] };
  for (const t of feed.tokens.values()) {
    if (!t.symbol && !t.name) continue;
    if (home.src !== "all" && t.src !== home.src) continue;
    if (home.safe && risky(t)) continue;
    const col = column(t);
    const q = home.q[col];
    if (q && !(`${t.symbol} ${t.name} ${t.mint}`.toLowerCase().includes(q))) continue;
    lists[col].push(t);
  }
  lists.new.sort((a, b) => b.created - a.created);
  lists.stretch.sort((a, b) => b.progress - a.progress);
  lists.migrated.sort((a, b) => (b.migratedAt || 0) - (a.migratedAt || 0));
  for (const col of Object.keys(lists)) {
    const el = $("#c-" + col);
    $("#n-" + col).textContent = lists[col].length;
    el.innerHTML = lists[col].length
      ? lists[col].slice(0, 60).map((t) => card(t, col)).join("")
      : `<p class="empty">${feed.connected ? "Waiting for tokens…" : "Connecting to the live feed…"}</p>`;
  }
}

function renderFeed() {
  const el = $("#feed");
  if (!feed.calls.length) return;
  el.innerHTML = feed.calls.slice(0, 40).map((c) => {
    const t = feed.get(c.mint) || c;
    const x = c.peak && c.mcAtCall ? c.peak / c.mcAtCall : 1;
    return `<li class="sig" data-open="${c.mint}">
      <span class="av">${avatar(t)}</span>
      <div><b>${esc(c.symbol)}</b><span>${esc(c.reason)} · ${fmt.age((Date.now() - c.t) / 1000)} ago</span></div>
      <span class="amt ${x >= 1.2 ? "up" : ""}" title="Best gain since the call">x${x.toFixed(2)}</span>
    </li>`;
  }).join("");
}

function renderTicker() {
  const movers = [...feed.tokens.values()].filter((t) => t.ch5m != null && t.mcUsd > 5000)
    .sort((a, b) => Math.abs(b.ch5m) - Math.abs(a.ch5m)).slice(0, 14);
  if (!movers.length) return;
  const html = movers.map((t) => `<a class="tick" href="#token=${t.mint}">${avatar(t)} ${esc(t.symbol)}
    <span class="${t.ch5m >= 0 ? "up" : "down"} num">${fmt.pct(t.ch5m)}</span></a>`).join("");
  $("#ticker").innerHTML = html + html; // doubled so the scroll loops smoothly
}

function renderStatus() {
  $("#st-count").textContent = feed.tokens.size + " tokens tracked";
  if (wallet.ready()) {
    const total = wallet.data.balance + wallet.value((m) => feed.get(m));
    const pnl = total - wallet.data.start;
    const b = $("#btn-pnl");
    b.textContent = `PnL ${pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(pnl, 3)} SOL`;
    b.className = "st-btn pnl " + (pnl >= 0 ? "up" : "down");
  }
}

function renderHome() {
  if (!$("#p-home").classList.contains("on")) { renderStatus(); return; }
  renderColumns(); renderFeed(); renderTicker(); renderStatus();
}
feed.on(renderHome);
setInterval(renderHome, 1000); // keeps the ages ticking

// ---------- clicks ----------
document.addEventListener("click", (e) => {
  const buy = e.target.closest("[data-buy]");
  if (buy) {
    e.stopPropagation();
    const t = feed.get(buy.dataset.buy);
    if (t && wallet.buy(t, $("#quick-amt").value)) renderHome();
    return;
  }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    e.stopPropagation();
    navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast("Address copied"), () => toast("Could not copy"));
    return;
  }
  const st = e.target.closest("[data-star]");
  if (st) {
    e.stopPropagation();
    const m = st.dataset.star;
    home.stars.has(m) ? home.stars.delete(m) : home.stars.add(m);
    store.set("stars", [...home.stars]);
    renderHome();
    return;
  }
  if (e.target.closest("a")) return;
  const open = e.target.closest("[data-open]");
  if (open) location.hash = "#token=" + open.dataset.open;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.(".card")) location.hash = "#token=" + e.target.dataset.open;
});

$$(".chips .chip").forEach((b) => b.addEventListener("click", () => {
  home.src = b.dataset.src;
  $$(".chips .chip").forEach((x) => x.classList.toggle("on", x === b));
  renderHome();
}));
const safeBtn = $("#btn-safe");
function paintSafe() { safeBtn.setAttribute("aria-pressed", home.safe); }
safeBtn.addEventListener("click", () => { home.safe = !home.safe; store.set("safe", home.safe); paintSafe(); renderHome(); });
paintSafe();

$$(".col-search").forEach((i) => i.addEventListener("input", () => { home.q[i.dataset.for] = i.value.trim().toLowerCase(); renderHome(); }));
$("#quick-amt").value = store.get("quick", 0.1);
$("#quick-amt").addEventListener("change", (e) => { store.set("quick", +e.target.value || 0.1); renderHome(); });

// mobile column tabs
function paintMobile() {
  $$(".tabs-mobile button").forEach((b) => b.setAttribute("aria-selected", b.dataset.col === home.mobileCol));
  $$(".board .col[data-col]").forEach((c) => c.classList.toggle("show", c.dataset.col === home.mobileCol));
}
$$(".tabs-mobile button").forEach((b) => b.addEventListener("click", () => { home.mobileCol = b.dataset.col; paintMobile(); }));
paintMobile();

// top search: name, ticker or contract address
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#search").value.trim();
  if (!q) return;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) { location.hash = "#token=" + q; return; }
  const ql = q.toLowerCase();
  const hit = [...feed.tokens.values()].find((t) => t.symbol.toLowerCase() === ql)
    || [...feed.tokens.values()].find((t) => `${t.symbol} ${t.name}`.toLowerCase().includes(ql));
  if (hit) location.hash = "#token=" + hit.mint;
  else toast("No live token matches that. Paste a contract address to open any token");
});

// token page placeholder until page 2 is built
pages.token = {
  open(mint) {
    const t = feed.get(mint);
    $("#p-token h1").textContent = t ? `${t.symbol} · token page` : "Token page";
    $("#token-ext").href = t?.pairUrl || "https://dexscreener.com/solana/" + mint;
  },
};
pages.home = { open: renderHome };

// first visit: ask for a starting balance
if (!wallet.ready()) askStart();
route();
