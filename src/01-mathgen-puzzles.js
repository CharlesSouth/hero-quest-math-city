/* ============================ MATHGEN ============================ */
/* Every problem is an object:
     story    — the words (plain text; may include the hero's name)
     picture  — HTML picture that is HIDDEN until the Picture Lens is used
     visual   — plain-text picture (classic problems; used by Practice Park)
     display  — HTML that is always shown (number lines, bar graphs, number boxes)
     equation — line under the picture ("7 − 4 = ?" or an instruction)
     prompt   — true when the equation line is an instruction, not math
     input    — "number" | "equation" | "choice" | "multi" | "graph"
     answer   — number | choice index | [indexes] | [bar values]
     accept   — for "equation": function(parsed) -> true/false
     choices  — for "choice"/"multi": [{ html }]
     graph    — for "graph": { cats, max }
     hint     — friendly tip after a miss
     reveal   — the correct answer, shown after a miss
   Tiers: 1 = numbers to 10 (city), 2 = to 20 (caverns & tower).
   Number lines and counting by 10s go to 100 in every tier. */
const MathGen = (() => {
  const rand = n => Math.floor(Math.random() * n);
  const between = (a, b) => a + rand(b - a + 1);
  const pick = arr => arr[rand(arr.length)];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const rep = (e, n) => e.repeat(Math.max(0, n));
  const box = s => `<span class="pic-box">${s}</span>`;
  const fresh = s => `<span class="pic-new">${s}</span>`;
  const gone = (e, n) => rep(`<span class="pic-gone">${e}</span>`, n);
  const row = s => `<span class="pic-row">${s}</span>`;

  const THINGS = [
    { e: "⚡", one: "power bolt",   many: "power bolts" },
    { e: "🔩", one: "mega bolt",    many: "mega bolts" },
    { e: "💎", one: "power gem",    many: "power gems" },
    { e: "⭐", one: "hero star",    many: "hero stars" },
    { e: "🍩", one: "donut",        many: "donuts" },
    { e: "🔋", one: "battery",      many: "batteries" },
    { e: "⚙️", one: "gear",         many: "gears" },
    { e: "🧲", one: "magnet",       many: "magnets" },
    { e: "🚀", one: "rocket",       many: "rockets" },
    { e: "🛡️", one: "shield chip",  many: "shield chips" },
  ];
  const nm = (t, n) => n === 1 ? t.one : t.many;

  /* ---------------- equation helpers ---------------- */
  /* parse "7−4=3" or "3=7−4" (also accepts "-" for "−") -> { x, op, y, z } meaning x op y = z */
  function parseEq(str) {
    const s = String(str).replace(/\s+/g, "").replace(/-/g, "−");
    let m = s.match(/^(\d{1,3})([+−])(\d{1,3})=(\d{1,3})$/);
    if (m) return { x: +m[1], op: m[2], y: +m[3], z: +m[4] };
    m = s.match(/^(\d{1,3})=(\d{1,3})([+−])(\d{1,3})$/);
    if (m) return { x: +m[2], op: m[3], y: +m[4], z: +m[1] };
    return null;
  }
  const isTrue = q => q && (q.op === "+" ? q.x + q.y === q.z : q.x - q.y === q.z);
  const sameNums = (q, nums) =>
    [q.x, q.y, q.z].sort((a, b) => a - b).join(",") === nums.slice().sort((a, b) => a - b).join(",");
  /* any TRUE + or − equation that uses exactly the story's three numbers */
  const acceptFamily = nums => q => isTrue(q) && sameNums(q, nums);

  /* ---------------- classic problems (also used by Practice Park) ---------------- */
  function add(max, name, foe) {
    const a = between(1, max - 1), b = between(1, max - a);
    const t = pick(THINGS);
    const story = pick([
      `${name} found ${a} ${nm(t,a)}, then grabbed ${b} more! How many now?`,
      `${name} has ${a} ${nm(t,a)} and ${foe} dropped ${b} more! How many altogether?`,
      `${a} ${nm(t,a)} plus ${b} more ${nm(t,b)} — how many in all?`,
      `${name}'s suit holds ${a} ${nm(t,a)}. A friendly robot hands over ${b} more! What's the total?`,
      `${foe} is guarding ${a} ${nm(t,a)} in one pile and ${b} in another. How many in both piles?`,
      `${name} counted ${a} ${nm(t,a)} this morning and found ${b} more after lunch. How many all day?`,
      `Rita the mechanic needs ${a} ${nm(t,a)} for one repair and ${b} for another. How many does she need?`,
    ]);
    const visual = t.e.repeat(a) + " ➕ " + t.e.repeat(b);
    return { skill: "add", story, visual, picture: visual,
             equation: `${a} + ${b} = ?`, input: "number", answer: a + b,
             nums: [a, b, a + b],
             hint: `Start at ${a} and count up ${b} more.`, reveal: `${a} + ${b} = ${a + b}` };
  }
  function sub(max, name, foe) {
    const a = between(2, max), b = between(1, a - 1);
    const t = pick(THINGS);
    const story = pick([
      `${name} had ${a} ${nm(t,a)}, but ${foe} swiped ${b}! How many are left?`,
      `${name} used ${b} of ${a} ${nm(t,a)} to power the suit. How many are left?`,
      `${a} ${nm(t,a)} were on the shelf. ${name} zapped ${b} over to a friend. How many still on the shelf?`,
      `${foe} started with ${a} ${nm(t,a)} and dropped ${b} while running! How many does it still have?`,
      `Out of ${a} ${nm(t,a)}, ${b} rolled down a drain. Oh no! How many are safe?`,
      `${name}'s backpack held ${a} ${nm(t,a)}. ${b} ${b === 1 ? "was" : "were"} used up in the last battle. How many remain?`,
    ]);
    let visual = "";
    for (let i = 0; i < a; i++) visual += i < a - b ? t.e : "✖️";
    return { skill: "sub", story, visual, picture: visual,
             equation: `${a} − ${b} = ?`, input: "number", answer: a - b,
             nums: [a, b, a - b],
             hint: `Start at ${a} and count back ${b}.`, reveal: `${a} − ${b} = ${a - b}` };
  }
  function mult(name) {
    const g = between(2, 4), per = between(2, 4);
    const t = pick([{ e: "🤖", one: "robot" }, { e: "🚗", one: "car" }, { e: "🔋", one: "battery" }]);
    const many = t.one === "battery" ? "batteries" : t.one + "s";
    const story = pick([
      `${name} sees ${g} teams with ${per} ${many} on each team. How many in ALL?`,
      `There are ${g} boxes. Each box holds ${per} ${many}. How many ${many} altogether?`,
      `${g} shelves with ${per} ${many} on each shelf — how many ${many} total?`,
    ]);
    const visual = Array.from({length: g}, () => "[" + t.e.repeat(per) + "]").join(" ");
    return { skill: "mult", story, visual, picture: visual,
             equation: `${g} × ${per} = ?`, input: "number", answer: g * per,
             hint: `Count by ${per}s, one jump for each group.`, reveal: `${g} × ${per} = ${g * per}` };
  }
  function div(name) {
    const h = between(2, 4), per = between(1, 4), total = h * per;
    const story = pick([
      `${name} shares ${total} energy cubes fairly with ${h} hero friends. How many does EACH friend get?`,
      `${total} donuts go into ${h} equal boxes. How many donuts in EACH box?`,
      `${name} splits ${total} batteries evenly between ${h} robots. How many batteries EACH?`,
    ]);
    const visual = Array.from({length: h}, () => "🦸" + "🔷".repeat(per)).join("  ");
    return { skill: "div", story, visual, picture: visual,
             equation: `${total} ÷ ${h} = ?`, input: "number", answer: per,
             hint: `Deal them out one at a time until they're all shared.`, reveal: `${total} ÷ ${h} = ${per}` };
  }

  /* ---------------- "the rest" (part-part-whole) ---------------- */
  const REST_STORIES = [
    (T, P) => ({ a: "⚽", b: "🏐", s: `There are ${T} balls in the bag. ${P} are soccer balls. The rest are volleyballs. How many volleyballs are in the bag?` }),
    (T, P, n) => ({ a: "⬛", b: "🟩", s: `${n} has ${T} cubes. ${P} of the cubes are black. The rest of the cubes are green. How many cubes are green?` }),
    (T, P) => ({ a: "🐿️", b: "🐿️", s: `There are ${T} chipmunks. ${P} are underground and the rest are on the grass. How many chipmunks are on the grass?` }),
    (T, P) => ({ a: "🔴", b: "🔵", s: `There are ${T} robots in the garage. ${P} are red. The rest are blue. How many robots are blue?` }),
    (T, P) => ({ a: "🏀", b: "⚽", s: `${P} students are playing basketball. The rest are playing soccer. There are ${T} students in all. How many students are playing soccer?` }),
    (T, P, n, f) => ({ a: "🍩", b: "🍫", s: `${f} grabbed ${T} donuts. ${P} have sprinkles. The rest are chocolate. How many donuts are chocolate?` }),
    (T, P) => ({ a: "🎾", b: "🎾", s: `There are ${T} tennis rackets. ${P} are being used. The rest are on the ground. How many rackets are on the ground?` }),
    (T, P, n) => ({ a: "🔋", b: "🪫", s: `${n}'s suit holds ${T} batteries. ${P} are full. The rest are empty. How many batteries are empty?` }),
    (T, P) => ({ a: "🎾", b: "⚾", s: `There are ${T} students playing sports. ${P} are playing tennis. The rest are playing baseball. How many are playing baseball?` }),
  ];
  function restNums(max) { const T = between(3, max), P = between(2, T - 1); return { T, P, A: T - P }; }
  function rest(max, name, foe) {
    const { T, P, A } = restNums(max);
    const c = pick(REST_STORIES)(T, P, name, foe);
    return { skill: "rest", story: c.s,
             picture: box(rep(c.a, P)) + rep(c.b, A),
             equation: "", input: "number", answer: A, nums: [T, P, A],
             hint: `${T} is ALL of them. Take away the ${P} you know about to find the rest.`,
             reveal: `${T} − ${P} = ${A}` };
  }

  /* ---------------- "some more came" (change unknown) ---------------- */
  const ADDTO_STORIES = [
    (S, E) => ({ e: "🌰", s: `There are ${S} acorns on the ground. Some more acorns fell off the tree. Now there are ${E} acorns on the ground. How many acorns fell off the tree?` }),
    (S, E, n) => ({ e: "⚙️", s: `${n} had ${S} gears. Rita gave ${n} some more gears. Now ${n} has ${E} gears. How many gears did Rita give?` }),
    (S, E) => ({ e: "🐦", s: `${S} birds sat on a wire. Some more birds landed. Now there are ${E} birds on the wire. How many birds landed?` }),
    (S, E, n, f) => ({ e: "🍩", s: `${f} had ${S} donuts, then grabbed some more. Now it has ${E} donuts. How many more donuts did it grab?` }),
    (S, E) => ({ e: "🤖", s: `${S} robots were at the party. Some more robots came. Now there are ${E} robots at the party. How many robots came?` }),
  ];
  function addto(max, name, foe) {
    const S = between(2, max - 1), E = between(S + 1, max), A = E - S;
    const c = pick(ADDTO_STORIES)(S, E, name, foe);
    return { skill: "addto", story: c.s,
             picture: box(rep(c.e, S)) + fresh(rep(c.e, A)),
             equation: "", input: "number", answer: A, nums: [S, A, E],
             hint: `Start at ${S} and count UP to ${E}. How many jumps did you make?`,
             reveal: `${S} + ${A} = ${E}` };
  }

  /* ---------------- "some went away" (change unknown) ---------------- */
  const TAKEFROM_STORIES = [
    (S, L) => ({ e: "🐦", s: `There were ${S} birds in a tree. Some birds flew away. Now there are ${L} birds in the tree. How many birds flew away?` }),
    (S, L, n) => ({ e: "🔋", s: `${n} had ${S} batteries. ${n} used some in a battle. Now ${n} has ${L} batteries. How many batteries were used?` }),
    (S, L) => ({ e: "🎈", s: `There were ${S} balloons at the party. Some balloons popped. Now there are ${L} balloons. How many balloons popped?` }),
    (S, L) => ({ e: "🐸", s: `${S} frogs sat on a log. Some frogs hopped away. Now ${L} frogs are on the log. How many frogs hopped away?` }),
  ];
  function takefrom(max, name, foe) {
    const S = between(3, max), L = between(2, S - 1), A = S - L;
    const c = pick(TAKEFROM_STORIES)(S, L, name, foe);
    return { skill: "takefrom", story: c.s,
             picture: box(rep(c.e, L)) + gone(c.e, A),
             equation: "", input: "number", answer: A, nums: [S, A, L],
             hint: `Count back from ${S} down to ${L}. How many jumps did you make?`,
             reveal: `${S} − ${A} = ${L}` };
  }

  /* ---------------- "how many more / fewer" ---------------- */
  const COMPARE_STORIES = [
    (X, Y, n, f) => ({ a: "💎", b: "💎", s: `${n} has ${X} power gems. ${f} has ${Y} power gems. How many MORE gems does ${n} have?` }),
    (X, Y) => ({ a: "🐶", b: "🐱", s: `There are ${X} dogs and ${Y} cats at the park. How many more dogs than cats are there?` }),
    (X, Y, n, f) => ({ a: "⚙️", b: "⚙️", s: `${f} has ${Y} gears. ${n} has ${X} gears. How many FEWER gears does ${f} have?` }),
    (X, Y) => ({ a: "🔴", b: "🔵", s: `The red team scored ${X} points. The blue team scored ${Y} points. How many more points did the red team score?` }),
    (X, Y, n) => ({ a: "🍎", b: "🍌", s: `${n} picked ${X} apples and ${Y} bananas. How many more apples than bananas did ${n} pick?` }),
  ];
  function compare(max, name, foe) {
    const X = between(3, max), Y = between(2, X - 1), A = X - Y;
    const c = pick(COMPARE_STORIES)(X, Y, name, foe);
    return { skill: "compare", story: c.s,
             picture: `<span class="pic-rows">` + row(rep(c.a, X)) + row(rep(c.b, Y)) + `</span>`,
             equation: "", input: "number", answer: A, nums: [X, Y, A],
             hint: `Line them up. How many extra does ${X} have compared to ${Y}?`,
             reveal: `${X} − ${Y} = ${A}` };
  }

  /* ---------------- build the equation ---------------- */
  function eqbuild(max, name, foe, tier) {
    const makers = tier >= 2 ? [rest, addto, takefrom, compare, add, sub]
                             : [rest, rest, addto, add, sub];
    const base = pick(makers)(max, name, foe);
    return { ...base, skill: "eqbuild", base: base.skill,
             equation: "🔧 BUILD THE EQUATION that solves it! (Use the numbers, + or −, and =)",
             prompt: true, input: "equation", answer: null,
             accept: acceptFamily(base.nums),
             hint: `Use the numbers from the story, and make both sides match.` };
  }

  /* ---------------- addition equation that helps subtract ---------------- */
  function related(max) {
    const a = between(3, max), b = between(1, a - 1), c = a - b;
    return { skill: "related",
             story: `${a} − ${b} = ?   Build an ADDITION equation that helps you find the answer!`,
             picture: box(rep("🔷", b)) + rep("🔷", c),
             equation: `Think: ${b} + ? = ${a}`, prompt: true,
             input: "equation", answer: null,
             accept: q => isTrue(q) && q.op === "+" && q.z === a &&
                          [q.x, q.y].sort((m, n) => m - n).join(",") === [b, c].sort((m, n) => m - n).join(","),
             hint: `What do you add to ${b} to make ${a}?`,
             reveal: `${b} + ${c} = ${a}` };
  }

  /* ---------------- pick the TWO equations ---------------- */
  function pick2(max, name, foe) {
    const { T, P, A } = restNums(max);
    const c = pick(REST_STORIES)(T, P, name, foe);
    const opts = shuffle([
      { html: `${P} + <u>${A}</u> = ${T}`, ok: true },
      { html: `${T} − ${P} = <u>${A}</u>`, ok: true },
      { html: `${T} + ${P} = <u>${T + P}</u>`, ok: false },
    ]);
    return { skill: "pick2", story: c.s,
             picture: box(rep(c.a, P)) + rep(c.b, A),
             equation: "👆 Pick the TWO equations that can solve it, then press CHECK!", prompt: true,
             input: "multi", choices: opts,
             answer: opts.map((o, i) => o.ok ? i : -1).filter(i => i >= 0),
             hint: `The whole group is ${T}. Adding ${T} + ${P} would make MORE than all of them!`,
             reveal: `${P} + ${A} = ${T} and ${T} − ${P} = ${A}` };
  }

  /* ---------------- counting by 10s ---------------- */
  const seqHTML = (vals, missIdx) => `<div class="seq-row">${vals.map((v, i) =>
    `<span class="seq-box${i === missIdx ? " miss" : ""}">${i === missIdx ? "?" : v}</span>`).join("")}</div>`;
  function tens(tier, name, foe) {
    const kinds = tier >= 2 ? ["fwd", "fwd", "back", "odd", "more", "less"] : ["fwd", "fwd", "fwd", "next"];
    const kind = pick(kinds);
    let vals, miss, story, ans, hint;
    if (kind === "fwd" || kind === "next") {
      const start = 10 * between(0, 6);
      vals = [0, 1, 2, 3, 4].map(i => start + 10 * i);
      miss = kind === "next" ? 4 : between(1, 4);
      story = kind === "next" ? `${name} is counting by 10s! What number comes NEXT?`
                              : `${name} is counting by 10s! What number is missing?`;
      hint = `Each box is 10 more than the one before it.`;
    } else if (kind === "back") {
      const start = 10 * between(5, 10);
      vals = [0, 1, 2, 3, 4].map(i => start - 10 * i);
      miss = between(1, 4);
      story = `${foe} is counting BACKWARD by 10s! What number is missing?`;
      hint = `Going backward, each box is 10 LESS than the one before it.`;
    } else if (kind === "odd") {
      const d = between(1, 9), start = d + 10 * between(0, 5);
      vals = [0, 1, 2, 3, 4].map(i => start + 10 * i);
      miss = between(1, 4);
      story = `${name} is counting by 10s starting at ${start}! What number is missing?`;
      hint = `Only the TENS digit changes. The ones digit stays ${d}.`;
    } else {
      const n0 = between(11, 89), up = kind === "more", res = up ? n0 + 10 : n0 - 10;
      return { skill: "tens",
               story: up ? `What number is 10 MORE than ${n0}?` : `What number is 10 LESS than ${n0}?`,
               display: `<div class="seq-row"><span class="seq-box">${n0}</span><span class="seq-arrow">${up ? "+ 10 ➜" : "− 10 ➜"}</span><span class="seq-box miss">?</span></div>`,
               equation: "", input: "number", answer: res,
               hint: up ? `Only the tens digit goes UP by one.` : `Only the tens digit goes DOWN by one.`,
               reveal: `${n0} ${up ? "+" : "−"} 10 = ${res}` };
    }
    ans = vals[miss];
    return { skill: "tens", story, display: seqHTML(vals, miss),
             equation: "", input: "number", answer: ans, hint, reveal: String(ans) };
  }

  /* ---------------- missing number on a number line ---------------- */
  const lineHTML = (vals, missIdx) => `<div class="nline"><div class="nline-bar"></div><div class="nline-ticks">${
    vals.map((v, i) => `<div class="nt"><div class="nt-mark"></div><div class="nt-lab${i === missIdx ? " miss" : ""}">${i === missIdx ? "?" : v}</div></div>`).join("")
  }</div></div>`;
  function numline(tier, name) {
    const kind = pick(tier >= 2 ? ["ones", "ones", "tens", "twos", "fives"] : ["ones", "ones", "tens"]);
    const step = { ones: 1, tens: 10, twos: 2, fives: 5 }[kind];
    const count = 6;
    const maxStart = 100 - step * (count - 1);
    const start = kind === "ones" ? between(0, maxStart)
                : step * between(0, Math.floor(maxStart / step));
    const vals = Array.from({ length: count }, (_, i) => start + step * i);
    const miss = between(1, count - 1);
    return { skill: "numline",
             story: pick([`A number fell off ${name}'s number line! What number goes where the ? is?`,
                          `Fix the number line! What number belongs in the yellow box?`]),
             display: lineHTML(vals, miss),
             equation: "", input: "number", answer: vals[miss],
             hint: step === 1 ? `Look at the numbers next door. Each jump is just 1.`
                              : `Look at the numbers next door. Each jump is ${step}.`,
             reveal: String(vals[miss]) };
  }

  /* ---------------- bar graphs ---------------- */
  const GRAPH_SETS = [
    { title: "Students' Favorite Pets",   cats: [["dog","🐶"],["cat","🐱"],["fish","🐟"],["bird","🐦"]] },
    { title: "Favorite Fruits",           cats: [["apple","🍎"],["banana","🍌"],["grapes","🍇"],["berry","🍓"]] },
    { title: "Favorite Sports",           cats: [["soccer","⚽"],["baseball","⚾"],["tennis","🎾"],["hoops","🏀"]] },
    { title: "Favorite Colors",           cats: [["red","🟥"],["blue","🟦"],["green","🟩"],["yellow","🟨"]] },
  ];
  const BAR_COLORS = ["#ff6b81", "#29b0c9", "#2ed573", "#ffb02e"];
  function graphHTML(g, values, build) {
    let h = `<div class="bar-graph${build ? " build" : ""}"><div class="bg-title">${g.title}</div>`;
    g.cats.forEach((c, r) => {
      h += `<div class="bg-row"><div class="bg-label">${c[0]} ${c[1]}</div>`;
      for (let k = 1; k <= g.max; k++)
        h += `<div class="bg-cell${k <= values[r] ? " fill" : ""}" data-r="${r}" data-k="${k}" style="--fc:${BAR_COLORS[r]}"></div>`;
      h += `</div>`;
    });
    h += `<div class="bg-row bg-axis"><div class="bg-label">0</div>`;
    for (let k = 1; k <= g.max; k++) h += `<div class="bg-num">${k}</div>`;
    return h + `</div></div>`;
  }
  function makeGraph(tier, n) {
    const set = pick(GRAPH_SETS);
    const max = tier >= 2 ? 10 : 8;
    const cats = shuffle(set.cats).slice(0, n);
    return { title: set.title, cats, max };
  }
  function barread(tier, name) {
    const n = tier >= 2 ? between(3, 4) : 3;
    const g = makeGraph(tier, n);
    const values = shuffle(Array.from({ length: g.max }, (_, i) => i + 1)).slice(0, n);
    const kinds = tier >= 2 ? ["howmany", "most", "fewest", "more", "more", "total", "total", "all"]
                            : ["howmany", "howmany", "most", "fewest", "more"];
    const kind = pick(kinds);
    const display = graphHTML(g, values, false);
    const lab = i => g.cats[i][0];
    const base = { skill: "barread", display, equation: "", input: "number" };
    if (kind === "howmany") {
      const i = rand(n);
      return { ...base, story: `Look at the bar graph. How many votes did ${lab(i)} get?`,
               answer: values[i], hint: `Find the ${lab(i)} bar. Read the number under where it ends.`,
               reveal: String(values[i]) };
    }
    if (kind === "most" || kind === "fewest") {
      const target = kind === "most" ? Math.max(...values) : Math.min(...values);
      const idx = values.indexOf(target);
      return { ...base, input: "choice",
               story: kind === "most" ? `Look at the bar graph. Which one got the MOST votes?`
                                      : `Look at the bar graph. Which one got the FEWEST votes?`,
               choices: g.cats.map(c => ({ html: `${c[1]} ${c[0]}` })), answer: idx,
               hint: kind === "most" ? `The MOST votes is the LONGEST bar.` : `The FEWEST votes is the SHORTEST bar.`,
               reveal: lab(idx) };
    }
    if (kind === "more") {
      const [i, j] = shuffle(Array.from({ length: n }, (_, k) => k)).slice(0, 2);
      const hi = values[i] > values[j] ? i : j, lo = hi === i ? j : i;
      const d = values[hi] - values[lo];
      return { ...base, story: `How many MORE votes are there for ${lab(hi)} than for ${lab(lo)}?`,
               answer: d, nums: [values[hi], values[lo], d],
               hint: `Find both bars. How many extra squares does the ${lab(hi)} bar have?`,
               reveal: `${values[hi]} − ${values[lo]} = ${d}` };
    }
    if (kind === "total") {
      const [i, j] = shuffle(Array.from({ length: n }, (_, k) => k)).slice(0, 2);
      const s = values[i] + values[j];
      return { ...base, story: `How many votes did ${lab(i)} and ${lab(j)} get altogether?`,
               answer: s, nums: [values[i], values[j], s],
               hint: `Read both bars, then add them together.`,
               reveal: `${values[i]} + ${values[j]} = ${s}` };
    }
    const all = values.reduce((a, b) => a + b, 0);
    return { ...base, story: `How many votes are there in ALL? (Add every bar!)`,
             answer: all, hint: `Read each bar, then add them all up.`,
             reveal: values.join(" + ") + " = " + all };
  }
  function barbuild(tier, name) {
    const g = makeGraph(tier, 3);
    const values = g.cats.map(() => between(1, g.max));
    const parts = g.cats.map((c, i) => `${values[i]} picked ${c[0]}`);
    const list = parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
    return { skill: "barbuild",
             story: `${name} asked friends to vote: ${list}. Build the bar graph!`,
             graph: g, display: graphHTML(g, g.cats.map(() => 0), true),
             equation: "👆 Tap a square to fill the bar up to it. Then press CHECK!", prompt: true,
             input: "graph", answer: values,
             hint: `Fill each bar until it ends at its number.`,
             reveal: g.cats.map((c, i) => `${c[0]} ${values[i]}`).join(", "),
             revealDisplay: graphHTML(g, values, false) };
  }

  /* ---------------- money ---------------- */
  const COIN_NAMES = { 1: ["penny", "pennies"], 5: ["nickel", "nickels"], 10: ["dime", "dimes"], 25: ["quarter", "quarters"] };
  const coin = v => `<span class="coin c${v}">${v}¢</span>`;
  const coinsHTML = list => list.slice().sort((a, b) => b - a).map(coin).join("");
  const sum = list => list.reduce((a, b) => a + b, 0);
  /* Kept simple for 1st grade: never more than TWO coin types at once, and no quarters.
     - one kind of coin: count by 10s (dimes), 5s (nickels) or 1s (pennies)
     - dimes + pennies: like tens and ones (2 dimes + 3 pennies = 23¢) */
  function randomCoins(tier) {
    const k = pick(tier >= 2 ? ["dimes", "nickels", "pennies", "mix", "mix"] : ["dimes", "nickels", "pennies", "mix"]);
    if (k === "dimes")   return Array(between(2, tier >= 2 ? 6 : 4)).fill(10);
    if (k === "nickels") return Array(between(2, tier >= 2 ? 5 : 4)).fill(5);
    if (k === "pennies") return Array(between(2, 9)).fill(1);
    return Array(between(1, tier >= 2 ? 4 : 2)).fill(10).concat(Array(between(1, tier >= 2 ? 5 : 4)).fill(1));
  }
  function describeCoins(list) {
    const counts = {};
    list.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return Object.keys(counts).map(Number).sort((a, b) => b - a)
      .map(v => `${counts[v]} ${COIN_NAMES[v][counts[v] === 1 ? 0 : 1]}`).join(", ");
  }
  function greedy(total, set) {
    const out = [];
    for (const v of set.slice().sort((a, b) => b - a)) while (total >= v) { out.push(v); total -= v; }
    return out;
  }
  function money(tier, name, foe) {
    const kind = pick(["count", "count", "more", "story", "make", "make"]);
    if (kind === "count") {
      const list = randomCoins(tier);
      const total = sum(list);
      const hint = list.every(v => v === 10) ? `Count by 10s: 10, 20, 30...`
                 : list.every(v => v === 5) ? `Count by 5s: 5, 10, 15...`
                 : list.every(v => v === 1) ? `Each penny is 1¢. Just count them!`
                 : `Count the dimes by 10s, then count on the pennies by 1s.`;
      return { skill: "money", story: `${name} found these coins! How many cents (¢) is that?`,
               display: `<div>${coinsHTML(list)}</div>`, equation: "", input: "number", answer: total,
               hint, reveal: `${total}¢` };
    }
    if (kind === "more") {
      /* each group is ONE kind of coin, so it's counting, not adding */
      const group = () => { const v = pick([10, 5, 1]); return Array(between(1, v === 1 ? 9 : 3)).fill(v); };
      let a, b;
      for (let t = 0; t < 200; t++) {
        a = group(); b = group();
        if (sum(a) === sum(b) || a[0] === b[0]) continue;
        const tricky = Math.random() < .5;   /* sometimes the bigger pile is worth LESS */
        if (tricky && !((a.length > b.length) !== (sum(a) > sum(b)))) continue;
        break;
      }
      const ans = sum(a) > sum(b) ? 0 : 1;
      return { skill: "money", story: `Which group of coins is worth MORE money?`,
               display: `<div class="coin-group"><div class="coin-group-label">Group A</div>${coinsHTML(a)}</div>` +
                        `<div class="coin-group"><div class="coin-group-label">Group B</div>${coinsHTML(b)}</div>`,
               equation: "", input: "choice", choices: [{ html: "🅰 Group A" }, { html: "🅱 Group B" }], answer: ans,
               hint: `Count the cents in each group. More coins doesn't always mean more money!`,
               reveal: `Group ${ans ? "B" : "A"} (${sum(a)}¢ vs ${sum(b)}¢)` };
    }
    if (kind === "story") {
      /* small price stories: numbers to 10 */
      if (Math.random() < .5) {
        const has = between(3, 10), cost = between(1, has - 1);
        const item = pick(["a sticker", "a gear", "a toy robot", "a donut", "a battery", "a yo-yo"]);
        return { skill: "money", story: `${name} has ${has}¢ and buys ${item} for ${cost}¢. How many cents are left?`,
                 equation: "", input: "number", answer: has - cost, nums: [has, cost, has - cost],
                 picture: coinsHTML(Array(has).fill(1)),
                 hint: `Start at ${has}¢ and count back ${cost}.`, reveal: `${has}¢ − ${cost}¢ = ${has - cost}¢` };
      }
      const x = between(1, 6), y = between(1, 10 - x);
      const [i1, i2] = shuffle(["a sticker", "a gear", "a donut", "a battery", "a yo-yo", "a balloon"]).slice(0, 2);
      return { skill: "money", story: `${i1[0].toUpperCase() + i1.slice(1)} costs ${x}¢ and ${i2} costs ${y}¢. How many cents for BOTH?`,
               equation: "", input: "number", answer: x + y, nums: [x, y, x + y],
               picture: coinsHTML(Array(x).fill(1)) + " ➕ " + coinsHTML(Array(y).fill(1)),
               hint: `Start at ${Math.max(x, y)} and count on ${Math.min(x, y)} more.`, reveal: `${x}¢ + ${y}¢ = ${x + y}¢` };
    }
    /* make an amount: dimes + pennies only (tens and ones!) */
    const set = [10, 1];
    const target = between(1, tier >= 2 ? 4 : 3) * 10 + between(1, tier >= 2 ? 9 : 5);
    const best = greedy(target, set);
    return { skill: "money", story: `${foe} wants exactly ${target}¢. Show ${target}¢ with dimes and pennies!`,
             display: CoinPad.html(set), coinSet: set,
             equation: `👆 Tap coins to put them in the purse (tap a purse coin to take it out), then press CHECK!`, prompt: true,
             input: "coins", answer: target,
             hint: `${target} is ${Math.floor(target / 10)} tens and ${target % 10} ones: ${Math.floor(target / 10)} dimes and ${target % 10} pennies.`,
             reveal: `${target}¢ = ${describeCoins(best)}`,
             revealDisplay: `<div class="coin-tray">${coinsHTML(best)}</div>` };
  }

  /* ---------------- halves & fourths ---------------- */
  /* shape: circle | square | rect ; cut: half | fourth | unequal2 | unequal4 ; shade: shade one part */
  function shapeSVG(shape, cut, shade, variant) {
    const SH = "#ff9f43", ST = 'stroke="#223" stroke-width="3" fill="none" stroke-linecap="round"';
    let w, h, body = "", lines = [], fill = "";
    if (shape === "circle") {
      w = h = 80;
      const C = 40, R = 34;
      body = `<circle cx="${C}" cy="${C}" r="${R}" fill="#fff"/>`;
      if (cut === "half") {
        if (variant) { lines.push([C - R, C, C + R, C]); fill = `<path d="M${C - R},${C} A${R},${R} 0 0,1 ${C + R},${C} Z" fill="${SH}"/>`; }
        else { lines.push([C, C - R, C, C + R]); fill = `<path d="M${C},${C - R} A${R},${R} 0 0,0 ${C},${C + R} Z" fill="${SH}"/>`; }
      } else if (cut === "fourth") {
        lines.push([C, C - R, C, C + R], [C - R, C, C + R, C]);
        fill = `<path d="M${C},${C} L${C},${C - R} A${R},${R} 0 0,0 ${C - R},${C} Z" fill="${SH}"/>`;
      } else if (cut === "unequal2") {
        lines.push([56, 10, 56, 70]);
      } else {
        lines.push([54, 9, 54, 71], [8.2, 28, 71.8, 28]);
      }
      if (!shade) fill = "";
      return `<svg class="shape-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}${fill}` +
             lines.map(l => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" ${ST}/>`).join("") +
             `<circle cx="${C}" cy="${C}" r="${R}" ${ST}/></svg>`;
    }
    const W = shape === "rect" ? 100 : 70, H = shape === "rect" ? 56 : 70, X = 5, Y = 5;
    w = W + 10; h = H + 10;
    const rect = (x, y, ww, hh) => `<rect x="${X + x}" y="${Y + y}" width="${ww}" height="${hh}" fill="${SH}"/>`;
    const poly = pts => `<polygon points="${pts.map(p => (X + p[0]) + "," + (Y + p[1])).join(" ")}" fill="${SH}"/>`;
    const L = (x1, y1, x2, y2) => lines.push([X + x1, Y + y1, X + x2, Y + y2]);
    if (cut === "half") {
      if (variant === 1) { L(0, H / 2, W, H / 2); fill = rect(0, 0, W, H / 2); }
      else if (variant === 2 && shape === "square") { L(0, 0, W, H); fill = poly([[0, 0], [0, H], [W, H]]); }
      else { L(W / 2, 0, W / 2, H); fill = rect(0, 0, W / 2, H); }
    } else if (cut === "fourth") {
      if (variant === 1) { [1, 2, 3].forEach(k => L(W * k / 4, 0, W * k / 4, H)); fill = rect(0, 0, W / 4, H); }
      else if (variant === 2 && shape === "square") { L(0, 0, W, H); L(W, 0, 0, H); fill = poly([[0, 0], [W, 0], [W / 2, H / 2]]); }
      else { L(W / 2, 0, W / 2, H); L(0, H / 2, W, H / 2); fill = rect(0, 0, W / 2, H / 2); }
    } else if (cut === "unequal2") {
      if (variant === 1) L(0, H * .28, W, H * .28); else L(W * .3, 0, W * .3, H);
    } else {
      if (variant === 1 || shape === "square") { L(W * .3, 0, W * .3, H); L(0, H * .68, W, H * .68); }
      else { [.12, .32, .62].forEach(f => L(W * f, 0, W * f, H)); }
    }
    if (!shade) fill = "";
    return `<svg class="shape-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
           `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#fff"/>${fill}` +
           lines.map(l => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" ${ST}/>`).join("") +
           `<rect x="${X}" y="${Y}" width="${W}" height="${H}" ${ST}/></svg>`;
  }
  const SHAPES = ["circle", "square", "rect"];
  const randShape = (cut, shade) => shapeSVG(pick(SHAPES), cut, shade, rand(3));
  function fraction(tier, name, foe) {
    const kind = pick(["which", "which", "equal", "name", "name", "count", "bigger"]);
    if (kind === "which") {
      const halves = Math.random() < .5;
      const right = halves ? "half" : "fourth";
      const opts = shuffle([
        { html: randShape(right, false), ok: true },
        { html: randShape(halves ? "unequal2" : "unequal4", false), ok: false },
        { html: randShape(halves ? "fourth" : "half", false), ok: false },
      ]);
      return { skill: "fraction",
               story: halves ? `Which shape is cut into HALVES? (2 EQUAL parts)` : `Which shape is cut into FOURTHS? (4 EQUAL parts)`,
               equation: "", input: "choice", choices: opts, answer: opts.findIndex(o => o.ok),
               hint: halves ? `Halves = 2 parts that are exactly the SAME size.` : `Fourths = 4 parts that are exactly the SAME size.`,
               reveal: halves ? "the one with 2 equal parts" : "the one with 4 equal parts" };
    }
    if (kind === "equal") {
      const eq = Math.random() < .5;
      const cut = eq ? pick(["half", "fourth"]) : pick(["unequal2", "unequal4"]);
      return { skill: "fraction", story: `Is this shape cut into EQUAL parts?`,
               display: `<div class="shape-row">${randShape(cut, false)}</div>`,
               equation: "", input: "choice",
               choices: [{ html: "✔ Yes, the parts are equal" }, { html: "✘ No, they're different sizes" }],
               answer: eq ? 0 : 1,
               hint: `Equal parts are exactly the same size, like a fair share.`,
               reveal: eq ? "Yes, they're equal" : "No, the parts are different sizes" };
    }
    if (kind === "name") {
      const half = Math.random() < .5;
      return { skill: "fraction", story: `What is the ORANGE part called?`,
               display: `<div class="shape-row">${randShape(half ? "half" : "fourth", true)}</div>`,
               equation: "", input: "choice",
               choices: [{ html: "one half" }, { html: "one fourth" }, { html: "the whole" }],
               answer: half ? 0 : 1,
               hint: `Count the equal parts. 2 parts = halves. 4 parts = fourths.`,
               reveal: half ? "one half" : "one fourth" };
    }
    if (kind === "count") {
      const half = Math.random() < .5, n = half ? 2 : 4;
      if (Math.random() < .5) {
        return { skill: "fraction",
                 story: half ? `How many HALVES make the whole shape?` : `How many FOURTHS make the whole shape?`,
                 display: `<div class="shape-row">${randShape(half ? "half" : "fourth", false)}</div>`,
                 equation: "", input: "number", answer: n,
                 hint: `Count the equal parts.`, reveal: String(n) };
      }
      return { skill: "fraction",
               story: `${name} ate the orange part. How many equal parts are LEFT?`,
               display: `<div class="shape-row">${randShape(half ? "half" : "fourth", true)}</div>`,
               equation: "", input: "number", answer: n - 1,
               hint: `Count the white parts.`, reveal: String(n - 1) };
    }
    const shape = pick(SHAPES), bigger = Math.random() < .6;
    const opts = shuffle([
      { html: shapeSVG(shape, "half", true, 0) + "<br>one half", ok: bigger },
      { html: shapeSVG(shape, "fourth", true, 0) + "<br>one fourth", ok: !bigger },
    ]);
    return { skill: "fraction",
             story: bigger ? `Two pizzas are the SAME size. Which piece is BIGGER?` : `Two pizzas are the SAME size. Which piece is SMALLER?`,
             equation: "", input: "choice", choices: opts, answer: opts.findIndex(o => o.ok),
             hint: `The MORE parts you cut, the SMALLER each part gets.`,
             reveal: bigger ? "one half" : "one fourth" };
  }

  /* ---------------- mirror images ---------------- */
  const MCOLORS = ["#ff4757", "#2c6de8", "#2ed573", "#ffb02e"];
  const gridHTML = gr => `<span class="mgrid">${gr.flat().map(c => `<span${c ? ` style="background:${c}"` : ""}></span>`).join("")}</span>`;
  const keyOf = gr => gr.flat().join("|");
  function mirror(tier, name) {
    let p, fh, fv;
    for (let t = 0; t < 200; t++) {
      const cols = shuffle(MCOLORS).slice(0, 2);
      p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]].map(r => r.map(() => 0));
      const n = between(3, 4);
      shuffle(Array.from({ length: 9 }, (_, i) => i)).slice(0, n).forEach((cell, k) => {
        p[Math.floor(cell / 3)][cell % 3] = cols[k % 2];
      });
      fh = p.map(r => r.slice().reverse());
      fv = p.slice().reverse();
      if (new Set([keyOf(p), keyOf(fh), keyOf(fv)]).size === 3) break;
    }
    const opts = shuffle([{ html: gridHTML(fh), ok: true }, { html: gridHTML(p), ok: false }, { html: gridHTML(fv), ok: false }]);
    return { skill: "mirror",
             story: `${name} holds this picture up to a MIRROR 🪞. Which one does the mirror show?`,
             display: `<div class="shape-row"><span>${gridHTML(p)}</span><span class="mirror-line"></span><span style="font-size:2.4rem">❓</span></div>`,
             equation: "", input: "choice", choices: opts, answer: opts.findIndex(o => o.ok),
             hint: `A mirror flips LEFT and RIGHT. Squares on the left side end up on the right side. Top stays on top!`,
             reveal: "the one flipped left-to-right" };
  }

  /* ---------------- adding THREE numbers (Secret Gardens) ---------------- */
  function add3(max, name, foe) {
    let a, b, c;
    if (Math.random() < .5) {            /* hide a make-ten pair inside */
      a = between(1, 9); c = 10 - a; b = between(1, Math.max(1, max - 10));
    } else {
      a = between(1, 8); b = between(1, 8); c = between(1, Math.max(1, Math.min(8, max - a - b)));
    }
    const t = pick(THINGS);
    const story = pick([
      `${name} found ${a} ${nm(t,a)}, then ${b} more, then ${c} more! How many in all?`,
      `Three chests! One has ${a} ${nm(t,a)}, one has ${b}, and one has ${c}. How many altogether?`,
      `${foe} hid ${a} ${nm(t,a)} under a leaf, ${b} in a flower, and ${c} in a tree. How many did it hide?`,
      `On Monday ${name} earned ${a} ${nm(t,a)}, on Tuesday ${b}, and on Wednesday ${c}. What's the total?`,
    ]);
    const visual = t.e.repeat(a) + " ➕ " + t.e.repeat(b) + " ➕ " + t.e.repeat(c);
    const ten = [[a, b], [a, c], [b, c]].find(([x, y]) => x + y === 10);
    return { skill: "add3", story, visual, picture: visual,
             equation: `${a} + ${b} + ${c} = ?`, input: "number", answer: a + b + c,
             nums: [a, b, c, a + b + c],
             hint: ten ? `Find the two numbers that make 10 (${ten[0]} + ${ten[1]}). Add those first, then add the last one!`
                       : `Add the first two numbers, then add the third one to that.`,
             reveal: `${a} + ${b} + ${c} = ${a + b + c}` };
  }

  /* ---------------- telling time (Sky Isles) ---------------- */
  const fmtTime = (h, m) => h + ":" + String(m).padStart(2, "0");
  const wrap12 = h => ((h - 1) % 12 + 12) % 12 + 1;
  function clockSVG(h, m, size) {
    size = size || 150;
    const P = (r, deg) => [50 + r * Math.sin(deg * Math.PI / 180), 50 - r * Math.cos(deg * Math.PI / 180)].map(v => v.toFixed(1));
    let s = `<svg class="clock" width="${size}" height="${size}" viewBox="0 0 100 100">` +
            `<circle cx="50" cy="50" r="47" fill="#fffdf0" stroke="#2b1a10" stroke-width="4"/>`;
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, [x1, y1] = P(big ? 39 : 41.5, i * 6), [x2, y2] = P(44, i * 6);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2b1a10" stroke-width="${big ? 2 : .8}"/>`;
    }
    for (let n = 1; n <= 12; n++) {
      const [x, y] = P(31, n * 30);
      s += `<text x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="bold" font-family="sans-serif" fill="#2b1a10">${n}</text>`;
    }
    const [hx, hy] = P(21, ((h % 12) + m / 60) * 30), [mx, my] = P(36, m * 6);
    s += `<line x1="50" y1="50" x2="${mx}" y2="${my}" stroke="#2c6de8" stroke-width="3.5" stroke-linecap="round"/>`;
    s += `<line x1="50" y1="50" x2="${hx}" y2="${hy}" stroke="#e8453c" stroke-width="6" stroke-linecap="round"/>`;
    s += `<circle cx="50" cy="50" r="3.5" fill="#2b1a10"/></svg>`;
    return s;
  }
  /* the mistakes kids really make: the wrong hour near half past, mixing up the hands,
     and reading the minute hand's NUMBER as the minutes */
  function timeMistakes(h, m) {
    const out = [[m >= 30 ? wrap12(h + 1) : wrap12(h - 1), m]];
    if (m > 0) out.push([m / 5, (h % 12) * 5]);   /* hands swapped */
    else out.push([12, (h % 12) * 5]);
    if (m > 0 && m !== 5) out.push([h, m / 5]);   /* "4:03" for 4:15 */
    out.push([h, (m + 30) % 60], [wrap12(h + 1), m], [wrap12(h - 1), (m + 30) % 60]);
    return out;
  }
  function timeChoices(h, m, extra) {
    const seen = new Set([fmtTime(h, m)]), list = [[h, m]];
    for (const [a, b] of (extra || []).concat(timeMistakes(h, m))) {
      const k = fmtTime(a, b);
      if (list.length >= 4 || seen.has(k) || a < 1 || a > 12 || b < 0 || b > 59) continue;
      seen.add(k); list.push([a, b]);
    }
    while (list.length < 4) {
      const a = between(1, 12), b = list[0][1], k = fmtTime(a, b);
      if (!seen.has(k)) { seen.add(k); list.push([a, b]); }
    }
    return shuffle(list.map(([a, b], i) => ({ h: a, m: b, ok: i === 0 })));
  }
  function clock(tier, name) {
    const h = between(1, 12);
    const m = tier >= 2 ? pick([0, 30, 15, 45, 5 * between(1, 11), 5 * between(1, 11)]) : pick([0, 30]);
    const kind = tier >= 2 ? pick(["read", "read", "pick", "later"]) : pick(["read", "read", "pick"]);
    const hint = "The SHORT red hand tells the HOUR (use the number it just passed). The LONG blue hand tells the MINUTES: count by 5s from the 12!";
    if (kind === "later") {
      const add = pick([60, 60, 30, 120]);
      const tm = h * 60 + m + add, h2 = wrap12(Math.floor(tm / 60)), m2 = tm % 60;
      const opts = timeChoices(h2, m2, [[h, m], [wrap12(h2 + 1), m2], [h2, (m2 + 30) % 60]]);
      const how = add === 60 ? "1 hour" : add === 120 ? "2 hours" : "30 minutes";
      return { skill: "clock", input: "choice", equation: "",
               story: `The clock says ${fmtTime(h, m)}. ${name}'s cloud ride lasts ${how}. What time will it be when it ends?`,
               display: clockSVG(h, m),
               choices: opts.map(o => ({ html: `<span class="time-chip">${fmtTime(o.h, o.m)}</span>`, ok: o.ok })),
               answer: opts.findIndex(o => o.ok),
               hint: add === 30 ? "30 minutes is HALF an hour: the long hand goes halfway around the clock."
                                : `Each hour, the short hand moves to the NEXT number. Count ${add / 60} ${add === 60 ? "hour" : "hours"} ahead!`,
               reveal: fmtTime(h2, m2) };
    }
    const opts = timeChoices(h, m);
    if (kind === "pick") {
      return { skill: "clock", input: "choice", equation: "",
               story: `Which clock shows ${fmtTime(h, m)}?`, display: `<div class="time-chip big">${fmtTime(h, m)}</div>`,
               choices: opts.map(o => ({ html: clockSVG(o.h, o.m, 92), ok: o.ok })),
               answer: opts.findIndex(o => o.ok), hint, reveal: "the clock showing " + fmtTime(h, m) };
    }
    return { skill: "clock", input: "choice", equation: "",
             story: pick([`What time does the clock show?`, `${name} looks up at the Clock Tower. What time is it?`]),
             display: clockSVG(h, m),
             choices: opts.map(o => ({ html: `<span class="time-chip">${fmtTime(o.h, o.m)}</span>`, ok: o.ok })),
             answer: opts.findIndex(o => o.ok), hint, reveal: fmtTime(h, m) };
  }

  /* gen(skillList, tier) — pick a random skill from the list (repeats = more likely).
     An entry like "add:1" uses that tier instead (easy review in later zones). */
  function gen(skills, tier, name, foe) {
    const [sk, forced] = pick(skills).split(":");
    if (forced) tier = Number(forced);
    const max = tier >= 2 ? 20 : 10;
    switch (sk) {
      case "add":      return add(max, name, foe);
      case "sub":      return sub(max, name, foe);
      case "mult":     return mult(name);
      case "div":      return div(name);
      case "rest":     return rest(max, name, foe);
      case "addto":    return addto(max, name, foe);
      case "takefrom": return takefrom(max, name, foe);
      case "compare":  return compare(max, name, foe);
      case "eqbuild":  return eqbuild(max, name, foe, tier);
      case "related":  return related(max);
      case "pick2":    return pick2(max, name, foe);
      case "tens":     return tens(tier, name, foe);
      case "numline":  return numline(tier, name);
      case "barread":  return barread(tier, name);
      case "barbuild": return barbuild(tier, name);
      case "money":    return money(tier, name, foe);
      case "fraction": return fraction(tier, name, foe);
      case "mirror":   return mirror(tier, name);
      case "add3":     return add3(max, name, foe);
      case "clock":    return clock(tier, name);
    }
    return add(max, name, foe);
  }
  /* is this answer right? `given` depends on the input type */
  function check(p, given) {
    switch (p.input) {
      case "equation": { const q = parseEq(given); return !!q && p.accept(q); }
      case "choice":   return given === p.answer;
      case "multi":    return Array.isArray(given) &&
                         given.slice().sort().join(",") === p.answer.slice().sort().join(",");
      case "graph":    return Array.isArray(given) && given.join(",") === p.answer.join(",");
      case "coins":    return Array.isArray(given) && given.length > 0 && given.reduce((a, b) => a + b, 0) === p.answer;
      default:         return String(given).trim() !== "" && Number(given) === p.answer;
    }
  }
  /* easier block problem: small addition, no picture */
  function blockProblem(name) {
    const p = add(5, name, "the enemy");
    p.story = `Quick, ${name}! Solve to raise your SHIELD!`;
    p.picture = ""; p.visual = "";
    return p;
  }
  const ALL_SKILLS = ["add","sub","mult","div","rest","addto","takefrom","compare","eqbuild",
                      "related","pick2","tens","numline","barread","barbuild","money","fraction","mirror","add3","clock"];
  return { gen, check, parseEq, blockProblem, graphHTML, seqHTML, lineHTML, shapeSVG, gridHTML, coinsHTML, clockSVG, ALL_SKILLS };
})();

