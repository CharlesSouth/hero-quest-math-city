/* ============================ TUTORIAL (Practice Park stations) ============================ */
/* Each station: a short picture lesson (about 5 steps), then a BADGE CHALLENGE of
   3 correct answers using the same problem types he meets in battle. Pictures are
   free here (this is the place to learn). After the badge, the station becomes free
   practice for stars. */
const Tutorial = (() => {
  const $ = id => document.getElementById(id);
  let st = null, stepIdx = 0, timers = [], stars = 0, correct = 0, justEarned = false;
  let mode = "lesson";           /* lesson | challenge | free | done */
  let problem = null, input = "", sel = [], graphVals = [], coins = [], locked = false;

  /* ---- small HTML helpers for lesson pictures ---- */
  const bond = (whole, a, b) => `<div class="bond">
      <div class="bond-label">WHOLE</div>
      <div class="bond-c top${whole === "?" ? " miss" : ""}">${whole}</div>
      <svg width="164" height="30"><line x1="82" y1="0" x2="32" y2="30"/><line x1="82" y1="0" x2="132" y2="30"/></svg>
      <div class="bond-row"><div class="bond-c${a === "?" ? " miss" : ""}">${a}</div><div class="bond-c${b === "?" ? " miss" : ""}">${b}</div></div>
      <div class="bond-label">PART &nbsp; + &nbsp; PART</div></div>`;
  const hops = (from, to) => {
    let h = `<div class="seq-row"><span class="seq-box miss">${from}</span>`;
    for (let n = from + 1; n <= to; n++) h += `<span class="seq-arrow">+1➜</span><span class="seq-box">${n}</span>`;
    return h + `</div>`;
  };
  const rows = (ea, na, eb, nb) =>
    `<div style="font-size:2rem; text-align:left; letter-spacing:4px;"><div>${ea.repeat(na)}</div><div>${eb.repeat(nb)}<span style="opacity:.25">${"⬜".repeat(na - nb)}</span></div></div>`;
  const eqs = list => `<div class="eq-list">${list.map(e => `<div${e.startsWith("✘") ? ' class="bad"' : ""}>${e}</div>`).join("")}</div>`;
  const PETS = { title: "Students' Favorite Pets", cats: [["dog","🐶"],["cat","🐱"],["fish","🐟"]], max: 8 };
  const petGraph = () => MathGen.graphHTML(PETS, [3, 5, 2], false);

  /* step primitives:
     big: giant text | html: picture markup | groups: [{e, n, boxed, label, crossFrom}]
     count: sequential count | countBy: count boxes by group size | deal: staggered dealing */
  const LESSONS = {
    addsub: [
      { cap: "Adding puts groups TOGETHER. Taking away makes a group SMALLER.", big: "➕  ➖" },
      { cap: "Here are 3 robots... and here come 2 MORE!", groups: [{ e: "🤖", n: 3 }, { plus: true }, { e: "🤖", n: 2, fresh: true }] },
      { cap: "Count them ALL: 3 + 2 = 5!", groups: [{ e: "🤖", n: 5 }], count: true },
      { cap: "Now 5 donuts... and a sneaky gremlin grabs 2!", groups: [{ e: "🍩", n: 5, crossFrom: 3 }] },
      { cap: "Count what's LEFT: 5 − 2 = 3.", big: "5 − 2 = 3" },
      { cap: "BRAIN TRICK: start at the BIG number and count on in your head. 5... 6, 7! That's 5 + 2. In battle, pictures cost a 🔍 lens, so this trick is your superpower!", big: "🧠 5 ... 6, 7!" },
    ],
    story: [
      { cap: "Every story has a WHOLE (all of them) and PARTS. The whole is the BIGGEST number.", html: bond(7, 4, 3) },
      { cap: "\"There are 7 cubes. 4 are black. The REST are green.\" 7 is the WHOLE. 4 is one PART. The rest is the missing part!", html: bond(7, 4, "?") },
      { cap: "Take the part you know away from the whole: 7 − 4 = 3. Or think: 4 + what makes 7? Both work!", big: "7 − 4 = 3" },
      { cap: "\"4 acorns. Some MORE fell. Now there are 9.\" Count UP from 4 to 9 and count the jumps: 5 jumps!", html: hops(4, 9) },
      { cap: "\"How many MORE dogs than cats?\" Line them up! The extra ones are the answer: 2 more dogs.", html: rows("🐶", 5, "🐱", 3) },
      { cap: "Sometimes you BUILD the equation: tap the numbers, then + or −, then =. The numbers come from the story!", big: "4 + 5 = 9" },
    ],
    tens: [
      { cap: "Counting by 10s: only the TENS digit changes. The ones digit stays the same!", html: MathGen.seqHTML([10, 20, 30, 40, 50], -1) },
      { cap: "You can start anywhere! 7, 17, 27, 37... the ones digit stays 7.", html: MathGen.seqHTML([7, 17, 27, 37, 47], -1) },
      { cap: "10 MORE than 34? Just bump the tens digit up one: 44!", html: `<div class="seq-row"><span class="seq-box">34</span><span class="seq-arrow">+ 10 ➜</span><span class="seq-box">44</span></div>` },
      { cap: "A number line goes in order, and every jump is the SAME size.", html: MathGen.lineHTML([45, 46, 47, 48, 49, 50], -1) },
      { cap: "Missing number? Look at its neighbors! 46 comes before it and 48 comes after it...", html: MathGen.lineHTML([45, 46, 47, 48, 49, 50], 2) },
      { cap: "...so it must be 47! ⭐", big: "47" },
    ],
    graphs: [
      { cap: "A bar graph shows how many votes each thing got.", html: petGraph() },
      { cap: "Each square is ONE vote. Follow a bar to its END, then read the number underneath. Dog got 3!", html: petGraph() },
      { cap: "The LONGEST bar has the MOST votes (cat). The SHORTEST bar has the FEWEST (fish).", html: petGraph() },
      { cap: "How many MORE votes for cat than fish? Count the extra squares: 5 − 2 = 3.", html: petGraph() },
      { cap: "To BUILD a graph, tap a square and the bar fills up to it. Tap the end again to make it shorter. Then press CHECK!", big: "👆 ▮▮▮" },
    ],
    mult: [
      { cap: "Multiplying is a FAST way to count EQUAL groups!", big: "✖️" },
      { cap: "Here are 3 teams. Every team has exactly 2 robots.", groups: [
        { e: "🤖", n: 2, boxed: true }, { e: "🤖", n: 2, boxed: true }, { e: "🤖", n: 2, boxed: true } ] },
      { cap: "Count by 2s: 2... 4... 6!", groups: [
        { e: "🤖", n: 2, boxed: true }, { e: "🤖", n: 2, boxed: true }, { e: "🤖", n: 2, boxed: true } ], countBy: true },
      { cap: "3 teams of 2 makes 6. That's multiplying! ⭐", big: "3 × 2 = 6" },
    ],
    div: [
      { cap: "Dividing means FAIR SHARING. Everyone gets the same!", big: "➗" },
      { cap: "We have 6 energy cubes to share with 3 hero friends.", groups: [{ e: "🔷", n: 6 }] },
      { cap: "Deal them out: one for THIS hero, one for THAT hero, until they're gone!", groups: [
        { e: "🔷", n: 2, boxed: true, label: "🦸", deal: true },
        { e: "🔷", n: 2, boxed: true, label: "🦸", deal: true },
        { e: "🔷", n: 2, boxed: true, label: "🦸", deal: true } ], deal: true },
      { cap: "Every hero got exactly 2. 6 shared by 3 is 2 each! ⭐", big: "6 ÷ 3 = 2" },
    ],
    money: [
      { cap: "Every coin has a value! A penny is 1¢, a nickel is 5¢, and a dime is 10¢. A dime is small but worth the MOST!",
        html: `<div class="shape-row">${[1, 5, 10].map(v => `<span style="text-align:center">${MathGen.coinsHTML([v])}<span class="coin-name">${{1:"penny",5:"nickel",10:"dime"}[v]} = ${v}¢</span></span>`).join("")}</div>` },
      { cap: "All dimes? Count by 10s! 10, 20, 30. All nickels? Count by 5s!",
        html: `<div>${MathGen.coinsHTML([10, 10, 10])}</div><div class="seq-row" style="margin-top:6px">${[10, 20, 30].map(n => `<span class="seq-box">${n}</span>`).join("")}</div>` },
      { cap: "Dimes AND pennies? Count the dimes by 10s, then count on the pennies by 1s: 10, 20... 21, 22!",
        html: `<div>${MathGen.coinsHTML([10, 10, 1, 1])}</div><div class="seq-row" style="margin-top:6px">${[10, 20, 21, 22].map(n => `<span class="seq-box">${n}</span>`).join("")}</div>` },
      { cap: "More coins doesn't always mean more money! 6 pennies is only 6¢, but 1 dime is 10¢.",
        html: `<div class="coin-group"><div class="coin-group-label">6¢</div>${MathGen.coinsHTML([1, 1, 1, 1, 1, 1])}</div><div class="coin-group"><div class="coin-group-label">10¢ wins!</div>${MathGen.coinsHTML([10])}</div>` },
      { cap: "To SHOW 23¢: 23 is 2 tens and 3 ones, so tap 2 dimes and 3 pennies into the purse. Then press CHECK!",
        html: `<div class="coin-tray">${MathGen.coinsHTML([10, 10, 1, 1, 1])}</div>` },
    ],
    shapes: [
      { cap: "EQUAL parts are exactly the SAME size, like a fair share. These are NOT equal!",
        html: `<div class="shape-row">${MathGen.shapeSVG("rect", "half", false, 0)} ✔ equal &nbsp;&nbsp; ${MathGen.shapeSVG("rect", "unequal2", false, 0)} ✘ not equal</div>` },
      { cap: "2 equal parts are called HALVES. Each part is ONE HALF.",
        html: `<div class="shape-row">${MathGen.shapeSVG("circle", "half", true, 0)}${MathGen.shapeSVG("square", "half", true, 2)}</div>` },
      { cap: "4 equal parts are called FOURTHS (or quarters). Each part is ONE FOURTH.",
        html: `<div class="shape-row">${MathGen.shapeSVG("circle", "fourth", true, 0)}${MathGen.shapeSVG("rect", "fourth", true, 1)}</div>` },
      { cap: "MORE parts means SMALLER pieces! One half of a pizza is BIGGER than one fourth of the same pizza.",
        html: `<div class="shape-row">${MathGen.shapeSVG("circle", "half", true, 0)} &gt; ${MathGen.shapeSVG("circle", "fourth", true, 0)}</div>` },
      { cap: "A MIRROR flips a picture LEFT ↔ RIGHT. Squares on the left side show up on the right side. The top stays on top!",
        html: `<div class="shape-row">${MathGen.gridHTML([["#ff4757", 0, 0], ["#ff4757", "#2c6de8", 0], [0, 0, 0]])}<span class="mirror-line"></span>${MathGen.gridHTML([[0, 0, "#ff4757"], [0, "#2c6de8", "#ff4757"], [0, 0, 0]])}</div>` },
    ],
    time: [
      { cap: "A clock has TWO hands. The SHORT red hand tells the HOUR. The LONG blue hand tells the MINUTES.",
        html: MathGen.clockSVG(3, 0, 170) },
      { cap: "Long hand pointing straight UP at the 12? That means O'CLOCK! The short hand is on the 3, so it's 3 o'clock: 3:00.",
        html: `<div class="shape-row">${MathGen.clockSVG(3, 0, 150)} <span class="time-chip big">3:00</span></div>` },
      { cap: "The long hand goes all the way around in ONE HOUR. Count the numbers by 5s: 5, 10, 15, 20... all the way to 60 minutes!",
        html: MathGen.seqHTML([5, 10, 15, 20, 25, 30], -1) },
      { cap: "Long hand on the 6 means 30 minutes: HALF PAST. The short hand is halfway between 3 and 4. Use the number it just PASSED: 3:30!",
        html: `<div class="shape-row">${MathGen.clockSVG(3, 30, 150)} <span class="time-chip big">3:30</span></div>` },
      { cap: "Long hand on the 3 means 15 minutes (5, 10, 15). This clock says 7:15!",
        html: `<div class="shape-row">${MathGen.clockSVG(7, 15, 150)} <span class="time-chip big">7:15</span></div>` },
      { cap: "THE TRICK: find the SHORT hand first for the hour. Then count the LONG hand by 5s for the minutes. ⭐", big: "🕐 hour ➜ minutes" },
    ],
    eqmaster: [
      { cap: "FACT FAMILIES! The same 3 numbers make 4 true equations.", html: eqs(["3 + 5 = 8", "5 + 3 = 8", "8 − 3 = 5", "8 − 5 = 3"]) },
      { cap: "Stuck on 8 − 3? Think ADDITION instead: 3 + what makes 8?", html: bond(8, 3, "?") },
      { cap: "3 + 5 = 8, so 8 − 3 = 5! You can write either one.", big: "3 + 5 = 8" },
      { cap: "Picking equations for a story? The WHOLE is the biggest number. Adding the whole to a part makes TOO MANY!", html: eqs(["7 − 4 = 3  ✔", "4 + 3 = 7  ✔", "✘ 7 + 4 = 11"]) },
    ],
  };

  function clearTimers() { timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = []; }
  const earned = () => { const g = Main.getGame(); return !!(g.badges && g.badges[st.id]); };

  function open(stationId) {
    st = stationById(stationId);
    stars = 0; correct = 0; justEarned = false;
    $("tut-title").textContent = st.icon + " " + st.name.toUpperCase();
    refreshStatus();
    startLesson();
    Main.show("screen-tutorial");
    Sound.play("banner");
  }
  function refreshStatus() {
    $("tut-badge-status").textContent = earned()
      ? "🏅 You already have this badge! Practice here any time for ⭐ stars."
      : `🏅 Watch the lesson, then get ${BADGE_CHALLENGE_GOAL} right to earn the badge.` +
        (GATES[st.zone] ? ` This badge helps open ${GATES[st.zone].name.toUpperCase()}!` : ` A special SKY ISLES badge!`);
  }

  function startLesson() {
    clearTimers();
    mode = "lesson"; stepIdx = 0;
    $("tut-practice").style.display = "none";
    $("tut-lesson-controls").style.display = "";
    $("btn-tut-replay").style.display = "none";
    $("btn-tut-skip").style.display = earned() ? "" : "none";
    $("tut-stage").style.display = "flex";
    $("tut-caption").style.display = "";
    renderStep();
  }

  function renderStep() {
    clearTimers();
    const lesson = LESSONS[st.id];
    const step = lesson[stepIdx];
    const stage = $("tut-stage");
    stage.innerHTML = "";
    $("tut-caption").textContent = step.cap;
    $("btn-tut-next").textContent = stepIdx === lesson.length - 1
      ? (earned() ? "🎯 PRACTICE!" : "🏅 BADGE CHALLENGE!") : "▶ Next";

    if (step.big) {
      const b = document.createElement("div");
      b.className = "tut-big";
      b.textContent = step.big;
      stage.appendChild(b);
      return;
    }
    if (step.html) { stage.innerHTML = step.html; return; }   /* lesson markup is built in-file only */

    let itemIndexGlobal = 0;
    const allItems = [];
    for (const gDef of (step.groups || [])) {
      if (gDef.plus) {
        const p = document.createElement("div");
        p.className = "tut-plus"; p.textContent = "➕";
        stage.appendChild(p);
        continue;
      }
      const g = document.createElement("div");
      g.className = "tut-group" + (gDef.boxed ? " boxed" : "");
      let holder = g;
      if (gDef.boxed) {
        if (gDef.label) {
          const lab = document.createElement("div");
          lab.className = "tut-box-label"; lab.textContent = gDef.label;
          g.appendChild(lab);
        }
        holder = document.createElement("div");
        holder.className = "tut-box-items";
        g.appendChild(holder);
      }
      for (let i = 0; i < gDef.n; i++) {
        const it = document.createElement("span");
        it.className = "tut-item";
        it.textContent = gDef.e;
        const delay = gDef.fresh ? .15 * i + .1
                    : (step.deal || gDef.deal) ? .5 * (i * (step.groups.filter(x=>!x.plus).length) ) : .06 * itemIndexGlobal;
        it.style.animationDelay = delay + "s";
        if (gDef.crossFrom !== undefined && i >= gDef.crossFrom) {
          timers.push(setTimeout(() => { it.classList.add("crossed"); Sound.play("bump"); }, 900 + (i - gDef.crossFrom) * 600));
        }
        holder.appendChild(it);
        allItems.push({ el: it, group: g });
        itemIndexGlobal++;
      }
      stage.appendChild(g);
    }

    if (step.deal) {
      const per = step.groups.filter(g=>!g.plus)[0].n;
      const boxes = step.groups.filter(g=>!g.plus).length;
      for (let i = 0; i < per * boxes; i++) {
        timers.push(setTimeout(() => Sound.play("click"), 500 * i + 100));
      }
    }
    if (step.count) {
      let i = 0;
      const iv = setInterval(() => {
        if (i >= allItems.length) { clearInterval(iv); return; }
        const { el } = allItems[i];
        el.classList.add("counting");
        const n = document.createElement("span");
        n.className = "tut-num"; n.textContent = i + 1;
        el.appendChild(n);
        Sound.play("click");
        const prev = i;
        timers.push(setTimeout(() => allItems[prev].el.classList.remove("counting"), 400));
        i++;
      }, 650);
      timers.push(iv);
    }
    if (step.countBy) {
      const groups = [...new Set(allItems.map(a => a.group))];
      const per = allItems.length / groups.length;
      let i = 0;
      const iv = setInterval(() => {
        if (i >= groups.length) { clearInterval(iv); return; }
        const g = groups[i];
        g.style.transform = "scale(1.15)";
        const n = document.createElement("div");
        n.className = "tut-num"; n.style.position = "static"; n.style.transform = "none";
        n.style.fontSize = "1.2rem"; n.style.marginTop = "4px";
        n.textContent = per * (i + 1);
        g.appendChild(n);
        Sound.play("banner");
        const prev = g;
        timers.push(setTimeout(() => prev.style.transform = "", 500));
        i++;
      }, 950);
      timers.push(iv);
    }
  }

  function next() {
    Sound.play("click");
    if (stepIdx < LESSONS[st.id].length - 1) { stepIdx++; renderStep(); }
    else startChallenge();
  }

  /* ---------- badge challenge / free practice ---------- */
  function startChallenge() {
    clearTimers();
    mode = earned() ? "free" : "challenge";
    correct = 0;
    $("tut-lesson-controls").style.display = "none";
    $("tut-stage").style.display = "none";
    $("tut-caption").style.display = "none";
    $("tut-practice").style.display = "";
    $("btn-tut-replay").style.display = "";
    $("tut-stars").textContent = "";
    buildPads();
    newProblem();
  }
  function buildPads() {
    const pad = $("tut-pad");
    pad.innerHTML = "";
    ["1","2","3","4","5","⌫","6","7","8","9","0","OK"].forEach(k => {
      const b = document.createElement("button");
      b.className = "pad-btn" + (k === "OK" ? " ok" : k === "⌫" ? " del" : "");
      b.textContent = k;
      b.onclick = () => padPress(k);
      pad.appendChild(b);
    });
    const ops = $("tut-ops");
    ops.innerHTML = "";
    ["+", "−", "="].forEach(k => {
      const b = document.createElement("button");
      b.className = "pad-btn op";
      b.textContent = k;
      b.onclick = () => padPress(k);
      ops.appendChild(b);
    });
  }
  function progressText() {
    if (mode === "challenge")
      return "🏅 BADGE CHALLENGE: " + "⭐".repeat(correct) + "☆".repeat(BADGE_CHALLENGE_GOAL - correct);
    return "🎯 Free practice — no hurry!";
  }
  function setEnabled(on) {
    document.querySelectorAll("#tut-practice .pad-btn, #tut-choices .choice-btn, #btn-tut-check")
      .forEach(b => b.disabled = !on);
  }
  const fmtEq = s => s.replace(/([+−=])/g, " $1 ");
  function showInput() {
    const eq = problem && problem.input === "equation";
    $("tut-answer").textContent = input ? (eq ? fmtEq(input) : input) : " ";
  }

  function newProblem() {
    if (mode === "done") return;
    const g = Main.getGame();
    problem = MathGen.gen(st.skills, 1, g.name || "Hero", "the practice-bot");
    $("tut-progress").textContent = progressText();
    $("tut-problem").textContent = problem.story;
    $("tut-display").innerHTML = problem.display || "";
    /* pictures are FREE in Practice Park */
    $("tut-visual").innerHTML = problem.picture || (problem.visual ? problem.visual.replace(/</g, "&lt;") : "");
    $("tut-equation").textContent = problem.equation || "";
    $("tut-equation").style.fontSize = problem.prompt ? "1.1rem" : "1.7rem";
    $("tut-equation").style.color = problem.prompt ? "var(--cyan)" : "var(--yellow)";
    $("tut-feedback").textContent = "";
    input = ""; sel = [];
    const m = problem.input || "number";
    $("tut-input-row").style.display = (m === "number" || m === "equation") ? "" : "none";
    $("tut-ops").style.display = m === "equation" ? "" : "none";
    $("tut-check-row").style.display = (m === "multi" || m === "graph" || m === "coins") ? "" : "none";
    if (m === "coins") { coins = []; CoinPad.wire($("tut-display"), coins, () => locked); }
    const holder = $("tut-choices");
    holder.innerHTML = "";
    if (m === "choice" || m === "multi") {
      problem.choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.className = "choice-btn";
        b.innerHTML = c.html;   /* generator-made markup only */
        b.onclick = () => {
          if (locked) return;
          Sound.play("click");
          if (m === "choice") { sel = [i]; submit(); return; }
          const at = sel.indexOf(i);
          if (at >= 0) sel.splice(at, 1); else sel.push(i);
          b.classList.toggle("selected", at < 0);
        };
        holder.appendChild(b);
      });
    }
    if (m === "graph") {
      graphVals = problem.graph.cats.map(() => 0);
      $("tut-display").querySelectorAll(".bg-cell").forEach(cell => {
        cell.onclick = () => {
          if (locked) return;
          const r = +cell.dataset.r, k = +cell.dataset.k;
          graphVals[r] = graphVals[r] === k ? k - 1 : k;
          Sound.play("click");
          $("tut-display").querySelectorAll(`.bg-cell[data-r="${r}"]`).forEach(c2 => {
            c2.classList.toggle("fill", +c2.dataset.k <= graphVals[r]);
          });
        };
      });
    }
    showInput();
    locked = false; setEnabled(true);
  }

  function padPress(k) {
    if (locked || mode === "lesson" || mode === "done") return;
    Sound.play("click");
    const eq = problem && problem.input === "equation";
    if (k === "⌫") input = input.slice(0, -1);
    else if (k === "OK") { if (input !== "") submit(); return; }
    else if ("+−=".includes(k)) { if (eq && input.length < 12) input += k; }
    else if (eq ? input.length < 12 : input.length < 3) input += k;
    showInput();
  }

  function feedback(text, color) {
    $("tut-feedback").textContent = text;
    $("tut-feedback").style.color = color;
  }

  function submit() {
    if (!problem || locked) return;
    const m = problem.input || "number";
    let given;
    if (m === "number") { if (input === "") return; given = input; }
    else if (m === "equation") {
      if (!MathGen.parseEq(input)) { Sound.play("bump"); feedback("Make a whole equation, like 7 − 4 = 3, then press OK!", "var(--cyan)"); return; }
      given = input;
    }
    else if (m === "choice") given = sel[0];
    else if (m === "multi") {
      if (sel.length !== 2) { Sound.play("bump"); feedback("Pick exactly TWO equations, then press CHECK!", "var(--cyan)"); return; }
      given = sel.slice();
    }
    else if (m === "coins") {
      if (!coins.length) { Sound.play("bump"); feedback("Tap some coins to put them in the purse first!", "var(--cyan)"); return; }
      given = coins.slice();
    }
    else given = graphVals.slice();
    locked = true; setEnabled(false);
    if (MathGen.check(problem, given)) {
      correct++; stars++;
      Sound.play("victory");
      feedback(["Super! 🌟", "You got it! 🎉", "Math power! ⚡", "Amazing! 💥"][Math.floor(Math.random() * 4)], "var(--green)");
      $("tut-progress").textContent = progressText();
      if (mode === "free") $("tut-stars").textContent = "⭐".repeat(Math.min(stars, 20));
      if (mode === "challenge" && correct >= BADGE_CHALLENGE_GOAL) timers.push(setTimeout(earnBadge, 1100));
      else timers.push(setTimeout(newProblem, 1400));
    } else {
      /* no penalty here: show the answer and a tip, then a fresh problem */
      Sound.play("wrong");
      showCorrect();
      feedback(`Not quite! It was ${problem.reveal}.  💡 ${problem.hint}  (Try a new one!)`, "var(--yellow)");
      timers.push(setTimeout(newProblem, 4500));
    }
  }
  function showCorrect() {
    const p = problem;
    if ((p.input === "graph" || p.input === "coins") && p.revealDisplay) $("tut-display").innerHTML = p.revealDisplay;
    if (p.input === "choice" || p.input === "multi") {
      const right = Array.isArray(p.answer) ? p.answer : [p.answer];
      $("tut-choices").querySelectorAll(".choice-btn").forEach((b, i) => {
        b.classList.remove("selected");
        if (right.includes(i)) b.classList.add("right");
      });
    }
    if (p.input === "number" || p.input === "equation") $("tut-answer").textContent = p.reveal;
  }

  function earnBadge() {
    const g = Main.getGame();
    mode = "done";
    g.badges = g.badges || {};
    g.badges[st.id] = true;
    g.parts += BADGE_REWARD;
    Overworld.unlockGates(g);
    Main.refreshHud();
    Main.autoSave();
    Sound.play("victory");
    timers.push(setTimeout(() => Sound.play("victory"), 600));
    /* did this badge open a gate? */
    const gate = GATES[st.zone];
    const missing = missingBadges(g, st.zone);
    const gateMsg = !gate ? "A special Sky Isles badge!" : missing.length
      ? `One more for ${gate.name}: earn the ${badgeList(missing)} badge too!`
      : `🔓 ${gate.name.toUpperCase()} is now OPEN! Go explore it!`;
    $("tut-practice").style.display = "none";
    $("tut-stage").style.display = "flex";
    $("tut-caption").style.display = "";
    $("tut-stage").innerHTML = `<div><div class="badge-big">🏅 ${TROPHIES[st.id].icon}</div><div class="badge-name">${st.icon} ${st.name}</div></div>`;
    $("tut-caption").textContent = `BADGE EARNED! +${BADGE_REWARD} 🔩  ${gateMsg}  🏆 NEW TROPHY for your case at home: the ${TROPHIES[st.id].name}!`;
    $("btn-tut-replay").style.display = "none";
    $("tut-badge-status").textContent = "🎉 NEW BADGE! You can come back here to practice any time.";
    justEarned = true;
  }

  function init() {
    $("btn-tut-next").onclick = next;
    $("btn-tut-skip").onclick = () => { Sound.play("click"); startChallenge(); };
    $("btn-tut-check").onclick = () => { if (!locked) { Sound.play("click"); submit(); } };
    $("btn-tut-replay").onclick = () => { Sound.play("click"); startLesson(); };
    $("btn-tut-exit").onclick = () => {
      clearTimers();
      Sound.play("click");
      if (mode === "free" && stars > 0) Main.toast("Great practicing! You earned " + stars + " practice star" + (stars > 1 ? "s" : "") + "! ⭐", 4000);
      if (mode === "challenge" && correct > 0) Main.toast("Come back any time to finish the " + st.name + " badge!", 4000);
      mode = "done";
      Main.returnToWorld();
      if (justEarned) { setTimeout(() => Main.toast("🎯 Next: " + nextGoal(Main.getGame()), 7000), 300); Main.flashGoal(); }
    };
    /* keyboard typing works here too */
    window.addEventListener("keydown", e => {
      if (Main.currentScreen() !== "screen-tutorial" || locked || mode === "lesson" || mode === "done" || !problem) return;
      const m = problem.input;
      if (m !== "number" && m !== "equation") return;
      let k = null;
      if (/^[0-9]$/.test(e.key)) k = e.key;
      else if (e.key === "Backspace") k = "⌫";
      else if (e.key === "Enter") k = "OK";
      else if (m === "equation" && e.key === "+") k = "+";
      else if (m === "equation" && (e.key === "-" || e.key === "−")) k = "−";
      else if (m === "equation" && e.key === "=") k = "=";
      if (k) { e.preventDefault(); padPress(k); }
    });
  }
  function debugState() { return { st, mode, correct, problem, locked }; }
  return { init, open, debugState };
})();

