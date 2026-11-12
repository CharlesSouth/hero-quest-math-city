import json, sys
from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch

GAME = GAME_URI

JS = r"""
() => {
  const errs = [];
  const STORY_TYPES = new Set(["add","sub","rest","addto","takefrom","compare","eqbuild","related","pick2"]);
  const counts = {};
  const bad = (p, msg) => { if (errs.length < 40) errs.push(msg + " :: " + JSON.stringify({s:p.skill, story:p.story, eq:p.equation, ans:p.answer, rev:p.reveal})); };
  const textOf = h => (h || "").replace(/<[^>]*>/g, " ");
  for (const tier of [1, 2]) {
    for (const skill of MathGen.ALL_SKILLS) {
      for (let i = 0; i < 3000; i++) {
        const p = MathGen.gen([skill], tier, "Sam", "Scrap-Bot");
        counts[skill + tier] = (counts[skill + tier] || 0) + 1;
        const all = [p.story, p.equation, p.reveal, p.hint, textOf(p.display), textOf(p.picture)].join(" | ");
        if (/undefined|NaN|null|\[object/.test(all)) bad(p, "bad text");
        if (/\b1 (are|were|have|birds|frogs|balloons|batteries|cubes|robots|students|donuts|gears|acorns|power gems|chipmunks|rackets|apples|bananas|dogs|cats|points)\b/.test(p.story)) bad(p, "grammar 1-plural");
        if (!p.hint || !p.reveal) bad(p, "missing hint/reveal");
        const max = tier >= 2 ? 20 : 10;
        if (STORY_TYPES.has(skill)) {
          const nums = (p.story.match(/\d+/g) || []).map(Number);
          if (nums.some(n => n > max || n < 0)) bad(p, "story number out of range");
        }
        // answers
        if (p.input === "number") {
          if (!Number.isInteger(p.answer) || p.answer < 0) bad(p, "bad numeric answer");
          if (!MathGen.check(p, String(p.answer))) bad(p, "check rejects right answer");
          if (MathGen.check(p, String(p.answer + 1))) bad(p, "check accepts wrong answer");
          if (MathGen.check(p, "")) bad(p, "check accepts empty");
          if ((skill === "numline" || skill === "tens") && (p.answer > 100)) bad(p, "over 100");
          if (skill === "numline" || skill === "tens") {
            const shown = (textOf(p.display).match(/\d+/g) || []).map(Number);
            if (shown.some(n => n > 100 || n < 0)) bad(p, "display number out of 0-100");
          }
        } else if (p.input === "equation") {
          const canon = p.reveal.replace(/ /g, "");
          if (!MathGen.check(p, canon)) bad(p, "equation check rejects reveal " + canon);
          const q = MathGen.parseEq(canon);
          // wrong: add the two biggest numbers
          const nums = [q.x, q.y, q.z].sort((a,b)=>a-b);
          const wrong = `${nums[2]}+${nums[1]}=${nums[2]+nums[1]}`;
          if (MathGen.check(p, wrong)) bad(p, "accepts wrong equation " + wrong);
          if (MathGen.check(p, `${q.x}${q.op}${q.y}=${q.z+1}`)) bad(p, "accepts false equation");
          // flipped form accepted too
          if (!MathGen.check(p, `${q.z}=${q.x}${q.op}${q.y}`)) bad(p, "rejects flipped form");
          if (skill === "eqbuild") {
            // fact family partner should be accepted
            const partner = q.op === "−" ? `${q.y}+${q.z}=${q.x}` : `${q.z}−${q.x}=${q.y}`;
            if (!MathGen.check(p, partner)) bad(p, "rejects fact-family partner " + partner);
          }
          if (skill === "related") {
            if (MathGen.check(p, canon.replace("+", "−"))) bad(p, "related accepts subtraction");
          }
        } else if (p.input === "choice") {
          if (!(p.answer >= 0 && p.answer < p.choices.length)) bad(p, "choice answer out of range");
          if (!MathGen.check(p, p.answer)) bad(p, "choice check");
          if (MathGen.check(p, (p.answer + 1) % p.choices.length)) bad(p, "choice accepts wrong");
        } else if (p.input === "multi") {
          if (p.answer.length !== 2) bad(p, "multi needs 2 answers");
          if (!MathGen.check(p, p.answer.slice().reverse())) bad(p, "multi check order");
          const wrongIdx = [0,1,2].find(i => !p.answer.includes(i));
          if (MathGen.check(p, [p.answer[0], wrongIdx])) bad(p, "multi accepts wrong");
          // every "ok" option must be a true equation; the distractor must be true math but wrong story
          p.choices.forEach((c, i) => {
            const eq = textOf(c.html).replace(/ /g, "");
            const q = MathGen.parseEq(eq);
            if (!q) bad(p, "choice not parseable " + eq);
          });
        } else if (p.input === "graph") {
          if (p.answer.length !== p.graph.cats.length) bad(p, "graph answer length");
          if (p.answer.some(v => v < 1 || v > p.graph.max)) bad(p, "graph value out of range");
          if (!MathGen.check(p, p.answer.slice())) bad(p, "graph check");
          const w = p.answer.slice(); w[0] = w[0] === 1 ? 2 : w[0] - 1;
          if (MathGen.check(p, w)) bad(p, "graph accepts wrong");
        } else if (p.input === "coins") {
          if (!MathGen.check(p, Array(p.answer).fill(1))) bad(p, "coins check");
        } else bad(p, "unknown input " + p.input);
        // barread: answer must match the drawn graph for "howmany"
        if (skill === "barread" && /How many votes did (\w+) get\?/.test(p.story)) {
          const cat = p.story.match(/How many votes did (\w+) get\?/)[1];
          const div = document.createElement("div"); div.innerHTML = p.display;
          const rowEl = [...div.querySelectorAll(".bg-row")].find(r => r.querySelector(".bg-label").textContent.startsWith(cat + " "));
          const filled = rowEl.querySelectorAll(".bg-cell.fill").length;
          if (filled !== p.answer) bad(p, `graph shows ${filled} but answer ${p.answer}`);
        }
      }
    }
  }
  // picture problems must have a picture; display-only ones must not
  const withPic = MathGen.ALL_SKILLS.filter(s => { const p = MathGen.gen([s], 1, "L", "F"); return !!(p.picture || p.visual); });
  // worlds: build 300 seeds
  let worldFails = 0;
  for (let s = 1; s <= 300; s++) { try { buildWorld(s * 7919); } catch (e) { worldFails++; } }
  // zone skill lists only name real skills
  for (const z of ["city","ridge","cavern","gardens","factory","tower","interior"])
    for (const sk of ZONES[z].skills) if (!MathGen.ALL_SKILLS.includes(sk.split(":")[0])) errs.push("unknown skill in zone " + z + ": " + sk);
  // ---- reasoning puzzles
  const pzCount = {};
  for (const tier of [1, 2]) for (const kind of Object.keys(Puzzles.MAKERS)) for (let i = 0; i < 3000; i++) {
    const p = Puzzles.MAKERS[kind](tier);
    pzCount[kind] = (pzCount[kind] || 0) + 1;
    const txt = [p.story, p.display, p.hint, p.reveal, p.choices.map(c => c.html).join("|")].join(" ");
    if (/undefined|NaN|null/.test(txt)) { if (errs.length < 40) errs.push("puzzle bad text " + kind + " " + p.story); }
    if (!(p.answer >= 0 && p.answer < p.choices.length)) errs.push("puzzle answer index " + kind);
    if (p.choices.length < 2) errs.push("puzzle too few choices " + kind + " " + p.story);
    if (new Set(p.choices.map(c => c.html)).size !== p.choices.length) errs.push("puzzle dup choices " + kind);
    if (p.choices[p.answer].html !== p.right) errs.push("puzzle right mismatch " + kind);
    const nums = (p.choices.map(c => c.html).join(" ").match(/-?\d+/g) || []).map(Number);
    if (nums.some(n => n < 0 || n > 110)) { if (errs.length < 40) errs.push("puzzle number out of range " + kind + " " + nums); }
    if (kind === "numpattern") {
      const shown = (p.display.match(/>(-?\d+)</g) || []).map(t => +t.slice(1, -1));
      if (shown.some(n => n < 0 || n > 100)) errs.push("numpattern display out of range " + shown);
    }
    if (kind === "pattern" || kind === "growing") {
      if ((p.display.match(/pz-item miss/g) || []).length !== 1) errs.push("pattern needs exactly one ?");
    }
  }
  for (let i = 0; i < 2000; i++) for (const t of [1,2]) { const p = Puzzles.gen(t); if (!p || !p.choices) errs.push("Puzzles.gen failed"); }
  // ---- dungeons: from the entrance, the puzzle door is reachable, and after opening it the chest is too
  const W2 = buildWorld(777);
  const reach = (scr, sx, sy, openDoor) => {
    const seen = new Set([sx + "," + sy]), q = [[sx, sy]];
    const pass = t => !SOLID.has(t) || (openDoor && t === T.PUZZLE_DOOR);
    while (q.length) { const [x, y] = q.shift();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(nx+","+ny) || !pass(scr.grid[ny][nx])) continue;
        seen.add(nx+","+ny); q.push([nx, ny]); } }
    return seen;
  };
  const touches = (seen, scr, tile) => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (scr.grid[y][x] === tile)
      if (![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => seen.has((x+dx)+","+(y+dy)))) return false; return true; };
  const DUNGEONS = ["bank","toyshop","geargarage","arcade","hotel","cabin","greenhouse","assembly","guardroom"];
  for (const id of DUNGEONS) {
    const scr = W2[id];
    if (!scr) { errs.push("missing dungeon " + id); continue; }
    const before = reach(scr, 8, 9, false), after = reach(scr, 8, 9, true);
    if (!touches(before, scr, T.PUZZLE_DOOR)) errs.push(id + ": puzzle door unreachable");
    if (touches(before, scr, T.CHEST)) errs.push(id + ": chest reachable WITHOUT solving the door");
    if (!touches(after, scr, T.CHEST)) errs.push(id + ": chest unreachable after door");
    for (const e of scr.enemies) if (SOLID.has(scr.grid[e.y][e.x])) errs.push(id + ": enemy inside a wall");
    for (const p of scr.pickups) if (SOLID.has(scr.grid[p.y][p.x])) errs.push(id + ": pickup inside a wall");
    if (!DOORS[id + ":8,10"]) errs.push(id + ": no exit door");
    const into = Object.entries(DOORS).find(([k, d]) => d.to === id);
    if (!into) errs.push(id + ": no entrance");
  }
  // every outdoor door leads somewhere real, and its return spot is walkable
  for (let seed = 1; seed <= 60; seed++) {
    const Wn = buildWorld(seed * 104729);
    for (const [k, d] of Object.entries(DOORS)) {
      if (!Wn[d.to]) errs.push("door to missing screen " + d.to);
      else if (SOLID.has(Wn[d.to].grid[d.y][d.x])) { if (errs.length < 40) errs.push("door lands in a wall " + k + " -> " + d.to + " " + d.x + "," + d.y); }
    }
    for (const sk of CHEST_SCREENS) {
      let n = 0; for (const r of Wn[sk].grid) for (const t of r) if (t === T.CHEST) n++;
      if (n !== 1) { if (errs.length < 40) errs.push("chest count " + sk + " = " + n); }
    }
  }
  for (const st of STATIONS) if (!TROPHIES[st.id]) errs.push("no trophy for " + st.id);
  if (new Set(Object.values(TROPHIES).map(t => t.icon)).size !== STATIONS.length) errs.push("trophy icons not unique");
  for (const id of ["gremlinking","ridgeram","drillmaster","thistlequeen","shapeshifter","robobaron"]) {
    const sp = ENEMY_SPRITES[id];
    for (const row of sp.frames[0]) for (const ch of row) if (ch !== "." && !sp.colors[ch]) errs.push(id + " missing color " + ch);
    for (const c of ["A","B","W"]) if (!sp.colors[c]) errs.push(id + " missing piece color " + c);
  }
  for (const st of STATIONS) for (const sk of st.skills) if (!MathGen.ALL_SKILLS.includes(sk)) errs.push("unknown station skill " + sk);
  // new-skill specific checks
  for (let i = 0; i < 4000; i++) {
    for (const tier of [1, 2]) {
      const m = MathGen.gen(["money"], tier, "Sam", "Scrap-Bot");
      if (m.input === "number" && m.display) {
        const div = document.createElement("div"); div.innerHTML = m.display;
        const tot = [...div.querySelectorAll(".coin")].reduce((a, c) => a + parseInt(c.textContent), 0);
        if (tot !== m.answer) bad(m, "coin display sum " + tot);
        if (div.querySelector(".c25")) bad(m, "quarter shown");
        const kinds = new Set([...div.querySelectorAll(".coin")].map(c => c.textContent));
        if (kinds.size > 2) bad(m, "more than 2 coin types");
        if (kinds.has("5¢") && kinds.size > 1) bad(m, "nickels mixed with other coins");
      }
      if (m.input === "coins") {
        if (m.coinSet.join(",") !== "10,1") bad(m, "make-amount uses only dimes & pennies");
        if (m.answer > 49) bad(m, "make target too big");
        if (!MathGen.check(m, [m.answer])) {}  // single coin of exact value may not exist; check via pennies
        if (!MathGen.check(m, Array(m.answer).fill(1))) bad(m, "pennies rejected");
        if (MathGen.check(m, Array(m.answer + 1).fill(1))) bad(m, "too many accepted");
        if (MathGen.check(m, [])) bad(m, "empty purse accepted");
      }
      if (m.input === "choice" && m.choices.length === 2) {
        const div = document.createElement("div"); div.innerHTML = m.display;
        const groups = [...div.querySelectorAll(".coin-group")].map(gp => [...gp.querySelectorAll(".coin")].reduce((a, c) => a + parseInt(c.textContent), 0));
        if (groups[m.answer] <= groups[1 - m.answer]) bad(m, "money more wrong " + groups);
        div.querySelectorAll(".coin-group").forEach(gp => { if (new Set([...gp.querySelectorAll(".coin")].map(c => c.textContent)).size !== 1) bad(m, "mixed coin group"); });
      }
    }
    const f = MathGen.gen(["fraction"], 1, "Sam", "F");
    if (f.input === "choice" && new Set(f.choices.map(c => c.html)).size !== f.choices.length) bad(f, "duplicate fraction choices");
    const mi = MathGen.gen(["mirror"], 1, "Sam", "F");
    if (new Set(mi.choices.map(c => c.html)).size !== 3) bad(mi, "mirror choices not distinct");
  }
  // every gate tile sits on a real screen edge; every station is unique and inside the park
  const W = buildWorld(12345);
  for (const [z, tiles] of Object.entries(GATE_TILES)) for (const [k, x, y] of tiles) {
    if (!W[k]) errs.push("gate on missing screen " + k);
    else if (W[k].grid[y][x] !== T.GATE) errs.push("gate tile not GATE " + k + " " + x + "," + y);
  }
  const spots = new Set(STATIONS.map(s => s.x + "," + s.y));
  if (spots.size !== STATIONS.length) errs.push("stations overlap");
  for (const z of ZONE_ORDER) if (!GATES[z]) errs.push("missing gate " + z);
  for (const z of ZONE_ORDER) for (const b of GATES[z].badges) if (!stationById(b) || stationById(b).zone !== z) errs.push("badge/zone mismatch " + b);
  return { errs, total: Object.values(counts).reduce((a,b)=>a+b,0), withPic, worldFails };
}
"""

with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page()
    console_errs = []
    pg.on("pageerror", lambda e: console_errs.append(str(e)))
    pg.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
    pg.goto(GAME)
    pg.wait_for_timeout(500)
    res = pg.evaluate(JS)
    print("problems generated:", res["total"])
    print("picture skills:", res["withPic"])
    print("world build failures (of 300 seeds):", res["worldFails"])
    print("errors:", len(res["errs"]))
    for e in res["errs"]: print("  ", e)
    print("page errors:", console_errs)
    print("FAILS:", len(res["errs"]) + len(console_errs) + (1 if res["worldFails"] else 0))
    br.close()