/* ============================ COINPAD ============================ */
/* the tap-coins-into-the-purse widget, shared by battles and Practice Park */
const CoinPad = (() => {
  const NAMES = { 1: "penny", 5: "nickel", 10: "dime", 25: "quarter" };
  function html(set) {
    return `<div class="coin-pad"><div class="coin-palette">${set.map(v =>
      `<span style="text-align:center"><button class="coin c${v}" data-v="${v}">${v}¢</button><span class="coin-name">${NAMES[v]}</span></span>`).join("")
    }</div><div class="coin-tray"></div></div>`;
  }
  /* list: array that receives the chosen coin values; isLocked(): true while input is frozen */
  function wire(container, list, isLocked) {
    const tray = container.querySelector(".coin-tray");
    if (!tray) return;
    const draw = () => {
      tray.innerHTML = "";
      list.slice().sort((a, b) => b - a).forEach(v => {
        const c = document.createElement("button");
        c.className = "coin c" + v; c.textContent = v + "¢";
        c.onclick = () => {
          if (isLocked()) return;
          list.splice(list.indexOf(v), 1);
          Sound.play("click"); draw();
        };
        tray.appendChild(c);
      });
    };
    container.querySelectorAll(".coin-palette .coin").forEach(b => {
      b.onclick = () => {
        if (isLocked() || list.length >= 15) return;
        list.push(Number(b.dataset.v));
        Sound.play("click"); draw();
      };
    });
    draw();
  }
  return { html, wire };
})();