/* ============================ PUZZLE (screen) ============================ */
/* One reasoning puzzle opens a 🧩 door or a treasure chest. A wrong answer just
   shows the answer + a tip; he can try a brand-new puzzle right away. */
const Puzzle = (() => {
  const $ = id => document.getElementById(id);
  let cur = null, problem = null, locked = false, solved = false;

  function open(opts) {
    cur = opts; solved = false;
    $("pz-title").textContent = opts.title || (opts.type === "chest" ? "🧩 PUZZLE LOCK" : "🧩 PUZZLE DOOR");
    $("pz-sub").textContent = opts.sub || (opts.type === "chest"
      ? (opts.big ? "A BIG treasure chest! Solve the puzzle to open it." : "A treasure chest! Solve the puzzle to open it.")
      : "This door has a puzzle lock. Solve it to open the door!");
    newPuzzle();
    Main.show("screen-puzzle");
  }
  function newPuzzle() {
    problem = Puzzles.gen(cur.tier);
    $("pz-story").textContent = problem.story;
    $("pz-display").innerHTML = problem.display;   /* generator-made markup only */
    $("pz-feedback").textContent = "";
    $("btn-pz-new").style.display = "none";
    $("btn-pz-done").style.display = "none";
    $("btn-pz-exit").style.display = "";
    const holder = $("pz-choices");
    holder.innerHTML = "";
    problem.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.innerHTML = c.html;
      b.onclick = () => answer(i, b);
      holder.appendChild(b);
    });
    locked = false;
  }
  function answer(i, btn) {
    if (locked || solved) return;
    locked = true;
    const buttons = $("pz-choices").querySelectorAll(".choice-btn");
    buttons.forEach(b => b.disabled = true);
    if (i === problem.answer) {
      solved = true;
      btn.classList.add("right");
      Sound.play("victory");
      const g = Main.getGame();
      g.opened = g.opened || {};
      if (cur.key) g.opened[cur.key] = true;
      g.puzzles = (g.puzzles || 0) + 1;
      let msg;
      if (cur.onSolve) {
        msg = cur.onSolve();
      } else if (cur.type === "chest") {
        const bolts = cur.big ? 12 + Math.floor(Math.random() * 7) : 6 + Math.floor(Math.random() * 5);
        const lenses = cur.big ? 1 : (Math.random() < .3 ? 1 : 0);
        g.parts += bolts; g.lenses = (g.lenses || 0) + lenses;
        msg = `🎉 SOLVED! The chest pops open: +${bolts} 🔩` + (lenses ? ` and a 🔍 Picture Lens!` : `!`);
      } else {
        Overworld.openPuzzleDoor(cur.key);
        msg = "🎉 SOLVED! *CLICK* The puzzle door slides open!";
      }
      $("pz-feedback").textContent = msg;
      $("pz-feedback").style.color = "var(--green)";
      $("btn-pz-done").style.display = "";
      $("btn-pz-exit").style.display = "none";
      Main.refreshHud();
      Main.autoSave();
      setTimeout(() => Sound.play("save"), 500);
    } else {
      Sound.play("wrong");
      buttons[problem.answer].classList.add("right");
      $("pz-feedback").textContent = `Not quite! The answer was ${problem.reveal}.  💡 ${problem.hint}`;
      $("pz-feedback").style.color = "var(--yellow)";
      $("btn-pz-new").style.display = "";
    }
  }
  function init() {
    $("btn-pz-new").onclick = () => { Sound.play("click"); newPuzzle(); };
    const leave = () => { Sound.play("click"); if (cur && cur.after) cur.after(); else Main.returnToWorld(); };
    $("btn-pz-done").onclick = leave;
    $("btn-pz-exit").onclick = leave;
  }
  function debugState() { return { cur, problem, solved, locked }; }
  return { init, open, debugState };
})();

