// Vortex help page: searchable FAQ, contact form, help chat, terms and privacy.
"use strict";

// Add real contact details here when the business has them.
const CONTACT = { email: null, telegram: null, x: null };

const FAQ = [
  ["Is this real money?", "No. Vortex is paper trading. The tokens and prices are real and live, but your balance is pretend SOL, so nothing you do can lose real money.", ["real", "money", "paper", "pretend"]],
  ["How do I start or change my starting balance?", "On your first visit Vortex asks how much pretend SOL you want. To start again, click your balance in the top right or use Reset wallet on the portfolio page. You can also add more pretend SOL on the portfolio page.", ["start", "balance", "reset", "deposit", "add"]],
  ["How do I buy a token?", "Set your amount in the Quick buy box on the home page and press the ⚡ button on any token card. Or open a token, choose Buy, pick an amount and press Buy.", ["buy", "purchase", "quick"]],
  ["How do I sell?", "On a token card you hold, press Sell 50% or Sell all. You can also sell from the token page, the portfolio page or the PnL panel at the bottom right.", ["sell", "close", "exit"]],
  ["What to do if a trade fails?", "Usually the price had not loaded yet. Wait a second and try again. If it keeps failing, refresh the page. Your balance and trades are saved, so you will not lose them.", ["fail", "failed", "error", "wrong", "not work"]],
  ["Why is a token missing its picture or price?", "Brand new tokens can take a few seconds to show a price and sometimes a minute or two before their picture loads. If a free data source is busy it fills in on the next update.", ["picture", "image", "price", "missing", "loading"]],
  ["How are fees worked out?", "Vortex takes 1% of every buy and 1% of every sell from your pretend balance. If you joined with a friend's link you pay 10% less. See the fees page for a calculator.", ["fee", "fees", "cost", "charge", "referral"]],
  ["How do I withdraw?", "There is nothing to withdraw because the money is pretend. Your results are saved in your browser. You can download your trades as a CSV file on the portfolio page.", ["withdraw", "cash out", "export", "csv"]],
  ["What is a Vortex call?", "Vortex calls a token when it is young, has lots of buyers in 5 minutes, more buys than sells and a dev holding 10% or less. Every call, good or bad, stays on the calls page.", ["call", "calls", "signal", "alert"]],
  ["How do I get alerts?", "Press Alerts in the bottom bar or Turn on alerts on the calls page, then allow notifications in your browser. Alerts only work while Vortex is open.", ["alert", "notification", "ping", "sound"]],
  ["What do take profit and stop loss do?", "They sell your whole position automatically when it reaches your target (for example x2) or falls by your limit (for example −30%). Set them on the token page. They only run while Vortex is open.", ["take profit", "stop loss", "tp", "sl", "auto"]],
  ["What does the safety score mean?", "It checks the token for common rug pull warning signs, like mint authority, big holders and snipers. A high score means fewer warning signs, not that the token is safe.", ["safety", "score", "rug", "scam", "safe"]],
  ["Can I make the text bigger?", "Yes. Press A+ in the top bar. You can also zoom your browser. Gains always have ▲ and losses ▼ so you do not need to rely on colour.", ["text", "bigger", "accessibility", "colour", "color", "blind"]],
  ["Does Vortex work on my phone?", "Yes. On small screens the three token columns become tabs at the top so you can switch between them.", ["phone", "mobile", "tablet"]],
];

function renderFaq() {
  const q = ($("#faq-q").value || "").trim().toLowerCase();
  const rows = FAQ.filter(([qq, a, k]) => !q || (qq + " " + a + " " + k.join(" ")).toLowerCase().includes(q));
  $("#faq-count").textContent = q ? `${rows.length} found` : `${FAQ.length} questions`;
  $("#faq").innerHTML = rows.length ? rows.map(([qq, a]) => `<details${q && rows.length <= 3 ? " open" : ""}><summary>${esc(qq)}</summary><p>${esc(a)}</p></details>`).join("")
    : '<p class="empty">No answer found. Try the live chat or the contact form.</p>';
}
$("#faq-q").addEventListener("input", renderFaq);

