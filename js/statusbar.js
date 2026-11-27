// Vortex bottom bar (Axiom style): presets, wallet, shortcuts, live BTC / ETH / SOL, feed health and settings.
"use strict";

const sb = { presets: store.get("presets", [0.1, 0.5, 1]), p: store.get("presetIdx", 0) };

// ---------- P1 / P2 / P3 trading presets ----------
function applyPreset() {
  $("#sb-preset").textContent = "P" + (sb.p + 1);
  $("#sb-preset").title = `Preset ${sb.p + 1}: quick buy ${sb.presets[sb.p]} SOL. Click to switch`;
  const q = $("#quick-amt");
  q.value = sb.presets[sb.p];
  q.dispatchEvent(new Event("change"));
}
$("#sb-preset").addEventListener("click", () => {
  sb.p = (sb.p + 1) % 3; store.set("presetIdx", sb.p); applyPreset();
  toast(`Preset ${sb.p + 1}: quick buy ${sb.presets[sb.p]} SOL`);
});
function paintPresetInputs() {
  $("#sb-pres").innerHTML = sb.presets.map((v, i) => `<label>P${i + 1}<input type="number" min="0.01" step="0.01" value="${v}" data-pre="${i}" aria-label="Preset ${i + 1} SOL"></label>`).join("");
}
$("#sb-pres").addEventListener("change", (e) => {
  const i = +e.target.dataset.pre, v = +e.target.value;
  if (!(v > 0)) return toast("Enter an amount above 0");
  sb.presets[i] = v; store.set("presets", sb.presets);
  if (i === sb.p) applyPreset();
});

// ---------- wallet chip ----------
function paintWallet() {
  if (!wallet.ready()) { $("#sb-bal").textContent = "–"; $("#sb-pos").textContent = ""; return; }
  $("#sb-bal").textContent = fmt.sol(wallet.data.balance, 2);
  const n = Object.keys(wallet.data.positions).length;
  $("#sb-pos").textContent = n ? `${n} open` : "";
}
$("#sb-wallet").addEventListener("click", () => $("#btn-pnl").click());

// ---------- shortcuts ----------
function goHome(fn) { if (location.hash && location.hash !== "#home") location.hash = "#home"; setTimeout(fn, 60); }
$("#sb-discover").addEventListener("click", () => goHome(() => { home.view = "discover"; home.dtab = "trending"; store.set("homeView", "discover"); paintView(); renderHome(); }));
$("#sb-watch").addEventListener("click", () => goHome(() => $("#btn-watch").click()));
$("#sb-filters").addEventListener("click", () => goHome(() => $("#btn-filters").click()));
$("#sb-bug").addEventListener("click", () => { location.hash = "#help"; setTimeout(() => document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth" }), 80); });
$("#sb-theme").addEventListener("click", () => $("#btn-theme").click());

// ---------- alerts bell ----------
const bell = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14a1.5 1.5 0 0 0 3 0"/></svg>`;
notify.paint = function () {
  const b = $("#btn-notify");
  b.innerHTML = bell;
  b.classList.toggle("on", this.on());
  b.title = this.on() ? "Alerts on, click to turn off" : "Alerts off, click to turn on";
  b.setAttribute("aria-pressed", this.on());
};
notify.paint();

// ---------- BTC / ETH / SOL prices (Solana versions on DexScreener) ----------
const MAJORS = { btc: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", eth: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", sol: SOL_MINT };
async function pollMajors() {
  try {
    const pairs = await (await fetch(DEX + Object.values(MAJORS).join(","))).json();
    for (const [k, mint] of Object.entries(MAJORS)) {
      const p = pairs.filter((x) => x.baseToken?.address === mint && x.priceUsd).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!p) continue;
      const price = +p.priceUsd, ch = p.priceChange?.h24;
      const el = k === "sol" ? $("#st-sol") : $("#pr-" + k);
      const txt = k === "sol" ? "$" + price.toFixed(2) : price >= 1000 ? "$" + (price / 1000).toFixed(1) + "K" : "$" + price.toFixed(0);
      el.innerHTML = `${txt}${ch != null ? ` <small class="${ch >= 0 ? "up" : "down"}">${ch >= 0 ? "▲" : "▼"}${Math.abs(ch).toFixed(1)}%</small>` : ""}`;
      if (k === "sol") { feed.solUsd = price; store.set("solUsd", price); }
    }
  } catch {}
}
pollMajors();
setInterval(() => document.visibilityState === "visible" && pollMajors(), 60000);

// ---------- feed health, launch rate and ping ----------
function paintHealth() {
  const now = Date.now(), h = feed.health;
  const set = (id, ok, warn, label) => { const d = $(id); d.className = "dot " + (ok ? "ok" : warn ? "warn" : "bad"); d.title = label; };
  set("#sb-dot-pump", feed.connected, false, feed.connected ? "PumpPortal connected" : "PumpPortal reconnecting");
  set("#sb-dot-dex", h.dex && now - h.dex < 15000, true, h.dex ? `DexScreener updated ${fmt.age((now - h.dex) / 1000)} ago` : "DexScreener waiting");
  const jupBusy = h.jupLimited && now - h.jupLimited < 20000;
  set("#sb-dot-jup", h.jup && now - h.jup < 30000 && !jupBusy, jupBusy || !h.jup, jupBusy ? "Jupiter busy, waiting a moment" : "Jupiter prices");
  feed.launches = feed.launches.filter((t) => now - t < 60000);
  $("#sb-rate").textContent = feed.connected ? feed.launches.length : "–";
  $("#sb-ping").textContent = feed.ping != null ? feed.ping + "ms" : "–";
  paintWallet();
}
setInterval(paintHealth, 1000);

// ---------- settings popover ----------
const pop = $("#sb-pop");
function paintSettings() {
  paintPresetInputs();
  $("#set-sound").checked = sound.on;
  $("#set-big").checked = store.get("big", false);
  $("#set-light").checked = store.get("light", false);
  $("#set-hk").checked = store.get("hotkeys", false);
}
$("#sb-gear").addEventListener("click", (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; if (!pop.hidden) paintSettings(); });
document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") pop.hidden = true; });
$("#set-sound").addEventListener("change", () => $("#btn-sound").click());
$("#set-big").addEventListener("change", () => $("#btn-text").click());
$("#set-light").addEventListener("change", () => $("#btn-theme").click());
$("#set-hk").addEventListener("change", (e) => { const c = $("#tk-hk"); c.checked = e.target.checked; c.dispatchEvent(new Event("change")); });
$("#sb-tour").addEventListener("click", () => { pop.hidden = true; startTour(); });

// keep the preset in sync if the quick buy box is typed in by hand
$("#quick-amt").addEventListener("input", (e) => {
  const v = +e.target.value, i = sb.presets.indexOf(v);
  if (i >= 0) { sb.p = i; $("#sb-preset").textContent = "P" + (i + 1); }
});
$("#sb-preset").textContent = "P" + (sb.p + 1);
paintHealth();
