// Vortex core: helpers, saved settings, paper wallet and page switching.
// Everything is kept in the browser (localStorage). No real money is ever used.
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const FEE = 0.01; // Vortex fee: 1% on every paper buy and sell

const store = {
  get(k, d) { try { const v = localStorage.getItem("vx-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("vx-" + k, JSON.stringify(v)); } catch {} },
};

const fmt = {
  usd(n) {
    if (n == null || isNaN(n)) return "–";
    const a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toFixed(a < 10 ? 2 : 0);
  },
  sol(n, d = 3) { return n == null || isNaN(n) ? "–" : (+n).toFixed(d); },
  age(sec) {
    if (sec == null) return "–";
    if (sec < 60) return Math.floor(sec) + "s";
    if (sec < 3600) return Math.floor(sec / 60) + "m";
    if (sec < 86400) return Math.floor(sec / 3600) + "h";
    return Math.floor(sec / 86400) + "d";
  },
  pct(n) {
    if (n == null || isNaN(n)) return "–";
    const arrow = n >= 0 ? "▲" : "▼";
    return arrow + " " + Math.abs(n).toFixed(1) + "%";
  },
  short(a) { return a ? a.slice(0, 4) + "…" + a.slice(-4) : ""; },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 2600);
}

// ---------- sound ----------
const sound = {
  on: store.get("sound", true),
  ctx: null,
  beep(freq = 880, len = 0.12) {
    if (!this.on) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = freq; o.type = "triangle";
      g.gain.setValueAtTime(0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + len);
      o.connect(g).connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + len);
    } catch {}
  },
  buy() { this.beep(660); setTimeout(() => this.beep(990), 90); },
  sell() { this.beep(520); setTimeout(() => this.beep(390), 90); },
  call() { this.beep(1046, 0.18); setTimeout(() => this.beep(1318, 0.22), 140); },
};

// ---------- paper wallet ----------
const wallet = {
  data: store.get("wallet", null), // { start, balance, positions:{mint:{...}}, trades:[] }
  save() { store.set("wallet", this.data); updateTopBalance(); },
  ready() { return !!this.data; },
  begin(amount) {
    this.data = { start: amount, balance: amount, positions: {}, trades: [], created: Date.now() };
    this.save();
  },
  reset() { this.data = null; store.set("wallet", null); askStart(); },
  // price is SOL per token
  buy(tok, sol) {
    if (!this.ready()) { askStart(); return false; }
    sol = +sol;
    if (!(sol > 0)) { toast("Enter a quick buy amount above 0"); return false; }
    if (sol > this.data.balance + 1e-9) { toast("Not enough pretend SOL. Balance is " + fmt.sol(this.data.balance)); return false; }
    const price = tok.priceSol;
    if (!(price > 0)) { toast("No price for this token yet, try again in a second"); return false; }
    const fee = sol * FEE, tokens = (sol - fee) / price;
    const p = this.data.positions[tok.mint] ||= { mint: tok.mint, symbol: tok.symbol, name: tok.name, image: tok.image, tokens: 0, cost: 0 };
    p.tokens += tokens; p.cost += sol;
    this.data.balance -= sol;
    this.data.trades.unshift({ t: Date.now(), side: "buy", mint: tok.mint, symbol: tok.symbol, sol, tokens, price, fee });
    this.save();
    sound.buy();
    toast(`Paper bought ${fmt.sol(sol, 2)} SOL of ${tok.symbol} (fee ${fmt.sol(fee, 4)} SOL)`);
    return true;
  },
  sell(tok, fraction = 1) {
    const p = this.data?.positions[tok.mint];
    if (!p) return false;
    const price = tok.priceSol;
    if (!(price > 0)) { toast("No price for this token yet"); return false; }
    const tokens = p.tokens * fraction, gross = tokens * price, fee = gross * FEE, sol = gross - fee;
    p.tokens -= tokens; p.cost *= 1 - fraction;
    if (p.tokens <= 1e-9) delete this.data.positions[tok.mint];
    this.data.balance += sol;
    this.data.trades.unshift({ t: Date.now(), side: "sell", mint: tok.mint, symbol: tok.symbol, sol, tokens, price, fee });
    this.save();
    sound.sell();
    toast(`Paper sold ${tok.symbol} for ${fmt.sol(sol, 3)} SOL`);
    return true;
  },
  // value of open positions using latest known prices
  value(getTok) {
    let v = 0;
    for (const p of Object.values(this.data?.positions || {})) {
      const t = getTok(p.mint);
      if (t?.priceSol) v += p.tokens * t.priceSol;
    }
    return v;
  },
};