// ---------- contact form (saved locally) ----------
function renderTickets() {
  const t = store.get("tickets", []);
  $("#tickets").innerHTML = t.length ? t.map((x) => `<li><b>${esc(x.topic)}</b> <span class="muted small">${new Date(x.t).toLocaleString()} · saved</span><p>${esc(x.msg)}</p></li>`).join("") : "";
}
$("#help-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = $("#hf-msg").value.trim();
  if (msg.length < 10) return toast("Please write a bit more so we can help");
  const t = store.get("tickets", []);
  t.unshift({ t: Date.now(), topic: $("#hf-topic").value, msg: msg.slice(0, 1000) });
  store.set("tickets", t.slice(0, 20));
  $("#hf-msg").value = "";
  toast("Request saved");
  renderTickets();
});
function renderContacts() {
  const items = [
    ["Email", CONTACT.email && `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>`],
    ["Telegram", CONTACT.telegram && `<a href="${esc(CONTACT.telegram)}" target="_blank" rel="noopener">${esc(CONTACT.telegram)}</a>`],
    ["X", CONTACT.x && `<a href="${esc(CONTACT.x)}" target="_blank" rel="noopener">${esc(CONTACT.x)}</a>`],
  ].filter(([, v]) => v); // only show contact details that exist
  $("#contact-list").innerHTML = items.map(([k, v]) => `<li><span class="muted">${k}</span>${v}</li>`).join("")
    + `<li><span class="muted">Contact form</span><a href="#help" data-jump="help-contact">Send a request</a></li>`
    + `<li><span class="muted">Live chat</span><button class="chip" data-chat>Open chat</button></li>
       <li><span class="muted">Legal</span><span><a href="#help" data-jump="terms">Terms of use</a> · <a href="#help" data-jump="privacy">Privacy</a></span></li>`;
}

// ---------- help chat (answers from the FAQ) ----------
function chatSay(who, html) {
  const li = document.createElement("li");
  li.className = who;
  li.innerHTML = html;
  $("#chat-log").appendChild(li);
  $("#chat-log").scrollTop = 1e9;
}
function chatAnswer(text) {
  const words = text.toLowerCase();
  let best = null, score = 0;
  for (const f of FAQ) {
    const s = f[2].reduce((n, k) => n + (words.includes(k) ? k.length : 0), 0);
    if (s > score) { score = s; best = f; }
  }
  if (best) chatSay("bot", `<b>${esc(best[0])}</b><br>${esc(best[1])}`);
  else chatSay("bot", 'I am not sure about that one. Try the <a href="#learn">lessons</a>, or send it with the <a href="#help-contact" data-jump="help-contact">contact form</a> and it will be saved for the team.');
}
function openChat() {
  const c = $("#chat");
  c.hidden = false;
  if (!$("#chat-log").children.length) chatSay("bot", "Hi, I am the Vortex help bot. I answer from the help page. Ask me things like <i>how do I sell</i> or <i>what are the fees</i>.");
  $("#chat-text").focus();
}
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#chat-text").value.trim();
  if (!t) return;
  chatSay("me", esc(t));
  $("#chat-text").value = "";
  setTimeout(() => chatAnswer(t), 350);
});
$("#chat-close").addEventListener("click", () => ($("#chat").hidden = true));
$("#btn-chat").addEventListener("click", () => ($("#chat").hidden ? openChat() : ($("#chat").hidden = true)));
$("#help-chat-open").addEventListener("click", openChat);
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-chat]")) { openChat(); return; }
  const j = e.target.closest("[data-jump]");
  if (j) { e.preventDefault(); location.hash = "#help"; setTimeout(() => document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: "smooth" }), 50); }
});

pages.help = { open() { stopToken(); renderFaq(); renderTickets(); renderContacts(); } };

