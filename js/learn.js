// Vortex learn page: short beginner lessons with a quick quiz, plus a glossary.
"use strict";

const LESSONS = [
  {
    title: "What a memecoin is (and the risk)",
    body: `<p>A memecoin is a token made for fun, usually around a joke, an animal or something trending online. On Solana anyone can make one in under a minute on sites like pump.fun, which is why thousands appear every day.</p>
      <p>Most of them have no product and no team behind them, so the price only goes up while new people keep buying. When buyers stop, the price falls. The large majority of new memecoins end up worth almost nothing within a day.</p>
      <p>That is why Vortex is paper trading. You get the real tokens and real prices, but pretend money, so you can learn how it works without losing anything.</p>`,
    quiz: [
      ["What usually happens to most new memecoins?", ["They double every week", "They lose almost all their value", "They become stablecoins"], 1],
      ["What money do you use on Vortex?", ["Real SOL", "Pretend SOL", "Bank card"], 1],
    ],
  },
  {
    title: "How a new token grows: the three columns",
    body: `<p>On pump.fun every new token starts on a <b>bonding curve</b>. This is a built in price formula: each time someone buys, the price goes up a little, and each sell brings it down.</p>
      <p>The ring around each token picture on the home page shows roughly how full its curve is. <b>New</b> tokens have only just started. Tokens in <b>Final stretch</b> have filled more than half of the curve. When the curve is full the token <b>migrates</b>, which means it moves to a normal trading pool (PumpSwap) and shows in the <b>Migrated</b> column.</p>
      <p>Migrating is a big moment because more traders and tools can see the token afterwards, but plenty of tokens still crash straight after it.</p>`,
    quiz: [
      ["What happens when a bonding curve is full?", ["The token is deleted", "The token migrates to a trading pool", "The price resets to zero"], 1],
      ["Which column shows tokens that are over half way?", ["New", "Final stretch", "Migrated"], 1],
    ],
  },
  {
    title: "Reading a token card",
    body: `<p>Each card on the home page packs a lot in. From left to right:</p>
      <ul><li><b>Ring and %</b>: how full the bonding curve is.</li>
      <li><b>Age</b>: how long ago the token was made. Green means under 5 minutes.</li>
      <li><b>Tags</b>: warnings like "dev bought 15%" or "heavy selling", and good signs like a Vortex call.</li>
      <li><b>V</b>: trading volume in the last 5 minutes. <b>MC</b>: market cap. <b>L</b>: liquidity.</li>
      <li><b>TX</b>: number of buys and sells in 5 minutes, with a green and pink bar showing the split.</li>
      <li><b>⚡ button</b>: paper buys the amount you set in Quick buy.</li></ul>
      <p>Every gain has a ▲ and every loss has a ▼, so you never have to rely on colour alone.</p>`,
    quiz: [
      ["What does MC stand for?", ["Max coins", "Market cap", "Money credit"], 1],
      ["What does the ⚡ button do?", ["Opens the chart", "Paper buys the token", "Reports the token"], 1],
    ],
  },
  {
    title: "Market cap, liquidity and slippage",
    body: `<p><b>Market cap</b> is the token price multiplied by the number of tokens. A token at $10K market cap only needs a little buying to double, which is why tiny tokens move so fast in both directions.</p>
      <p><b>Liquidity</b> is how much money sits in the pool ready to trade against you. Low liquidity means even a small sell can drop the price a lot.</p>
      <p><b>Slippage</b> is the difference between the price you see and the price you actually get, because the price moves while your trade goes through. On tiny tokens it can be several percent. Vortex paper trades fill at the live price, so real trading would usually come out a little worse.</p>`,
    quiz: [
      ["Low liquidity means…", ["Prices are very stable", "Small trades can move the price a lot", "The token cannot be sold"], 1],
      ["Slippage is…", ["A fee Vortex charges", "The gap between the price you see and the price you get", "A type of wallet"], 1],
    ],
  },
  {
    title: "Spotting a rug pull",
    body: `<p>A <b>rug pull</b> is when the people behind a token sell everything at once and leave everyone else holding a coin worth nothing. The safety check on every token page looks for the usual warning signs:</p>
      <ul><li><b>Mint authority on</b>: the dev can print more tokens whenever they want.</li>
      <li><b>Freeze authority on</b>: the dev can freeze your tokens so you cannot sell.</li>
      <li><b>Top 10 holders own a lot</b>: a few wallets can crash the price.</li>
      <li><b>Lots of snipers or bots</b>: wallets that bought in the first seconds and are waiting to sell to you.</li>
      <li><b>Dev made many tokens</b>: serial launchers often rug.</li>
      <li><b>Copied logo</b>: copycat tokens are a common trick.</li></ul>
      <p>A high safety score does not mean a token is safe. It only means fewer warning signs were found.</p>`,
    quiz: [
      ["If freeze authority is on, the dev can…", ["Stop you selling your tokens", "Give you free tokens", "Lower the fees"], 0],
      ["A safety score of 90/100 means…", ["The token cannot go down", "Fewer warning signs were found", "Vortex guarantees it"], 1],
    ],
  },
  {
    title: "Take profit and stop loss",
    body: `<p>Prices on new tokens move so fast that it is easy to watch a profit disappear. A <b>take profit</b> sells automatically when your position reaches a target, for example x2. A <b>stop loss</b> sells automatically if it falls too far, for example −30%.</p>
      <p>Set them on the token page under the buy button. On Vortex they only run while the site is open, and they sell your whole position.</p>
      <p>Look at the live paper tests on the calls page to see how different plans would have done on every Vortex call. It is a good way to see that stopping losses early often matters more than catching the biggest win.</p>`,
    quiz: [
      ["A stop loss at −30% will…", ["Buy more when the price drops 30%", "Sell when your position is down 30%", "Stop the token trading"], 1],
      ["Where can you compare selling plans?", ["Fees page", "Calls page live paper tests", "Help page"], 1],
    ],
  },
  {
    title: "Using calls and KOL wallets",
    body: `<p><b>Vortex calls</b> are made automatically when a young token gets lots of buyers quickly. Every call stays on the calls page, including the ones that lost money, so you can judge the record yourself.</p>
      <p><b>KOLs</b> are well known traders. The top traders page shows their public wallets and what they hold. Copying them is risky: they often buy earlier and cheaper than you, and may sell to the people copying them.</p>
      <p>Treat calls and KOLs as ideas to research, not orders to follow. Check the safety score and the chart first, decide your take profit and stop loss before you buy, and only ever use money you can afford to lose.</p>`,
    quiz: [
      ["Why is copying KOLs risky?", ["They are always wrong", "They often buy earlier and may sell to copiers", "It costs extra fees"], 1],
      ["What should you decide before you buy?", ["Your take profit and stop loss", "Your username", "Nothing"], 0],
    ],
  },
];