// take profit / stop loss, checked every time prices update
wallet.setOrder = function (mint, tp, sl) {
  this.data.orders ||= {};
  if (!tp && !sl) delete this.data.orders[mint];
  else this.data.orders[mint] = { tp: tp || null, sl: sl || null };
  this.save();
};
wallet.checkOrders = function (getTok) {
  const o = this.data?.orders;
  if (!o) return;
  for (const [mint, ord] of Object.entries(o)) {
    const p = this.data.positions[mint], t = getTok(mint);
    if (!p) { delete o[mint]; continue; }
    if (!t?.priceSol || !p.cost) continue;
    const x = (p.tokens * t.priceSol * (1 - FEE)) / p.cost;
    const hitTp = ord.tp && x >= ord.tp, hitSl = ord.sl && x <= 1 - ord.sl / 100;
    if (hitTp || hitSl) {
      delete o[mint];
      this.sell(t, 1);
      const msg = `${hitTp ? "Take profit" : "Stop loss"} sold ${t.symbol} at x${x.toFixed(2)}`;
      toast(msg); notify.send("Vortex " + (hitTp ? "take profit" : "stop loss"), msg, t.image);
    }
  }
};

function updateTopBalance() {
  $("#btn-balance").textContent = wallet.ready() ? fmt.sol(wallet.data.balance, 2) + " SOL" : "– SOL";
}

function askStart() {
  const dlg = $("#start-dlg");
  if (!dlg.open) dlg.showModal();
}
$$("#start-dlg .presets button").forEach((b) => b.addEventListener("click", () => ($("#start-amt").value = b.dataset.v)));
$("#start-form").addEventListener("submit", (e) => {
  const v = +$("#start-amt").value;
  if (!(v >= 0.1)) { e.preventDefault(); toast("Pick at least 0.1 SOL"); return; }
  wallet.begin(v);
  toast(`You have ${v} pretend SOL. Good luck`);
});
$("#start-dlg").addEventListener("cancel", (e) => e.preventDefault());
$("#btn-balance").addEventListener("click", () => {
  if (!wallet.ready()) return askStart();
  if (confirmReset()) wallet.reset();
});
function confirmReset() {
  return window.confirm(`Paper balance ${fmt.sol(wallet.data.balance, 3)} SOL (started with ${wallet.data.start}).\n\nPress OK to reset and pick a new starting amount, or Cancel to keep going.`);
}

// ---------- settings buttons ----------
const soundBtn = $("#btn-sound");
function paintSound() { soundBtn.setAttribute("aria-pressed", sound.on); soundBtn.textContent = sound.on ? "🔊" : "🔇"; }
soundBtn.addEventListener("click", () => { sound.on = !sound.on; store.set("sound", sound.on); paintSound(); });
paintSound();

const textBtn = $("#btn-text");
function paintText() { const on = store.get("big", false); document.documentElement.classList.toggle("big", on); textBtn.setAttribute("aria-pressed", on); }
textBtn.addEventListener("click", () => { store.set("big", !store.get("big", false)); paintText(); });
paintText();

const more = $(".more"), moreBtn = $(".more-btn");
moreBtn.addEventListener("click", (e) => { e.stopPropagation(); const o = more.classList.toggle("open"); moreBtn.setAttribute("aria-expanded", o); });
document.addEventListener("click", () => { more.classList.remove("open"); moreBtn.setAttribute("aria-expanded", false); });

// ---------- browser alerts ----------
const notify = {
  on() { return "Notification" in window && Notification.permission === "granted" && store.get("notify", true); },
  paint() { $("#btn-notify").textContent = this.on() ? "🔔 Alerts on" : "🔕 Alerts off"; },
  async toggle() {
    if (!("Notification" in window)) return toast("This browser does not support alerts");
    if (Notification.permission !== "granted") {
      const r = await Notification.requestPermission();
      if (r !== "granted") return toast("Alerts were blocked in the browser settings");
      store.set("notify", true);
    } else store.set("notify", !store.get("notify", true));
    this.paint();
  },
  send(title, body, icon) {
    if (!this.on()) return;
    try { new Notification(title, { body, icon: icon || "img/logo.svg" }); } catch {}
  },
};
$("#btn-notify").addEventListener("click", () => notify.toggle());
notify.paint();
$("#btn-chat").addEventListener("click", () => { location.hash = "#help"; toast("Live chat is on the help page"); });

// ---------- router ----------
const pages = {};
function route() {
  let h = location.hash.slice(1) || "home";
  let arg = null;
  if (h.startsWith("token=")) { arg = h.slice(6); h = "token"; }
  if (!$("#p-" + h)) h = "home";
  $$(".page").forEach((p) => p.classList.toggle("on", p.id === "p-" + h));
  $$(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.page === h));
  pages[h]?.open?.(arg);
}
window.addEventListener("hashchange", route);

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#search").focus(); }
});

updateTopBalance();