/* ============================ GARAGE (hover-bike bay + paint shop) ============================ */
const Garage = (() => {
  const $ = id => document.getElementById(id);
  let mode = "bike", backTo = "world";

  function preview() {
    const c = $("garage-preview"), ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    drawHero(ctx, 12, 4, "down", 0, Main.suit(), 6, Main.getGame().powers);
  }
  function row(icon, name, desc, btnText, enabled, onClick, cls) {
    const r = document.createElement("div");
    r.className = "shop-item" + (cls ? " " + cls : "");
    r.innerHTML = `<div class="shop-icon">${icon}</div><div class="shop-info"><div class="shop-name">${name}</div><div class="shop-desc">${desc}</div></div>`;
    const b = document.createElement("button");
    b.className = "shop-buy"; b.textContent = btnText; b.disabled = !enabled;
    b.onclick = onClick;
    r.appendChild(b);
    $("garage-items").appendChild(r);
    return r;
  }
  function section(text) {
    const d = document.createElement("div");
    d.className = "garage-section"; d.textContent = text;
    $("garage-items").appendChild(d);
  }

  /* ---------- hover-bike ---------- */
  function bikeScreen() {
    const g = Main.getGame();
    $("garage-items").innerHTML = "";
    $("garage-preview").style.display = "none";
    if ((g.bike || 0) < BIKE_STAGES.length) {
      $("garage-title").textContent = "🏍️ HOVER-BIKE BAY";
      $("garage-sub").textContent = "A broken hover-bike! Fix all 3 parts and you can ZOOM to any open part of Math City.";
      const prog = document.createElement("div");
      prog.className = "garage-progress";
      prog.textContent = BIKE_STAGES.map((st, i) => i < g.bike ? "✅" : "⬜").join(" ");
      $("garage-items").appendChild(prog);
      BIKE_STAGES.forEach((st, i) => {
        if (i < g.bike) return row(st.icon, st.name, "Done! ✔", "FIXED ✔", false, null, "owned");
        if (i > g.bike) return row("🔒", st.name, "Finish the step before this one first.", st.cost + " 🔩", false, null, "owned");
        row(st.icon, st.name, `Costs ${st.cost} 🔩, then solve a puzzle to finish the job!`,
            g.parts >= st.cost ? `FIX IT (${st.cost} 🔩)` : `Need ${st.cost} 🔩`, g.parts >= st.cost, () => {
              Sound.play("click");
              Puzzle.open({ type: "bike", tier: 1,
                title: "🔧 BIKE REPAIR", sub: `${st.icon} ${st.name}: solve the puzzle to finish the repair!`,
                onSolve: () => {
                  g.parts -= st.cost; g.bike = (g.bike || 0) + 1;
                  return g.bike >= BIKE_STAGES.length
                    ? "🎉 VROOOM! The hover-bike is FIXED! Ride it any time with the 🏍️ RIDE button!"
                    : `🎉 Fixed! ${BIKE_STAGES.length - g.bike} more to go.`;
                },
                after: () => open("bike") });
            });
      });
    } else travelScreen();
  }
  function travelScreen() {
    const g = Main.getGame();
    $("garage-title").textContent = "🏍️ WHERE TO?";
    $("garage-sub").textContent = "Hop on the hover-bike and ZOOM anywhere you've already opened!";
    $("garage-items").innerHTML = "";
    $("garage-preview").style.display = "none";
    for (const t of TRAVEL) {
      const open = (!t.zone || zoneOpen(g, t.zone)) && (!t.need || (g.powers && g.powers[t.need]));
      row(t.name.split(" ")[0], t.name.split(" ").slice(1).join(" "),
          open ? "Ready to go!" : t.need ? "🔒 Only flyers can get there! (FLIGHT 🕊️ from Rita)" : "🔒 Not open yet. Keep adventuring!",
          open ? "ZOOM! 🏍️" : "LOCKED", open, () => {
            Sound.play("victory");
            Main.show("screen-world");
            Overworld.travel(t.key, t.x, t.y);
            Main.toast("🏍️ ZOOOOM! You rode the hover-bike to " + t.name.split(" ").slice(1).join(" ") + "!", 3000);
          }, open ? "" : "owned");
    }
  }

  /* ---------- paint shop ---------- */
  function paintScreen() {
    const g = Main.getGame();
    g.ownedSuits = g.ownedSuits || []; g.decals = g.decals || [];
    $("garage-title").textContent = "🎨 PAINT SHOP";
    $("garage-sub").textContent = "New colors and cool designs for your suit!";
    $("garage-items").innerHTML = "";
    $("garage-preview").style.display = "";
    preview();
    section("SUIT COLORS");
    ALL_SUITS.forEach((s, i) => {
      const free = i < SUITS.length, owned = free || g.ownedSuits.includes(i), wearing = g.suitIndex === i;
      const r = row("", s.name + (free ? "" : ""), free ? "Free!" : `${s.cost} 🔩`,
        wearing ? "WEARING ✔" : owned ? "WEAR" : `BUY ${s.cost} 🔩`,
        !wearing && (owned || g.parts >= s.cost), () => {
          if (!owned) { g.parts -= s.cost; g.ownedSuits.push(i); }
          g.suitIndex = i;
          Sound.play("victory"); Main.refreshHud(); Main.autoSave(); paintScreen();
        }, wearing ? "power" : "");
      const cv = document.createElement("canvas"); cv.width = 48; cv.height = 52;
      drawHero(cv.getContext("2d"), 6, 2, "down", 0, { ...s, decal: g.decal }, 3);
      r.querySelector(".shop-icon").appendChild(cv);
    });
    section("DESIGNS");
    row("🚫", "No design", "A plain suit.", !g.decal ? "WEARING ✔" : "WEAR", !!g.decal, () => {
      g.decal = null; Sound.play("click"); Main.autoSave(); paintScreen();
    }, !g.decal ? "power" : "");
    for (const [id, d] of Object.entries(DECALS)) {
      const owned = g.decals.includes(id), wearing = g.decal === id;
      row(d.name.split(" ")[0], d.name.split(" ").slice(1).join(" "), owned ? "Yours!" : `${d.cost} 🔩`,
        wearing ? "WEARING ✔" : owned ? "WEAR" : `BUY ${d.cost} 🔩`,
        !wearing && (owned || g.parts >= d.cost), () => {
          if (!owned) { g.parts -= d.cost; g.decals.push(id); }
          g.decal = id;
          Sound.play("victory"); Main.refreshHud(); Main.autoSave(); paintScreen();
        }, wearing ? "power" : "");
    }
  }

  /* ---------- Math Mart home store ---------- */
  function storeScreen(note) {
    const g = Main.getGame();
    g.decor = g.decor || { owned: {}, placed: {} };
    $("garage-title").textContent = "🛋️ COMFY CORNER FURNITURE";
    $("garage-sub").textContent = note || "Penny Pillow: \"Pick anything you like, hero! Place it at home with the 🛋️ DECORATE button.\"";
    $("garage-parts").textContent = "🔩 " + g.parts;
    $("garage-items").innerHTML = "";
    $("garage-preview").style.display = "none";
    for (const [id, d] of Object.entries(DECOR)) {
      if (d.src !== "store") continue;
      const have = g.decor.owned[id] || 0;
      row(d.icon, d.name, (have ? `You have ${have}. ` : "") + `${d.cost} 🔩`,
          g.parts >= d.cost ? `BUY ${d.cost} 🔩` : `Need ${d.cost} 🔩`, g.parts >= d.cost, () => {
            g.parts -= d.cost;
            g.decor.owned[id] = have + 1;
            Sound.play("victory"); Main.refreshHud(); Main.autoSave(); storeScreen();
            $("garage-sub").textContent = `🎉 You bought a ${d.icon} ${d.name}! Place it with 🛋️ DECORATE at Hero House.`;
          }, have ? "power" : "");
    }
    section("FIND MORE after the big rescue: golden Champions 👑 · lucky enemy drops 🎁");
  }

  function open(which, from, note) {
    mode = which; backTo = from || "world";
    $("garage-parts").textContent = "🔩 " + Main.getGame().parts;
    if (which === "store") storeScreen(note);
    else if (which === "paint") paintScreen();
    else if (which === "travel") travelScreen();
    else bikeScreen();
    Main.show("screen-garage");
  }
  function init() {
    $("btn-garage-exit").onclick = () => { Sound.play("click"); Main.returnToWorld(); };
  }
  return { init, open };
})();

