// Vortex filters: Axiom style filters for each home column, with presets, export, import and share.
"use strict";

const COLS = [["new", "New"], ["stretch", "Final stretch"], ["migrated", "Migrated"]];
const PROTOCOLS = [["pump", "Pump"], ["bonk", "Bonk"], ["pumpswap", "PumpSwap"], ["raydium", "Raydium"], ["meteora", "Meteora"], ["orca", "Orca"]];
// [key, label, unit, help]
const RANGES = {
  audit: [
    ["Token", [["age", "Age", "min", "How long ago the token was made"]]],
    ["Holders", [["top10", "Top 10 holders %", "%"], ["devPct", "Dev bought at launch %", "%"], ["snipers", "Snipers %", "%"],
      ["insiders", "Insiders %", "%"], ["bundle", "Bundle holding %", "%"], ["bots", "Bot holders %", "%"], ["holders", "Holders", ""]]],
    ["Dev", [["devMigrations", "Dev migrations", ""], ["devMints", "Dev tokens made", ""], ["devAge", "Dev wallet funded", "min ago"]]],
  ],
  metrics: [
    ["Market", [["liqUsd", "Liquidity", "$"], ["vol5m", "Volume 5m", "$"], ["mcUsd", "Market cap", "$"], ["progress", "Bonding curve %", "%"],
      ["fees", "Total fees paid", "SOL"], ["txns", "Txns 5m", ""], ["buys5m", "Buys 5m", ""], ["sells5m", "Sells 5m", ""], ["traders5m", "Traders 5m", ""]]],
  ],
};
const TOGGLES = {
  audit: [["mintOff", "Mint authority off"], ["freezeOff", "Freeze authority off"], ["origLogo", "Original logo only"], ["called", "Vortex calls only"], ["noRisky", "Hide risky"]],
  socials: [["x", "Has X / Twitter"], ["web", "Has website"], ["tg", "Has Telegram"], ["anySocial", "At least one social"], ["noSocial", "No socials"], ["dexPaid", "Dex paid"]],
};
const blank = () => ({ kwIn: [], kwOut: [], proto: [], range: {}, on: {} });
const flt = {
  cols: Object.fromEntries(COLS.map(([k]) => [k, { ...blank(), ...store.get("flt-" + k, {}) }])),
  edit: "new", tab: "protocols", draft: null, applyAll: false, saveMode: false,
};

// ---------- matching ----------
function value(t, k) {
  if (k === "age") return (Date.now() - t.created) / 60000;
  if (k === "devAge") return t.devFundedAt ? (Date.now() - t.devFundedAt) / 60000 : null;
  if (k === "txns") return t.buys5m == null ? null : (t.buys5m || 0) + (t.sells5m || 0);
  if (k === "progress") return t.migrated ? 100 : t.curve ?? t.progress;
  return t[k];
}
function protoOf(t) {
  if (!t.migrated) return t.src;
  const d = (t.dexId || "pumpswap").toLowerCase();
  return PROTOCOLS.find(([k]) => d.includes(k))?.[0] || d;
}
function passFilter(t, col) {
  const f = flt.cols[col];
  if (!f) return true;
  const text = `${t.symbol} ${t.name}`.toLowerCase();
  if (f.kwIn.length && !f.kwIn.some((k) => text.includes(k))) return false;
  if (f.kwOut.some((k) => text.includes(k))) return false;
  if (f.proto.length && !f.proto.includes(protoOf(t))) return false;
  for (const [k, [mn, mx]] of Object.entries(f.range)) {
    const v = value(t, k);
    if (mn == null && mx == null) continue;
    if (v == null) return false; // no data yet, so it cannot pass a filter on it
    if (mn != null && v < mn) return false;
    if (mx != null && v > mx) return false;
  }
  const on = f.on, s = t.socials || {};
  if (on.mintOff && t.mintOff !== true) return false;
  if (on.freezeOff && t.freezeOff !== true) return false;
  if (on.origLogo && t.iconReused !== false) return false;
  if (on.called && !feed.calls.some((c) => c.mint === t.mint)) return false;
  if (on.noRisky && risky(t)) return false;
  if (on.x && !s.x) return false;
  if (on.web && !s.web) return false;
  if (on.tg && !s.tg) return false;
  if (on.anySocial && !(s.x || s.web || s.tg)) return false;
  if (on.noSocial && (s.x || s.web || s.tg)) return false;
  if (on.dexPaid && !t.dexPaid) return false;
  return true;
}
function countActive(f, part) {
  const n = (keys) => keys.filter(([k]) => f.on[k]).length;
  const audKeys = RANGES.audit.flatMap(([, rows]) => rows.map(([k]) => k));
  const metKeys = RANGES.metrics.flatMap(([, rows]) => rows.map(([k]) => k));
  const inR = (keys) => keys.filter((k) => f.range[k] && (f.range[k][0] != null || f.range[k][1] != null)).length;
  const parts = { protocols: f.proto.length, audit: inR(audKeys) + n(TOGGLES.audit), metrics: inR(metKeys), socials: n(TOGGLES.socials),
    keywords: f.kwIn.length + f.kwOut.length };
  return part ? parts[part] : Object.values(parts).reduce((a, b) => a + b, 0);
}