const GLOSSARY = [
  ["Bonding curve", "The built in price formula a new pump.fun token trades on until it migrates."],
  ["Migration", "When a token's bonding curve is full and it moves to a normal trading pool."],
  ["Market cap (MC)", "Price multiplied by the number of tokens. Shows how big a token is."],
  ["Liquidity (L)", "Money in the pool ready to trade. Low liquidity means big price swings."],
  ["Volume (V)", "How much has been traded in a time window, here usually 5 minutes."],
  ["Slippage", "The gap between the price you see and the price you actually get."],
  ["Rug pull", "When the team or big holders sell everything and the price crashes to nearly zero."],
  ["Dev", "The wallet that created the token."],
  ["Sniper", "A wallet that buys in the first seconds after launch, often a bot."],
  ["Insider", "A wallet linked to the dev or bought very early, likely to sell on others."],
  ["Mint authority", "Permission to create more tokens. Safer when switched off."],
  ["Freeze authority", "Permission to freeze holders' tokens. Safer when switched off."],
  ["KOL", "Key opinion leader. A well known trader with followers."],
  ["Take profit (TP)", "An automatic sell when your position reaches a target, like x2."],
  ["Stop loss (SL)", "An automatic sell when your position falls by a set amount, like −30%."],
  ["PnL", "Profit and loss. How much you are up or down."],
  ["Paper trading", "Practising with pretend money on real prices."],
  ["x2, x3", "Times your money. x2 means the position is worth double what you paid."],
];