/* ============================ PUZZLES ============================ */
/* Reasoning puzzles for puzzle doors and treasure chests. No new math needed:
   patterns, growing patterns, number patterns, odd one out, 3x3 grids,
   balance scales, number riddles. Every puzzle is pick-the-answer:
   { kind, story, display, choices: [{ html }], answer: index, hint, reveal }
   Tier 1 = easier (city & home), tier 2 = later zones. */
const Puzzles = (() => {
  const rand = n => Math.floor(Math.random() * n);
  const between = (a, b) => a + rand(b - a + 1);
  const pick = arr => arr[rand(arr.length)];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const box = (h, miss) => `<span class="pz-item${miss ? " miss" : ""}">${miss ? "?" : h}</span>`;
  const row = items => `<div class="pz-row">${items.join("")}</div>`;
  const SETS = [
    ["🔴", "🔵", "🟢", "🟡", "🟣"],
    ["🔺", "🟦", "⭐", "❤️", "🌙"],
    ["🍎", "🍌", "🍇", "🍓", "🍐"],
    ["🐶", "🐱", "🐰", "🐸", "🐵"],
    ["🚗", "🚀", "🚲", "🚌", "🚁"],
  ];
  /* turn a list of option html (with `right` among them) into shuffled unique choices */
  function finish(p, opts) {
    const uniq = [];
    for (const o of opts) if (!uniq.includes(o)) uniq.push(o);
    const sh = shuffle(uniq);
    p.choices = sh.map(h => ({ html: h }));
    p.answer = sh.indexOf(p.right);
    return p;
  }

  function pattern(tier) {
    const unit = pick(tier >= 2 ? ["AB", "ABC", "AAB", "ABB", "AABB", "ABCC"] : ["AB", "AB", "AAB", "ABB", "ABC"]);
    const letters = [...new Set(unit.split(""))];
    const items = shuffle(pick(SETS)).slice(0, letters.length + 1);
    const map = {}; letters.forEach((c, i) => map[c] = items[i]);
    const len = Math.max(unit.length * 2 + 1, 7);
    const seq = Array.from({ length: len + 1 }, (_, i) => map[unit[i % unit.length]]);
    const middle = tier >= 2 && Math.random() < .35;
    const miss = middle ? between(unit.length, len - 1) : len;
    const shown = (middle ? seq : seq.slice(0, len + 1)).map((e, i) => box(e, i === miss));
    const right = seq[miss];
    const p = { kind: "pattern", right,
      story: middle ? "Something fell out of the pattern! What is MISSING?" : "What comes NEXT in the pattern?",
      display: row(shown),
      hint: "Find the part that repeats: " + unit.split("").map(c => map[c]).join("") + ", " + unit.split("").map(c => map[c]).join("") + "...",
      reveal: right };
    return finish(p, letters.map(c => map[c]).concat([items[letters.length]]));
  }

  function growing(tier) {
    const e = pick(["⭐", "🍎", "🟦", "🐟", "🍩", "🔺"]);
    const step = tier >= 2 ? pick([1, 2]) : 1;
    const start = step === 2 ? 1 : between(1, 2);
    const counts = [0, 1, 2, 3].map(i => start + i * step);
    const rightN = start + 4 * step;
    const p = { kind: "growing", right: e.repeat(rightN),
      story: "This pattern GROWS! What comes next?",
      display: row(counts.map(c => box(e.repeat(c))).concat([box("", true)])),
      hint: `Each picture has ${step} more ${e} than the one before.`,
      reveal: `${rightN} ${e}` };
    return finish(p, [rightN, counts[3], rightN + 1].map(n => e.repeat(n)));
  }

  function numpattern(tier) {
    const step = pick(tier >= 2 ? [2, 5, 10, 10, -1, -2, -10] : [1, 1, 2, 10]);
    const START = {
      1: () => between(0, 15), 2: () => between(0, tier >= 2 ? 40 : 10),
      5: () => 5 * between(0, 10), 10: () => tier >= 2 ? between(0, 9) * (Math.random() < .5 ? 1 : 0) + 10 * between(0, 5) : 10 * between(0, 4),
      "-1": () => between(5, 30), "-2": () => between(10, 40), "-10": () => 10 * between(5, 10),
    };
    const start = START[step]();
    const vals = [0, 1, 2, 3, 4].map(i => start + i * step);
    const middle = tier >= 2 && Math.random() < .3;
    const miss = middle ? between(1, 3) : 4;
    const right = String(vals[miss]);
    const alt1 = vals[miss] + (Math.abs(step) === 1 ? 2 * Math.sign(step) : 1);
    const alt2 = vals[miss] + step;
    const p = { kind: "numpattern", right,
      story: middle ? "Which number is MISSING from the pattern?" : "What number comes NEXT?",
      display: row(vals.map((v, i) => box(String(v), i === miss))),
      hint: step > 0 ? `Each number is ${step} MORE than the one before.` : `Each number is ${-step} LESS than the one before.`,
      reveal: right };
    const v = vals[miss];
    const alts = [alt1, alt2, v + 1, v + 3, v + 10].filter(n => n >= 0 && n <= 100 && n !== v);
    return finish(p, [right].concat([...new Set(alts)].slice(0, 2).map(String)));
  }

  const CATS = [
    ["fruits", ["🍎", "🍌", "🍇", "🍓", "🍐", "🍒"]],
    ["animals", ["🐶", "🐱", "🐰", "🐸", "🐵", "🐷"]],
    ["things that go", ["🚗", "🚌", "🚲", "🚀", "🚂", "🚁"]],
    ["sweet treats", ["🍩", "🍪", "🍰", "🧁", "🍭"]],
    ["clothes", ["👕", "👖", "👟", "🧢", "🧦"]],
    ["balls", ["⚽", "🏀", "🏈", "⚾", "🎾"]],
  ];
  function oddone(tier) {
    if (tier >= 2 && Math.random() < .3) {
      const tens = shuffle([10, 20, 30, 40, 50, 60, 70, 80, 90]).slice(0, 3);
      let odd; do { odd = between(11, 99); } while (odd % 10 === 0);
      const items = shuffle(tens.concat([odd])).map(String);
      const p = { kind: "oddone", right: String(odd), story: "Which number does NOT belong?",
        display: row(items.map(i => box(i))),
        hint: "Three of these are numbers you say when you count by 10s.",
        reveal: `${odd}, because the others are all tens (count by 10s!)` };
      return finish(p, items);
    }
    const [a, b] = shuffle(CATS).slice(0, 2);
    const three = shuffle(a[1]).slice(0, 3), odd = pick(b[1]);
    const items = shuffle(three.concat([odd]));
    const p = { kind: "oddone", right: odd, story: "Which one does NOT belong with the others?",
      display: row(items.map(i => box(i))),
      hint: "Three of them are the same kind of thing.",
      reveal: `${odd}, because the others are all ${a[0]}` };
    return finish(p, items);
  }

  function matrix(tier) {
    const items = shuffle(pick(SETS)).slice(0, 3);
    const cell = h => `<span class="pz-cell">${h}</span>`;
    if (tier < 2 || Math.random() < .4) {
      /* each row is one thing, counting 1, 2, 3 across */
      const cells = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        cells.push(r === 2 && c === 2 ? `<span class="pz-cell miss">?</span>` : cell(items[r].repeat(c + 1)));
      const p = { kind: "matrix", right: items[2].repeat(3),
        story: "Which picture finishes the grid?",
        display: `<div class="pz-grid">${cells.join("")}</div>`,
        hint: "Look across each row: 1, then 2, then 3!",
        reveal: items[2].repeat(3) };
      return finish(p, [items[2].repeat(3), items[2].repeat(2), items[1].repeat(3)]);
    }
    /* every row and every column has one of each */
    const g = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      cells.push(r === 2 && c === 2 ? `<span class="pz-cell miss">?</span>` : cell(items[g[r][c]]));
    const p = { kind: "matrix", right: items[g[2][2]],
      story: "Which picture finishes the grid?",
      display: `<div class="pz-grid">${cells.join("")}</div>`,
      hint: "Every row and every column has ONE of each picture. Which one is missing from the last row?",
      reveal: items[g[2][2]] };
    return finish(p, items.slice());
  }

  function balance(tier) {
    const [A, B] = shuffle(["🍎", "🍌", "🍓", "🥕", "🍐", "🧀", "🍪"]).slice(0, 2);
    const k = tier >= 2 ? between(2, 3) : 2, m = k === 3 ? 2 : between(2, 3);   /* answers stay at 6 or less */
    const right = k * m;
    const scale = (l, r) => `<div class="pz-scale"><span class="pz-pan">${l}</span><span class="pz-fulcrum">⚖️</span><span class="pz-pan">${r}</span></div>`;
    const p = { kind: "balance", right: String(right),
      story: `The first scale shows ${k} ${A} weigh the SAME as 1 ${B}. How many ${A} balance ${m} ${B}?`,
      display: scale(A.repeat(k), B) + scale(`<span class="pz-q">?</span>`, B.repeat(m)),
      hint: `Every ${B} needs ${k} ${A}. Count ${k} for each ${B}!`,
      reveal: `${right} ${A}` };
    return finish(p, [String(right), String(k + m === right ? right + 1 : k + m), String(right - 1)]);
  }

  function riddle(tier) {
    const easy = [
      () => { const n = between(2, 9); return [`I am 1 MORE than ${n}. What number am I?`, n + 1]; },
      () => { const n = between(2, 10); return [`I am 1 LESS than ${n}. What number am I?`, n - 1]; },
      () => { const n = between(1, 8); return [`I am BETWEEN ${n} and ${n + 2}. What number am I?`, n + 1]; },
      () => { const n = between(1, 7); return [`I am 2 MORE than ${n}. What number am I?`, n + 2]; },
      () => { const n = between(5, 19); return [`I come right AFTER ${n} when you count. What number am I?`, n + 1]; },
    ];
    const hard = [
      () => { const n = between(11, 89); return [`I am 10 MORE than ${n}. What number am I?`, n + 10]; },
      () => { const n = between(20, 99); return [`I am 10 LESS than ${n}. What number am I?`, n - 10]; },
      () => { const t = between(1, 9), o = between(0, 9); return [`I have ${t} tens and ${o} ones. What number am I?`, 10 * t + o]; },
      () => { const n = between(21, 100); return [`I come right BEFORE ${n} when you count. What number am I?`, n - 1]; },
    ];
    const [story, ans] = pick(tier >= 2 ? hard.concat(easy) : easy)();
    const big = ans >= 10;
    const p = { kind: "riddle", right: String(ans),
      story: "🤔 RIDDLE: " + story,
      display: `<div class="pz-riddle">🤔</div>`,
      hint: "Read the riddle slowly and count it out on your fingers or a number line.",
      reveal: String(ans) };
    const alts = big ? [ans + 1, ans - 1, ans + 10, ans - 10] : [ans + 1, ans - 1, ans + 2];
    return finish(p, [String(ans)].concat(shuffle(alts.filter(v => v >= 0 && v !== ans)).slice(0, 2).map(String)));
  }

  const KINDS = {
    1: ["pattern", "pattern", "pattern", "growing", "growing", "oddone", "oddone", "riddle", "riddle", "matrix", "balance", "numpattern"],
    2: ["pattern", "pattern", "growing", "numpattern", "numpattern", "oddone", "matrix", "matrix", "balance", "balance", "riddle", "riddle"],
  };
  const MAKERS = { pattern, growing, numpattern, oddone, matrix, balance, riddle };
  function gen(tier) { return MAKERS[pick(KINDS[tier >= 2 ? 2 : 1])](tier); }
  return { gen, MAKERS };
})();

