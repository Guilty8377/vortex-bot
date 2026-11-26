// Vortex auto trading: dev sniper and copy trade (paper only), plus alert choices.
"use strict";

const auto = {
  snipes: store.get("snipes", []), // { wallet, sol }
  copies: store.get("copies", []), // { wallet, name, sol, seen: {mint:true} }
};
const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
function saveAuto() { store.set("snipes", auto.snipes); store.set("copies", auto.copies); }

// ---------- dev sniper: runs the moment PumpPortal reports a new token ----------
feed.onCreate = (t) => {
  const s = auto.snipes.find((x) => x.wallet === t.dev);
  if (!s || !wallet.ready()) return;
  if (wallet.buy(t, s.sol)) notify.send("Vortex sniper", `Sniped ${t.symbol} from dev ${fmt.short(t.dev)}`, t.image, "auto");
};

// ---------- copy trade: compare a wallet's holdings every 30 seconds ----------
async function pollCopies() {
  for (const c of auto.copies) {
    try {
      const r = await fetch(ULTRA + c.wallet);
      if (!r.ok) continue;
      const j = await r.json();
      const now = new Set(Object.entries(j.tokens || {}).filter(([m, a]) => m !== SOL_MINT && a.some((x) => !x.isFrozen && x.uiAmount > 0)).map(([m]) => m));
      if (!c.seen) { c.seen = [...now]; saveAuto(); continue; } // first look just remembers what they already had
      const before = new Set(c.seen);
      for (const m of now) {
        if (before.has(m) || !wallet.ready()) continue;
        // queue a buy that fills as soon as Vortex has a price for it
        (wallet.data.limits ||= []).push({ id: Date.now() + Math.random(), mint: m, symbol: "…", mc: 1e15, sol: c.sol, t: Date.now(), copy: c.wallet, copyName: c.name });
        wallet.save();
        dexSoon.add(m); upsert(m, { created: Date.now() - 60000 });
      }
      // they sold: sell what we copied
      for (const [m, w] of Object.entries(wallet.data?.copied || {})) {
        if (w === c.wallet && !now.has(m) && wallet.data.positions[m]) {
          const t = feed.get(m);
          if (t?.priceSol && wallet.sell(t, 1)) notify.send("Vortex copy trade", `${c.name || fmt.short(c.wallet)} sold ${t.symbol}, so Vortex sold too`, t.image, "auto");
          delete wallet.data.copied[m]; wallet.save();
        }
      }
      c.seen = [...now]; saveAuto();
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
}
setInterval(pollCopies, 30000);
setTimeout(pollCopies, 4000);

// ---------- UI ----------
function renderAuto() {
  $("#sn-list").innerHTML = auto.snipes.length ? auto.snipes.map((s, i) => `<li><span class="num">${fmt.short(s.wallet)}</span><span class="num">${s.sol} SOL</span>
    <button class="mini" data-rm-snipe="${i}" aria-label="Remove">✕</button></li>`).join("") : '<li class="muted small">Nothing yet.</li>';
  $("#cp-list").innerHTML = auto.copies.length ? auto.copies.map((c, i) => `<li><span>${esc(c.name || fmt.short(c.wallet))}</span><span class="num">${c.sol} SOL</span>
    <span class="small muted">${c.seen ? "watching" : "starting…"}</span><button class="mini" data-rm-copy="${i}" aria-label="Remove">✕</button></li>`).join("") : '<li class="muted small">Nothing yet. Press Copy next to a KOL below, or paste any wallet.</li>';
  $$("[data-pref]").forEach((c) => (c.checked = notify.wants(c.dataset.pref)));
  $("#al-on").textContent = notify.on() ? "🔔 Alerts are on" : "🔔 Turn alerts on";
}
function addCopy(w, sol, name) {
  if (!isAddr(w)) return toast("That is not a Solana wallet address");
  if (auto.copies.some((c) => c.wallet === w)) return toast("Already copying that wallet");
  if (auto.copies.length >= 5) return toast("You can copy up to 5 wallets");
  auto.copies.push({ wallet: w, name: name || "", sol: +sol || 0.1 }); saveAuto(); renderAuto();
  toast(`Copying ${name || fmt.short(w)} with ${+sol || 0.1} SOL per buy`);
  setTimeout(pollCopies, 500);
}
$("#sn-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const w = $("#sn-w").value.trim(), sol = +$("#sn-a").value;
  if (!isAddr(w)) return toast("That is not a Solana wallet address");
  if (!(sol > 0)) return toast("Enter an amount");
  auto.snipes = auto.snipes.filter((x) => x.wallet !== w).concat({ wallet: w, sol }); saveAuto(); renderAuto();
  $("#sn-w").value = ""; toast("Sniper added. It buys the next coin this dev launches");
});
$("#cp-form").addEventListener("submit", (e) => { e.preventDefault(); addCopy($("#cp-w").value.trim(), $("#cp-a").value); $("#cp-w").value = ""; });
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-copytrade]");
  if (c) { e.stopPropagation(); addCopy(c.dataset.copytrade, $("#cp-a").value, c.dataset.name); return; }
  const rs = e.target.closest("[data-rm-snipe]");
  if (rs) { auto.snipes.splice(+rs.dataset.rmSnipe, 1); saveAuto(); renderAuto(); return; }
  const rc = e.target.closest("[data-rm-copy]");
  if (rc) { auto.copies.splice(+rc.dataset.rmCopy, 1); saveAuto(); renderAuto(); }
});
$$("[data-pref]").forEach((c) => c.addEventListener("change", () => notify.setPref(c.dataset.pref, c.checked)));
$("#al-on").addEventListener("click", async () => { if (!notify.on()) await notify.toggle(); renderAuto(); });

const _trOpen = pages.traders.open;
pages.traders.open = () => { _trOpen(); renderAuto(); };
