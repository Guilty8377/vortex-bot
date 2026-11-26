// Vortex fees page: pricing, fee calculator, comparison and referral link.
"use strict";

function myRefCode() {
  let c = store.get("myref", null);
  if (!c) { c = Math.random().toString(36).slice(2, 9); store.set("myref", c); }
  return c;
}
function renderFees() {
  const pct = +(FEE * 100).toFixed(2);
  $("#fee-now").textContent = pct + "%";
  const amt = Math.max(0, +$("#calc-amt").value || 0), x = Math.max(0, +$("#calc-x").value || 0);
  const buyFee = amt * FEE, inToken = amt - buyFee, sellValue = inToken * x, sellFee = sellValue * FEE, back = sellValue - sellFee;
  const pnl = back - amt;
  $("#calc-out").innerHTML = `
    <div class="row2"><span class="muted">Fee when you buy</span><b class="num">${fmt.sol(buyFee, 4)} SOL</b></div>
    <div class="row2"><span class="muted">Fee when you sell</span><b class="num">${fmt.sol(sellFee, 4)} SOL</b></div>
    <div class="row2"><span class="muted">You get back</span><b class="num">${fmt.sol(back, 4)} SOL</b></div>
    <div class="row2"><span class="muted">Profit or loss</span><b class="num ${pnl >= 0 ? "up" : "down"}">${pnl >= 0 ? "▲ +" : "▼ "}${fmt.sol(pnl, 4)} SOL</b></div>
    <p class="small muted">${x ? `To break even the token has to go up by about ${((1 / ((1 - FEE) ** 2) - 1) * 100).toFixed(1)}%.` : ""}</p>`;
  const rows = [
    ["Vortex", FEE, "None", true],
    ["Mako", 0.015, "None, but +11% of profit on winning automated trades"],
  ];
  $("#cmp-body").innerHTML = rows.map(([n, f, sub, me]) => `<tr class="${me ? "me-row" : ""}"><td><b>${n}</b></td>
    <td class="num">${+(f * 100).toFixed(2)}%</td><td>${sub}</td><td class="num">${fmt.sol(1 * f + (1 - f) * f, 4)} SOL</td></tr>`).join("");
  const link = location.origin + location.pathname + "?ref=" + myRefCode();
  $("#ref-link").value = link;
  const used = store.get("ref", null);
  $("#ref-status").textContent = used ? `You joined with a friend's link (${used}), so you pay ${pct}% instead of ${BASE_FEE * 100}%.` : "";
}
$("#calc-amt").addEventListener("input", renderFees);
$("#calc-x").addEventListener("input", renderFees);
$("#ref-copy").addEventListener("click", () => {
  const i = $("#ref-link");
  (navigator.clipboard?.writeText(i.value) || Promise.reject()).then(() => toast("Link copied"), () => { i.select(); toast("Press Ctrl+C to copy"); });
});
pages.fees = { open() { stopToken(); renderFees(); } };