// ---------- panel ----------
document.body.insertAdjacentHTML("beforeend", `
<div class="flt-veil" id="flt-veil" hidden></div>
<aside class="flt" id="flt" hidden role="dialog" aria-modal="true" aria-labelledby="flt-h">
  <div class="flt-top">
    <h2 id="flt-h">Filters</h2>
    <div class="flt-tools">
      <span class="flt-slots" role="group" aria-label="Presets">${[1, 2, 3].map((i) => `<button class="slot" data-slot="${i}" title="Load preset ${i}">${i}</button>`).join("")}</span>
      <button class="ic" id="flt-save" title="Save these filters as a preset">Save</button>
      <button class="ic" id="flt-export" title="Download filters as a file" aria-label="Download filters">⬇</button>
      <label class="ic" title="Load filters from a file" aria-label="Load filters">⬆<input type="file" id="flt-import" accept=".json,application/json" hidden></label>
      <button class="ic" id="flt-share" title="Copy a link with these filters" aria-label="Share filters">🔗</button>
      <button class="ic" id="flt-close" aria-label="Close filters">✕</button>
    </div>
  </div>
  <div class="flt-cols"><div class="flt-coltabs" role="tablist" aria-label="Column">${COLS.map(([k, l]) => `<button role="tab" data-fcol="${k}">${l} <span class="cnt"></span></button>`).join("")}</div>
    <button class="ic" id="flt-reset" title="Clear every filter on this column" aria-label="Reset filters">↺</button></div>
  <div class="flt-kw">
    <label>Search keywords<input id="kw-in" placeholder="Type a word, press Enter"></label>
    <label>Exclude keywords<input id="kw-out" placeholder="Type a word, press Enter"></label>
    <div class="kw-chips" id="kw-chips"></div>
  </div>
  <input class="flt-find" id="flt-find" type="search" placeholder="Search filters" aria-label="Search filters">
  <div class="flt-tabs" role="tablist" aria-label="Filter group">
    ${[["protocols", "Protocols"], ["audit", "Audit"], ["metrics", "$ Metrics"], ["socials", "Socials"]].map(([k, l]) => `<button role="tab" data-ftab="${k}">${l} <span class="cnt"></span></button>`).join("")}
  </div>
  <div class="flt-body" id="flt-body"></div>
  <div class="flt-foot">
    <label class="ck"><input type="checkbox" id="flt-all"> Apply to all three columns</label>
    <button class="primary" id="flt-apply">Apply filters</button>
  </div>
</aside>`);