/* ============================ DECORATE (Hero House) ============================ */
const Decorate = (() => {
  const $ = id => document.getElementById(id);
  const C = 40;   /* pixels per tile on the planner */
  let sel = null;
  const FIXED = { [T.BED]: "🛏️", [T.TV]: "📺", [T.SHELF]: "📚", [T.TROPHY]: "🏆", [T.BOSS_CASE]: "👑" };
  function deco() { const g = Main.getGame(); g.decor = g.decor || { owned: {}, placed: {} }; return g.decor; }
  function house() { return Overworld.debugWorld()["hero_house"]; }

  /* can a decoration go here without blocking anything? */
  function check(x, y) {
    const s = house(), grid = s.grid, k = x + "," + y;
    if (grid[y][x] === T.RUG) return "The rug is for walking on. Try a wooden floor spot!";
    if (grid[y][x] !== T.IN_FLOOR) return "That spot is already taken!";
    if (DECOR_RESERVED.includes(k)) return x === 8 ? "Keep the front door clear!" : "That's where your friend likes to rest!";
    if (s.critters.some(c => c.x === x && c.y === y)) return "A pet is sitting there! Try another spot.";
    if ((s.pickups || []).some(p => !p.taken && p.x === x && p.y === y)) return "Something is on the floor there. Pick it up first!";
    const solid = (xx, yy) => (xx === x && yy === y) || SOLID.has(grid[yy][xx]);
    const seen = new Set(["8,9"]), q = [[8, 9]];
    while (q.length) {
      const [cx, cy] = q.shift();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy, nk = nx + "," + ny;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS - 1 || seen.has(nk) || solid(nx, ny)) continue;
        seen.add(nk); q.push([nx, ny]);
      }
    }
    for (let yy = 0; yy < ROWS - 1; yy++) for (let xx = 0; xx < COLS; xx++) {
      const t = grid[yy][xx];
      if ((t === T.IN_FLOOR || t === T.RUG) && !solid(xx, yy) && !seen.has(xx + "," + yy))
        return "Oops! That would block a path. Try another spot!";
      if (FIXED[t] !== undefined || t === T.DECOR) {
        const near = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => seen.has((xx + dx) + "," + (yy + dy)));
        if (!near) return "Oops! That would block something you need to reach. Try another spot!";
      }
    }
    return null;
  }

  function draw() {
    const cv = $("decor-canvas"), ctx = cv.getContext("2d"), s = house(), d = deco();
    const st = s.style || {};
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = s.grid[y][x], px = x * C, py = y * C;
      if (t === T.VOID) continue;
      if (t === T.IN_WALL || t === T.TROPHY || t === T.BOSS_CASE) { ctx.fillStyle = st.wall || "#6e4a26"; ctx.fillRect(px, py, C, C); }
      else { ctx.fillStyle = (x + y) % 2 ? (st.floor2 || "#b8905c") : (st.floor || "#c9a06a"); ctx.fillRect(px, py, C, C); }
      if (t === T.RUG) { ctx.fillStyle = "#9b59d6"; ctx.fillRect(px + 3, py + 3, C - 6, C - 6); }
      ctx.font = "26px sans-serif";
      if (FIXED[t]) ctx.fillText(FIXED[t], px + C / 2, py + C / 2 + 2);
      if (t === T.DECOR && DECOR[d.placed[x + "," + y]]) ctx.fillText(DECOR[d.placed[x + "," + y]].icon, px + C / 2, py + C / 2 + 2);
      if (sel && t === T.IN_FLOOR && !check(x, y)) {   /* where the chosen item can go */
        ctx.fillStyle = "rgba(46,213,115,.35)"; ctx.fillRect(px + 4, py + 4, C - 8, C - 8);
      }
    }
    ctx.font = "26px sans-serif"; ctx.fillStyle = "#000";
    for (const c of s.critters) ctx.fillText(CRITTER_SPRITES[c.sprite].emoji, c.x * C + C / 2, c.y * C + C / 2 + 2);
    ctx.fillText("🚪", 8 * C + C / 2, 10 * C + C / 2);
    const g = Main.getGame();
    if (g.progress && g.progress.baron) { ctx.font = "16px sans-serif"; ctx.fillText("💤", 12 * C + C / 2, 5 * C + C / 2); }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  function tray() {
    const d = deco(), box = $("decor-tray");
    box.innerHTML = "";
    const ids = Object.keys(DECOR).filter(id => (d.owned[id] || 0) > 0);
    if (!ids.length) {
      box.innerHTML = `<p style="max-width:520px;">No decorations yet! Buy them at the 🛒 <b>Math Mart</b> counter, ` +
        `find them in 📦 treasure chests after the big rescue, or win them from golden 👑 Champions.</p>`;
      return;
    }
    for (const id of ids) {
      const free = decorFree(Main.getGame(), id);
      const b = document.createElement("button");
      b.className = "decor-item" + (sel === id ? " sel" : "");
      b.innerHTML = `<span class="di">${DECOR[id].icon}</span> ×${free}`;
      b.title = DECOR[id].name;
      b.disabled = free <= 0 && sel !== id;
      if (free <= 0) b.style.opacity = .45;
      b.onclick = () => {
        Sound.play("click");
        sel = sel === id ? null : id;
        say(sel ? `${DECOR[id].icon} ${DECOR[id].name}: tap a GREEN spot to put it there!` : "");
        refresh();
      };
      box.appendChild(b);
    }
  }
  function say(text, color) { $("decor-msg").textContent = text; $("decor-msg").style.color = color || "var(--yellow)"; }
  function refresh() { tray(); draw(); }

  function tap(ev) {
    const cv = $("decor-canvas"), r = cv.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * COLS), y = Math.floor((ev.clientY - r.top) / r.height * ROWS);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    place(x, y);
  }
  function place(x, y) {
    const g = Main.getGame(), d = deco(), grid = house().grid, k = x + "," + y;
    if (grid[y][x] === T.DECOR && d.placed[k]) {   /* pick it back up (then it can go somewhere else) */
      const id = d.placed[k];
      delete d.placed[k];
      Overworld.applyDecor(g);
      sel = id;
      Sound.play("click");
      say(`Picked up the ${DECOR[id].icon} ${DECOR[id].name}. Tap a GREEN spot to move it, or tap it in the list to put it away.`);
      Main.autoSave(); refresh();
      return;
    }
    if (!sel) { Sound.play("bump"); say("First pick a decoration from the list below!"); return; }
    if (decorFree(g, sel) <= 0) { sel = null; refresh(); return; }
    const why = check(x, y);
    if (why) { Sound.play("bump"); say("🚫 " + why, "#ff8fa3"); return; }
    d.placed[k] = sel;
    Overworld.applyDecor(g);
    Sound.play("victory");
    say(`✨ ${DECOR[sel].icon} ${DECOR[sel].name} looks GREAT there!`, "var(--green)");
    if (decorFree(g, sel) <= 0) sel = null;
    Main.autoSave(); refresh();
  }

  function open() {
    sel = null;
    Overworld.releaseKeys();
    say("");
    refresh();
    Main.show("screen-decor");
  }
  function init() {
    $("decor-canvas").addEventListener("click", tap);
    $("btn-decor-done").onclick = () => { Sound.play("click"); Main.returnToWorld(); };
  }
  return { init, open, check, place, debugSel: id => { sel = id; } };
})();

