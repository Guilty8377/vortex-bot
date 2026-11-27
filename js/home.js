// Vortex home page: live new / final stretch / migrated columns, signals list and quick buy.
"use strict";

const home = {
  src: "all",
  safe: store.get("safe", false),
  stars: new Set(store.get("stars", [])),
  q: { new: "", stretch: "", migrated: "" },
  mobileCol: "new",
  view: store.get("homeView", "trenches"),
  dtab: "trending", dsort: "vol5m",
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

// small holder stats like Axiom: green when low, amber when middling, pink when high
function statChips(t) {
  const lvl = (v, ok, mid) => (v <= ok ? "good" : v <= mid ? "mid" : "bad");
  const c = [];
  const add = (v, icon, title, ok, mid) => { if (v != null) c.push(`<span class="sc ${lvl(v, ok, mid)}" title="${title}">${icon} ${v.toFixed(v < 10 ? 1 : 0)}%</span>`); };
  add(t.top10, "👑", "Top 10 holders own", 25, 40);
  add(t.snipers, "🎯", "Snipers hold", 10, 25);
  add(t.insiders, "🕵", "Insiders hold", 10, 25);
  add(t.bundle, "📦", "Bundles hold", 10, 25);
  return c.length ? `<div class="scs">${c.join("")}</div>` : "";
}

function socials(s) {
  const a = [];
  if (s.x) a.push(`<a href="${esc(s.x)}" target="_blank" rel="noopener" title="X / Twitter" aria-label="X page">𝕏</a>`);
  if (s.tg) a.push(`<a href="${esc(s.tg)}" target="_blank" rel="noopener" title="Telegram" aria-label="Telegram">✈</a>`);
  if (s.web) a.push(`<a href="${esc(s.web)}" target="_blank" rel="noopener" title="Website" aria-label="Website">🌐</a>`);
  return a.join(" ");
}

function posInfo(t) {
  const p = wallet.data?.positions[t.mint];
  if (!p) return null;
  const value = t.priceSol ? p.tokens * t.priceSol * (1 - FEE) : null;
  const pnl = value != null ? value - p.cost : null;
  return { p, value, pnl, pct: pnl != null && p.cost ? (pnl / p.cost) * 100 : null };
}
function posRow(t) {
  const i = posInfo(t);
  if (!i) return "";
  const cls = i.pnl >= 0 ? "up" : "down";
  return `<div class="pos">
    <span>Holding <b class="num">${fmt.sol(i.value, 3)} SOL</b></span>
    <span class="${cls} num">${i.pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(i.pnl, 4)} SOL (${i.pct != null ? i.pct.toFixed(1) : "–"}%)</span>
    <button class="sell" data-sell="${t.mint}" data-f="0.5">Sell 50%</button>
    <button class="sell" data-sell="${t.mint}" data-f="1">Sell all</button>
  </div>`;
}

function card(t, col) {
  const age = (Date.now() - t.created) / 1000;
  const pr = t.progress || 0;
  const ringC = t.migrated ? "#8fb2ff" : pr >= 70 ? "#ffb547" : "#3ee0a7";
  const tot = (t.buys5m || 0) + (t.sells5m || 0);
  const bPct = tot ? Math.round((t.buys5m / tot) * 100) : 50;
  const mc = t.mcUsd ?? (t.mcSol && feed.solUsd ? t.mcSol * feed.solUsd : null);
  const mcCls = mc >= 30000 ? "hi" : mc >= 10000 ? "mid" : "";
  const fresh = t.fresh && Date.now() - t.fresh < 1500 ? " fresh" : "";
  const ch = t.ch5m ?? t.chSeen;
  const chTitle = t.ch5m != null ? "Price change in the last 5 minutes" : "Price change since Vortex first saw this token";
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
        ${ch != null ? `<span class="${ch >= 0 ? "up" : "down"} num" title="${chTitle}">${fmt.pct(ch)}${t.ch5m == null ? '<small class="muted"> new</small>' : ""}</span>` : ""}
        ${t.holders ? `<span title="Holders">👥 ${t.holders}</span>` : ""}
      </div>
      <div class="tags">${tagsFor(t)}</div>
      ${statChips(t)}
      ${posRow(t)}
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
    if (typeof passFilter === "function" && !passFilter(t, col)) continue;
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
      <div><b>${esc(c.symbol)}</b><span>${esc(c.reason)}, ${fmt.age((Date.now() - c.t) / 1000)} ago</span></div>
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
  $("#st-count").textContent = feed.tokens.size + " tracked";
  if (wallet.ready()) {
    const total = wallet.data.balance + wallet.value((m) => feed.get(m));
    const pnl = total - wallet.data.start;
    const b = $("#btn-pnl");
    b.textContent = `PnL ${pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(pnl, 3)} SOL`;
    b.className = "st-btn pnl " + (pnl >= 0 ? "up" : "down");
  }
}

function renderPnl() {
  const box = $("#pnl-panel");
  if (!box || box.hidden || !wallet.ready()) return;
  const held = Object.values(wallet.data.positions);
  const value = wallet.value((m) => feed.get(m));
  const total = wallet.data.balance + value, pnl = total - wallet.data.start;
  $("#pnl-sum").innerHTML = `
    <div><small>Balance</small><b class="num">${fmt.sol(wallet.data.balance, 3)} SOL</b></div>
    <div><small>In positions</small><b class="num">${fmt.sol(value, 3)} SOL</b></div>
    <div><small>Total PnL</small><b class="num ${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(pnl, 4)} SOL</b></div>`;
  $("#pnl-list").innerHTML = held.length ? held.map((p) => {
    const t = feed.get(p.mint) || { ...p, socials: {} };
    const i = posInfo(t) || { p, value: null, pnl: null, pct: null };
    return `<li data-open="${p.mint}">
      <span class="av">${avatar(t)}</span>
      <div><b>${esc(p.symbol)}</b><span class="num">cost ${fmt.sol(p.cost, 3)} · now ${fmt.sol(i.value, 3)} SOL</span></div>
      <span class="num ${i.pnl >= 0 ? "up" : "down"}">${i.pct != null ? (i.pnl >= 0 ? "▲ " : "▼ ") + Math.abs(i.pct).toFixed(1) + "%" : "–"}</span>
      <button class="sell" data-sell="${p.mint}" data-f="1">Sell</button>
    </li>`;
  }).join("") : '<li class="empty">No open positions. Use a ⚡ quick buy button on a token.</li>';
}
$("#btn-pnl").addEventListener("click", () => {
  if (!wallet.ready()) return askStart();
  const box = $("#pnl-panel");
  box.hidden = !box.hidden;
  renderPnl();
});
$("#pnl-close").addEventListener("click", () => ($("#pnl-panel").hidden = true));

// ---------- Discover table ----------
function renderDiscover() {
  const recent = store.get("recent", []);
  let list = [...feed.tokens.values()].filter((t) => t.symbol || t.name);
  if (home.src !== "all") list = list.filter((t) => t.src === home.src);
  if (home.safe) list = list.filter((t) => !risky(t));
  const tab = home.dtab;
  if (tab === "new") list = list.filter((t) => column(t) === "new");
  if (tab === "stretch") list = list.filter((t) => column(t) === "stretch");
  if (tab === "migrated") list = list.filter((t) => t.migrated);
  if (tab === "watch") list = list.filter((t) => home.stars.has(t.mint));
  if (tab === "recent") list = recent.map((m) => feed.get(m)).filter(Boolean);
  if (tab === "trending") list = list.filter((t) => (t.vol5m || 0) > 0);
  if (typeof passFilter === "function" && tab !== "watch" && tab !== "recent") list = list.filter((t) => passFilter(t, column(t)));
  const k = home.dsort;
  if (tab !== "recent") list.sort((a, b) => k === "age" ? b.created - a.created : (b[k] ?? -1e9) - (a[k] ?? -1e9));
  const amt = +$("#quick-amt").value || 0.1;
  const pc = (v) => v == null ? '<td class="muted">–</td>' : `<td class="num ${v >= 0 ? "up" : "down"}">${fmt.pct(v)}</td>`;
  $("#d-body").innerHTML = list.length ? list.slice(0, 120).map((t) => {
    const called = feed.calls.some((c) => c.mint === t.mint);
    return `<tr data-open="${t.mint}" tabindex="0">
      <td><button class="mini${home.stars.has(t.mint) ? " on" : ""}" data-star="${t.mint}" aria-label="Watchlist">★</button></td>
      <td><span class="tok"><span class="av">${avatar(t)}</span><span><b>${esc(t.symbol)}</b><br><small class="muted">${esc(t.name)}${t.migrated ? ", migrated" : ""}</small></span></span></td>
      <td class="num"><b>${fmt.usd(t.mcUsd)}</b></td><td class="num">${fmt.age((Date.now() - t.created) / 1000)}</td>
      ${pc(t.ch5m ?? t.chSeen)}${pc(t.ch1h)}
      <td class="num">${fmt.usd(t.vol5m)}</td><td class="num">${t.liqUsd != null ? fmt.usd(t.liqUsd) : "–"}</td>
      <td class="num"><span class="up">${t.buys5m ?? 0}</span> / <span class="down">${t.sells5m ?? 0}</span></td>
      <td class="num">${t.holders ?? "–"}</td>
      <td>${called ? '<span class="tag call">⚡ call</span>' : risky(t) ? '<span class="tag bad">risky</span>' : ""}${wallet.data?.positions[t.mint] ? '<span class="tag good">you hold</span>' : ""}</td>
      <td><button class="qb" data-buy="${t.mint}" aria-label="Paper buy ${amt} SOL of ${esc(t.symbol)}">⚡ ${amt}</button></td></tr>`;
  }).join("") : `<tr><td colspan="12" class="empty">${tab === "watch" ? "Your watchlist is empty. Press ★ on any token to add it." : tab === "recent" ? "Tokens you open will show here." : "No tokens yet."}</td></tr>`;
}
function paintView() {
  const d = home.view === "discover";
  $("#discover").hidden = !d; $("#board").hidden = d;
  $(".tabs-mobile").classList.toggle("off", d);
  $$("#home-view button").forEach((b) => b.classList.toggle("on", b.dataset.v === home.view));
  $$("#d-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === home.dtab));
}
$("#home-view").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  home.view = b.dataset.v; store.set("homeView", home.view); paintView(); renderHome();
});
$("#d-tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; home.dtab = b.dataset.t; paintView(); renderHome(); });
$("#d-sort").addEventListener("change", (e) => { home.dsort = e.target.value; renderHome(); });
$("#btn-watch").addEventListener("click", () => { home.view = "discover"; home.dtab = "watch"; store.set("homeView", "discover"); paintView(); renderHome(); });
paintView();

function renderHome() {
  if (!$("#p-home").classList.contains("on")) { renderStatus(); renderPnl(); renderTicker(); return; }
  if (home.view === "discover") renderDiscover(); else renderColumns();
  renderFeed(); renderTicker(); renderStatus(); renderPnl();
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
  const sl = e.target.closest("[data-sell]");
  if (sl) {
    e.stopPropagation();
    const t = feed.get(sl.dataset.sell);
    if (t && wallet.sell(t, +sl.dataset.f)) { renderHome(); renderPnl(); }
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

pages.home = { open: renderHome };

// first visit: ask for a starting balance
if (!wallet.ready()) askStart();