const clone = (o) => JSON.parse(JSON.stringify(o));
function openFilters(col) {
  flt.edit = col || flt.edit;
  flt.draft = clone(flt.cols[flt.edit]);
  $("#flt").hidden = false; $("#flt-veil").hidden = false;
  paintFilters();
  $("#kw-in").focus();
}
function closeFilters() { $("#flt").hidden = true; $("#flt-veil").hidden = true; flt.saveMode = false; }
function rangeRow([k, label, unit]) {
  const [mn, mx] = flt.draft.range[k] || [];
  return `<div class="fr" data-label="${esc(label.toLowerCase())}"><span class="fr-l">${esc(label)}${unit ? ` <small class="muted">(${esc(unit)})</small>` : ""}</span>
    <input type="number" inputmode="decimal" data-r="${k}" data-i="0" placeholder="Min" value="${mn ?? ""}" aria-label="${esc(label)} minimum">
    <input type="number" inputmode="decimal" data-r="${k}" data-i="1" placeholder="Max" value="${mx ?? ""}" aria-label="${esc(label)} maximum"></div>`;
}
function toggleBtn([k, label]) {
  return `<button class="tg${flt.draft.on[k] ? " on" : ""}" data-tg="${k}" aria-pressed="${!!flt.draft.on[k]}" data-label="${esc(label.toLowerCase())}">${esc(label)}</button>`;
}
function paintFilters() {
  const d = flt.draft;
  $$("[data-fcol]").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.fcol === flt.edit);
    const n = countActive(b.dataset.fcol === flt.edit ? d : flt.cols[b.dataset.fcol]);
    b.querySelector(".cnt").textContent = n || "";
  });
  $$("[data-ftab]").forEach((b) => { b.setAttribute("aria-selected", b.dataset.ftab === flt.tab); b.querySelector(".cnt").textContent = countActive(d, b.dataset.ftab) || ""; });
  $("#kw-chips").innerHTML = d.kwIn.map((k, i) => `<button class="kw" data-kw="in" data-i="${i}" aria-label="Remove ${esc(k)}">${esc(k)} ✕</button>`).join("")
    + d.kwOut.map((k, i) => `<button class="kw out" data-kw="out" data-i="${i}" aria-label="Remove excluded ${esc(k)}">not ${esc(k)} ✕</button>`).join("");
  $$(".slot").forEach((b) => { b.classList.toggle("has", !!store.get("fltPreset" + b.dataset.slot, null)); b.classList.toggle("saving", flt.saveMode); });
  $("#flt-save").classList.toggle("on", flt.saveMode);
  $("#flt-save").textContent = flt.saveMode ? "Pick 1, 2 or 3" : "Save";
  $("#flt-all").checked = flt.applyAll;
  const body = $("#flt-body");
  if (flt.tab === "protocols") {
    const seen = new Set([...feed.tokens.values()].map(protoOf));
    body.innerHTML = `<div class="fgroup"><div class="fg-h"><h3>Protocols</h3><button class="chip small-chip" id="proto-all">${d.proto.length ? "Select all" : "None picked means all"}</button></div>
      <div class="protos">${PROTOCOLS.map(([k, l]) => `<button class="tg proto p-${k}${d.proto.includes(k) ? " on" : ""}" data-proto="${k}" aria-pressed="${d.proto.includes(k)}" data-label="${l.toLowerCase()}">${l}${seen.has(k) ? "" : ' <small class="muted">none yet</small>'}</button>`).join("")}</div>
      <p class="small muted">Vortex gets new launches from Pump and Bonk. Migrated tokens show the pool they moved to.</p></div>`;
  } else if (flt.tab === "socials") {
    body.innerHTML = `<div class="fgroup"><div class="fg-h"><h3>Socials</h3></div><div class="tgs">${TOGGLES.socials.map(toggleBtn).join("")}</div></div>`;
  } else {
    const groups = RANGES[flt.tab];
    body.innerHTML = (flt.tab === "audit" ? `<div class="fgroup"><div class="fg-h"><h3>Token audit</h3></div><div class="tgs">${TOGGLES.audit.map(toggleBtn).join("")}</div></div>` : "")
      + groups.map(([g, rows]) => `<div class="fgroup"><div class="fg-h"><h3>${g}</h3></div>${rows.map(rangeRow).join("")}</div>`).join("");
  }
  findFilters();
}
function findFilters() {
  const q = $("#flt-find").value.trim().toLowerCase();
  $$("#flt-body [data-label]").forEach((el) => (el.style.display = !q || el.dataset.label.includes(q) ? "" : "none"));
}
function readRanges() {
  $$("#flt-body [data-r]").forEach((i) => {
    const k = i.dataset.r, r = (flt.draft.range[k] ||= [null, null]);
    r[+i.dataset.i] = i.value === "" ? null : +i.value;
    if (r[0] == null && r[1] == null) delete flt.draft.range[k];
  });
}
function applyFilters() {
  readRanges();
  const targets = flt.applyAll ? COLS.map(([k]) => k) : [flt.edit];
  for (const c of targets) { flt.cols[c] = clone(flt.draft); store.set("flt-" + c, flt.cols[c]); }
  paintColumnButtons(); renderHome();
  toast(`Filters applied to ${flt.applyAll ? "all columns" : COLS.find(([k]) => k === flt.edit)[1]}`);
  closeFilters();
}