const ln = { i: 0, done: new Set(store.get("lessons", [])), answers: {} };

function renderLessonList() {
  $("#ln-list").innerHTML = LESSONS.map((l, i) => `<li><button class="${i === ln.i ? "on" : ""}" data-lesson="${i}" aria-current="${i === ln.i}">
    <span class="ln-n${ln.done.has(i) ? " done" : ""}">${ln.done.has(i) ? "✔" : i + 1}</span>${esc(l.title)}</button></li>`).join("");
  $("#ln-prog").style.setProperty("--p", (ln.done.size / LESSONS.length) * 100 + "%");
  $("#ln-prog-t").textContent = `${ln.done.size} of ${LESSONS.length} lessons done`;
}
function renderLesson() {
  const l = LESSONS[ln.i];
  ln.answers = {};
  $("#ln-body").innerHTML = `<p class="eyebrow">Lesson ${ln.i + 1} of ${LESSONS.length}</p><h2>${esc(l.title)}</h2>${l.body}
    <div class="quiz"><h3>Quick check</h3>${l.quiz.map(([q, opts], qi) => `<fieldset data-q="${qi}"><legend>${esc(q)}</legend>
      ${opts.map((o, oi) => `<button type="button" data-a="${oi}">${esc(o)}</button>`).join("")}</fieldset>`).join("")}
      <p class="quiz-msg" id="quiz-msg" role="status" aria-live="polite"></p></div>
    <div class="ln-nav">
      <button class="chip" id="ln-prev" ${ln.i === 0 ? "disabled" : ""}>← Back</button>
      ${ln.i < LESSONS.length - 1 ? '<button class="primary" id="ln-next">Next lesson →</button>' : '<a class="primary" href="#home" id="ln-go">Start paper trading →</a>'}
    </div>`;
  renderLessonList();
  $("#ln-body").scrollTop = 0;
}
$("#p-learn").addEventListener("click", (e) => {
  const lb = e.target.closest("[data-lesson]");
  if (lb) { ln.i = +lb.dataset.lesson; renderLesson(); return; }
  const a = e.target.closest("[data-a]");
  if (a) {
    const fs = a.closest("fieldset"), qi = +fs.dataset.q, q = LESSONS[ln.i].quiz[qi];
    const right = +a.dataset.a === q[2];
    $$("button", fs).forEach((b) => b.classList.remove("right", "wrong"));
    a.classList.add(right ? "right" : "wrong");
    a.textContent = (right ? "✔ " : "✖ ") + q[1][+a.dataset.a];
    ln.answers[qi] = right;
    const all = LESSONS[ln.i].quiz.every((_, k) => ln.answers[k]);
    $("#quiz-msg").textContent = right ? (all ? "All correct. Lesson complete!" : "Correct.") : "Not quite, try another answer.";
    if (all && !ln.done.has(ln.i)) { ln.done.add(ln.i); store.set("lessons", [...ln.done]); renderLessonList(); sound.buy(); }
    return;
  }
  if (e.target.id === "ln-prev" && ln.i > 0) { ln.i--; renderLesson(); }
  if (e.target.id === "ln-next") { ln.i++; renderLesson(); }
});
function renderGlossary() {
  const q = ($("#gl-q").value || "").trim().toLowerCase();
  const rows = GLOSSARY.filter(([w, d]) => !q || (w + " " + d).toLowerCase().includes(q));
  $("#gl-list").innerHTML = rows.length ? rows.map(([w, d]) => `<div><dt>${esc(w)}</dt><dd>${esc(d)}</dd></div>`).join("") : '<p class="empty">No match.</p>';
}
$("#gl-q").addEventListener("input", renderGlossary);

pages.learn = { open() { stopToken(); renderLesson(); renderGlossary(); } };

route();