/* ============================ SHOP ============================ */
const Shop = (() => {
  const $ = id => document.getElementById(id);
  const CATALOG = [
    { id: "zap1",    icon: "⚡", name: "Mega Zap",        cost: 30,  desc: "Your zap does 2 damage per hit!",
      owned: g => g.upgrades.zap >= 1, buy: g => g.upgrades.zap = 1 },
    { id: "zap2",    icon: "⚡⚡", name: "Ultra Zap", cost: 70, desc: "Your zap does 3 damage per hit!",
      owned: g => g.upgrades.zap >= 2, requires: g => g.upgrades.zap >= 1, buy: g => g.upgrades.zap = 2 },
    { id: "plate1",  icon: "🛡️", name: "Tough Plating", cost: 25, desc: "Sometimes enemy bonks bounce right off!",
      owned: g => g.upgrades.plating >= 1, buy: g => g.upgrades.plating = 1 },
    { id: "plate2",  icon: "🛡️🛡️", name: "Mega Plating", cost: 55, desc: "Bonks bounce off even more often!",
      owned: g => g.upgrades.plating >= 2, requires: g => g.upgrades.plating >= 1, buy: g => g.upgrades.plating = 2 },
    { id: "lens",    icon: "🔍", name: "Picture Lens", cost: 5, supply: true,
      desc: g => `Shows the picture for ONE problem. You have ${g.lenses}. (Buy as many as you like!)`,
      owned: g => false, buy: g => g.lenses++ },
    { id: "lens5",   icon: "🔍×5", name: "Lens Pack", cost: 20, supply: true,
      desc: g => `FIVE Picture Lenses for less! You have ${g.lenses}.`,
      owned: g => false, buy: g => g.lenses += 5 },
    { id: "heart",   icon: "❤️", name: "Extra Heart", cost: 30, desc: "One more heart! (Can buy again — price grows)",
      owned: g => g.maxHearts >= 6, dynCost: g => 30 + (g.maxHearts - 3) * 15,
      buy: g => { g.maxHearts++; g.hearts = g.maxHearts; } },
    { id: "strength", power: true, icon: "💪", name: "SUPER STRENGTH", cost: 45,
      desc: "Crush boulders to find treasure! In battle: one double-power hit!",
      owned: g => g.powers.strength, buy: g => g.powers.strength = true },
    { id: "flight",  power: true, icon: "🕊️", name: "FLIGHT", cost: 80,
      desc: "Fly over water to reach lost treasure! In battle: dodge one attack!",
      owned: g => g.powers.flight, buy: g => g.powers.flight = true },
    { id: "invis",   power: true, icon: "👻", name: "INVISIBILITY", cost: 110,
      desc: "Enemies can't sneak up on you! In battle: vanish and escape!",
      owned: g => g.powers.invis, buy: g => g.powers.invis = true },
  ];

  const GREETINGS = [
    "Rita the Robo-Mechanic beams: \"Welcome, {name}! Let's soup up that suit!\"",
    "\"Back again, {name}? My gears are ready when you are!\"",
    "\"Ooh, shiny parts, {name}! Let's put them to work!\"",
  ];

  function open() {
    const g = Main.getGame();
    $("shop-greeting").textContent =
      GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace(/\{name\}/g, g.name);
    refresh();
    Main.show("screen-shop");
  }

  function refresh() {
    const g = Main.getGame();
    $("shop-parts").textContent = "🔩 " + g.parts;
    const list = $("shop-items");
    list.innerHTML = "";
    for (const item of CATALOG) {
      if (item.requires && !item.requires(g) && !item.owned(g)) continue;  /* hide until prerequisite */
      const cost = item.dynCost ? item.dynCost(g) : item.cost;
      const owned = item.owned(g);
      const row = document.createElement("div");
      row.className = "shop-item" + (item.power ? " power" : "") + (owned ? " owned" : "");
      row.innerHTML = `<div class="shop-icon">${item.icon}</div>
        <div class="shop-info"><div class="shop-name">${item.name}</div>
        <div class="shop-desc">${typeof item.desc === "function" ? item.desc(g) : item.desc}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "shop-buy";
      btn.textContent = owned ? "OWNED ✔" : cost + " 🔩";
      btn.disabled = owned || g.parts < cost;
      btn.onclick = () => {
        if (g.parts < cost) return;
        g.parts -= cost;
        item.buy(g);
        Main.refreshHud();
        Main.autoSave();
        if (item.power) {
          Main.showPowerup(item.id, item.name);   /* cutscene! */
        } else {
          Sound.play("victory");
          refresh();
          $("shop-greeting").textContent = `"${item.name} installed! Looking GOOD, ${g.name}!" 🔧`;
        }
      };
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  function init() {
    $("btn-shop-exit").onclick = () => { Sound.play("click"); Main.returnToWorld(); };
  }
  return { init, open };
})();

/* ============================ SAVELOAD ============================ */
const SaveLoad = (() => {
  const KEY = "heroQuestMathCity";
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch (e) { return null; }
  }
  return { save, load };
})();

