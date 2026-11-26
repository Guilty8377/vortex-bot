// Vortex extras: light mode, first-visit tour, tester feedback form and backup / restore.
"use strict";

// ---------- light / dark mode ----------
const themeBtn = $("#btn-theme");
function paintTheme() {
  const light = store.get("light", false);
  document.documentElement.classList.toggle("light", light);
  themeBtn.setAttribute("aria-pressed", light);
  themeBtn.textContent = light ? "☾" : "☀";
  themeBtn.title = light ? "Switch to dark mode" : "Switch to light mode";
}
themeBtn.addEventListener("click", () => { store.set("light", !store.get("light", false)); paintTheme(); });
paintTheme();

// ---------- first-visit tour ----------
const TOUR = [
  ["#home-view", "Two ways to see tokens", "Trenches shows live new, final stretch and migrated columns. Discover turns them into a table you can sort."],
  [".quick", "Quick buy", "Set how much pretend SOL each ⚡ button spends. Every token card has one."],
  ["#feed-h", "Vortex signals", "Tokens the bot calls appear here, with how much they have gone up since."],
  ["#btn-pnl", "Your profit and loss", "Click PnL to see your positions and sell them. Your balance is in the top right."],
  ["#btn-chat", "Help is always here", "Open the help chat any time. The learn page has short lessons for beginners."],
];
const tour = { i: 0 };
function showTourStep() {
  const [sel, title, body] = TOUR[tour.i];
  let el = $(sel);
  if (!el || !el.offsetParent) el = null; // hidden on this screen size
  const hole = $("#tour-hole"), card = $("#tour-card");
  if (el) {
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    Object.assign(hole.style, { display: "block", left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
    const below = r.bottom + 180 < innerHeight;
    card.style.top = (below ? r.bottom + 14 : Math.max(10, r.top - 190)) + "px";
    card.style.left = Math.min(Math.max(10, r.left), innerWidth - 330) + "px";
  } else {
    hole.style.display = "none";
    card.style.top = "30%"; card.style.left = "calc(50% - 160px)";
  }
  $("#tour-n").textContent = `Tip ${tour.i + 1} of ${TOUR.length}`;
  $("#tour-t").textContent = title;
  $("#tour-b").textContent = body;
  $("#tour-next").textContent = tour.i === TOUR.length - 1 ? "Start trading" : "Next";
  $("#tour-next").focus();
}
function startTour() {
  if (location.hash && location.hash !== "#home") location.hash = "#home";
  tour.i = 0;
  setTimeout(() => { $("#tour").hidden = false; showTourStep(); }, 150);
}
function endTour() { $("#tour").hidden = true; store.set("toured", true); }
$("#tour-next").addEventListener("click", () => { if (++tour.i >= TOUR.length) endTour(); else showTourStep(); });
$("#tour-skip").addEventListener("click", endTour);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#tour").hidden) endTour(); });
window.addEventListener("resize", () => { if (!$("#tour").hidden) showTourStep(); });
$("#tour-again").addEventListener("click", startTour);
// run once, straight after the starting balance is picked
$("#start-form").addEventListener("submit", () => { if (!store.get("toured", false)) setTimeout(startTour, 400); });

// ---------- tester feedback ----------
const RATES = [["ease", "Easy to use"], ["look", "Looks good"], ["speed", "Fast enough"], ["help", "Easy to get help"], ["again", "Would use it again"]];
$("#fb-rates").innerHTML = RATES.map(([k, label]) => `<fieldset class="fb-rate"><legend>${label}</legend>
  ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="fb-${k}" value="${n}" ${n === 4 ? "checked" : ""}><span>${n}</span></label>`).join("")}</fieldset>`).join("");
function fbText(f) {
  return [`Vortex feedback · ${new Date(f.t).toLocaleString()}`, `Name: ${f.name || "anonymous"}`, `Crypto experience: ${f.exp}`,
    ...RATES.map(([k, l]) => `${l}: ${f[k]}/5`), `Liked: ${f.like || "-"}`, `Change: ${f.change || "-"}`, `Not working: ${f.bug || "-"}`].join("\n");
}
function paintFbCount() { $("#fb-n").textContent = store.get("feedback", []).length; }
$("#fb-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = { t: Date.now(), name: $("#fb-name").value.trim(), exp: $("#fb-exp").value,
    like: $("#fb-like").value.trim(), change: $("#fb-change").value.trim(), bug: $("#fb-bug").value.trim() };
  for (const [k] of RATES) f[k] = +($(`input[name="fb-${k}"]:checked`)?.value || 0);
  const all = store.get("feedback", []); all.unshift(f); store.set("feedback", all.slice(0, 50));
  $("#fb-out").value = fbText(f);
  $("#fb-form").hidden = true; $("#fb-done").hidden = false;
  paintFbCount(); toast("Thanks for the feedback");
});
$("#fb-copy").addEventListener("click", () => navigator.clipboard?.writeText($("#fb-out").value).then(() => toast("Copied"), () => { $("#fb-out").select(); toast("Press Ctrl+C to copy"); }));
function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("#fb-dl").addEventListener("click", () => download(`vortex-feedback-${Date.now()}.txt`, $("#fb-out").value));
$("#fb-again").addEventListener("click", () => { $("#fb-form").reset(); $("#fb-form").hidden = false; $("#fb-done").hidden = true; });
$("#fb-csv").addEventListener("click", () => {
  const all = store.get("feedback", []);
  if (!all.length) return toast("No feedback saved yet");
  const cols = ["t", "name", "exp", ...RATES.map(([k]) => k), "like", "change", "bug"];
  const csv = [cols.join(","), ...all.map((f) => cols.map((c) => `"${String(c === "t" ? new Date(f.t).toISOString() : f[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  download("vortex-feedback.csv", csv, "text/csv");
});
paintFbCount();

// ---------- backup and restore (move your progress to another browser) ----------
function addBackupButtons() {
  const box = $("#pf-wallet .pf-btns");
  if (!box || $("#pf-backup")) return;
  box.insertAdjacentHTML("afterbegin", `<button id="pf-backup">⬇ Save progress</button>
    <label class="file-btn">⬆ Load progress<input type="file" id="pf-restore" accept=".json,application/json"></label>`);
}
document.addEventListener("click", (e) => {
  if (e.target.id !== "pf-backup") return;
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("vx-") && k !== "vx-snap") data[k] = localStorage.getItem(k); }
  download(`vortex-progress-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ vortex: 1, saved: Date.now(), data }), "application/json");
  toast("Progress saved to a file");
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "pf-restore" || !e.target.files[0]) return;
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (j.vortex !== 1 || typeof j.data !== "object") throw new Error();
    if (!confirm("Load this progress file? It replaces your current wallet, trades and settings in this browser.")) return;
    Object.keys(localStorage).filter((k) => k.startsWith("vx-")).forEach((k) => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(j.data)) if (k.startsWith("vx-") && typeof v === "string") localStorage.setItem(k, v);
    location.reload();
  } catch { toast("That file is not a Vortex progress file"); }
});
const _pfOpen = pages.portfolio.open;
pages.portfolio.open = () => { _pfOpen(); addBackupButtons(); };
const _pfWallet = renderPfWallet;
renderPfWallet = function () { _pfWallet(); addBackupButtons(); };

route();