// ---------- events ----------
$("#flt").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.fcol) { readRanges(); flt.edit = b.dataset.fcol; flt.draft = clone(flt.cols[flt.edit]); paintFilters(); }
  else if (b.dataset.ftab) { readRanges(); flt.tab = b.dataset.ftab; paintFilters(); }
  else if (b.dataset.tg) { flt.draft.on[b.dataset.tg] = !flt.draft.on[b.dataset.tg]; if (b.dataset.tg === "anySocial") flt.draft.on.noSocial = false; if (b.dataset.tg === "noSocial") flt.draft.on.anySocial = false; readRanges(); paintFilters(); }
  else if (b.dataset.proto) { const p = flt.draft.proto, k = b.dataset.proto; p.includes(k) ? p.splice(p.indexOf(k), 1) : p.push(k); paintFilters(); }
  else if (b.id === "proto-all") { flt.draft.proto = []; paintFilters(); }
  else if (b.dataset.kw) { (b.dataset.kw === "in" ? flt.draft.kwIn : flt.draft.kwOut).splice(+b.dataset.i, 1); paintFilters(); }
  else if (b.dataset.slot) {
    readRanges();
    const key = "fltPreset" + b.dataset.slot;
    if (flt.saveMode) { flt.cols[flt.edit] = clone(flt.draft); store.set(key, clone(flt.cols)); flt.saveMode = false; toast(`Saved as preset ${b.dataset.slot}`); paintFilters(); return; }
    const p = store.get(key, null);
    if (!p) return toast(`Preset ${b.dataset.slot} is empty. Press Save, then ${b.dataset.slot}`);
    for (const [c] of COLS) { flt.cols[c] = { ...blank(), ...p[c] }; store.set("flt-" + c, flt.cols[c]); }
    flt.draft = clone(flt.cols[flt.edit]); paintFilters(); paintColumnButtons(); renderHome(); toast(`Preset ${b.dataset.slot} loaded`);
  }
  else if (b.id === "flt-save") { flt.saveMode = !flt.saveMode; paintFilters(); }
  else if (b.id === "flt-reset") { flt.draft = blank(); paintFilters(); }
  else if (b.id === "flt-apply") applyFilters();
  else if (b.id === "flt-close") closeFilters();
  else if (b.id === "flt-export") {
    readRanges(); flt.cols[flt.edit] = clone(flt.draft);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ vortexFilters: 1, cols: flt.cols }, null, 1)], { type: "application/json" }));
    a.download = "vortex-filters.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  else if (b.id === "flt-share") {
    readRanges(); flt.cols[flt.edit] = clone(flt.draft);
    const link = location.origin + location.pathname + "?filters=" + encodeURIComponent(btoa(JSON.stringify(flt.cols)));
    navigator.clipboard?.writeText(link).then(() => toast("Link copied. Anyone who opens it gets these filters"), () => toast("Could not copy the link"));
  }
});
$("#flt-import").addEventListener("change", async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (j.vortexFilters !== 1) throw 0;
    for (const [c] of COLS) if (j.cols[c]) { flt.cols[c] = { ...blank(), ...j.cols[c] }; store.set("flt-" + c, flt.cols[c]); }
    flt.draft = clone(flt.cols[flt.edit]); paintFilters(); paintColumnButtons(); renderHome(); toast("Filters loaded");
  } catch { toast("That is not a Vortex filters file"); }
  e.target.value = "";
});
function addKeyword(input, list) {
  const v = input.value.trim().toLowerCase();
  if (v && !list.includes(v)) list.push(v);
  input.value = ""; paintFilters();
}
$("#kw-in").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(e.target, flt.draft.kwIn); } });
$("#kw-out").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(e.target, flt.draft.kwOut); } });
$("#flt-find").addEventListener("input", findFilters);
$("#flt-all").addEventListener("change", (e) => (flt.applyAll = e.target.checked));
$("#flt-veil").addEventListener("click", closeFilters);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#flt").hidden) closeFilters(); });

// filter button in each column header
for (const [k] of COLS) {
  const head = $(`.board .col[data-col="${k}"] .col-head`);
  head.insertAdjacentHTML("beforeend", `<button class="flt-btn" data-open-flt="${k}" aria-label="Filters for this column" title="Filters">⚙<span class="dot"></span></button>`);
}
function paintColumnButtons() {
  $$("[data-open-flt]").forEach((b) => {
    const n = countActive(flt.cols[b.dataset.openFlt]);
    b.classList.toggle("active", n > 0);
    b.title = n ? `${n} filter${n > 1 ? "s" : ""} on` : "Filters";
  });
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-open-flt]"); if (b) { e.stopPropagation(); openFilters(b.dataset.openFlt); } });
$("#btn-filters").addEventListener("click", () => openFilters(home.view === "discover" ? "new" : home.mobileCol || "new"));
paintColumnButtons();

// filters shared by link
(function () {
  try {
    const q = new URLSearchParams(location.search).get("filters");
    if (!q) return;
    const cols = JSON.parse(atob(q));
    for (const [c] of COLS) if (cols[c]) { flt.cols[c] = { ...blank(), ...cols[c] }; store.set("flt-" + c, flt.cols[c]); }
    paintColumnButtons();
    history.replaceState(null, "", location.pathname + location.hash);
    setTimeout(() => toast("Shared filters loaded"), 800);
  } catch {}
})();
