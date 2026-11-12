from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch
GAME = GAME_URI
SHOTS = str(SHOT_DIR / "r7_")
CLIP = {"x": 150, "y": 250, "width": 800, "height": 560}
fails = []
def ok(c, m):
    print(("ok: " if c else "FAIL: ") + m)
    if not c: fails.append(m)
def step(pg, key, x, y, arrow, ms=280):
    pg.evaluate(f"() => Overworld.debugGoTo('{key}', {x}, {y})"); pg.wait_for_timeout(120)
    pg.keyboard.down(arrow); pg.wait_for_timeout(ms); pg.keyboard.up(arrow); pg.wait_for_timeout(250)
def battle_ready(pg):
    pg.wait_for_function("() => Main.currentScreen() === 'screen-battle'", timeout=4000)
    pg.wait_for_function("() => { const B = Battle.debugState(); return B.problem && !B.locked && B.phase === 'attack'; }", timeout=12000)
with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)

    # ---- unique enemies
    FOES = ["gremlin","scrapbot","rockroller","billybot","molebot","glowbat","bramblebug","buzzbee","gizmobot","sprocket","knightbot","sparkghost","puffcloud","ticktock"]
    bad = pg.evaluate(f"""() => {{ const out = [];
      for (const id of {FOES}) {{ const s = ENEMY_SPRITES[id];
        if (!s) {{ out.push(id + ' missing'); continue; }}
        for (const f of s.frames) {{ if (f.length !== 12) out.push(id + ' rows'); for (const r of f) {{ if (r.length !== 12) out.push(id + ' row ' + r);
          for (const ch of r) if (ch !== '.' && !s.colors[ch]) out.push(id + ' color ' + ch); }} }} }}
      const keys = {FOES}.map(id => ENEMY_SPRITES[id].frames[0].join(''));
      if (new Set(keys).size !== keys.length) out.push('duplicate art');
      return out; }}""")
    ok(not bad, f"14 foes, all 12x12, all colors defined, all different art {bad}")
    # sprite sheet screenshot
    pg.evaluate(f"""() => {{ const c = document.createElement('canvas'); c.width = 14 * 80; c.height = 200; c.id = 'sheet';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#8fb0d0';
      document.body.appendChild(c); const x = c.getContext('2d');
      {FOES}.forEach((id, i) => {{ const s = ENEMY_SPRITES[id]; drawGrid(x, s.frames[0], s.colors, i * 80 + 4, 4, 6);
        const gs = goldSprite(s); drawGrid(x, gs.frames[1], gs.colors, i * 80 + 4, 100, 6); }}); }}""")
    pg.screenshot(path=SHOTS + "foes.png", clip={"x": 0, "y": 0, "width": 1100, "height": 200})
    pg.evaluate("() => document.getElementById('sheet').remove()")

    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)
    zt = pg.evaluate("""() => { const W = Overworld.debugWorld(), out = {};
        for (const [k, s] of Object.entries(W)) for (const e of (s.enemies || [])) if (!e.boss && !e.storeBully) {
          const z = s.battleZone || s.zone; (out[z] = out[z] || new Set()).add(e.type); }
        return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()])); }""")
    print(zt)
    expect = {"cavern": {"molebot","glowbat"}, "ridge": {"rockroller","billybot"}, "gardens": {"bramblebug","buzzbee"},
              "factory": {"gizmobot","sprocket"}, "tower": {"knightbot","sparkghost"}, "sky": {"puffcloud","ticktock"}}
    for z, types in expect.items():
        ok(set(zt.get(z, [])) <= types and len(zt.get(z, [])) >= 1, f"{z} uses its own foes {zt.get(z)}")

    # ---- generators: clock + add3
    errs_gen = pg.evaluate("""() => { const out = [];
      for (let i = 0; i < 3000; i++) for (const tier of [1, 2]) {
        const p = MathGen.gen(['clock'], tier, 'L', 'F');
        const labels = p.choices.map(c => c.html);
        if (p.choices.length !== 4 || new Set(labels).size !== 4) out.push('choices ' + labels.join('|'));
        if (!(p.answer >= 0 && p.answer < 4)) out.push('answer');
        if (tier === 1 && !/:(00|30)/.test(p.reveal)) out.push('tier1 time ' + p.reveal);
        if (!MathGen.check(p, p.answer)) out.push('check');
      }
      for (let i = 0; i < 3000; i++) { const p = MathGen.gen(['add3'], 2, 'L', 'F');
        const [a, b, c, s] = p.nums; if (a + b + c !== s || s > 20 || a < 1 || b < 1 || c < 1 || p.answer !== s) out.push('add3 ' + p.nums); }
      return out.slice(0, 5); }""")
    ok(not errs_gen, f"6000 clock + 3000 add3 problems valid {errs_gen}")
    # a correct-answer clock check: 3:30 read problem has 3:30 as the answer chip
    ok(pg.evaluate("""() => { for (let i = 0; i < 200; i++) { const p = MathGen.gen(['clock'], 1, 'L', 'F');
         if (p.story.startsWith('What time') && !p.choices[p.answer].html.includes(p.reveal)) return false; } return true; }"""), "read-the-clock answers match")

    # ---- Wishing Lake: path north from Hero Base
    step(pg, "0,0", 12, 1, "ArrowUp", 400)
    ok(pg.evaluate("Overworld.getSave().key") == "0,-1", "Hero Base -> Wishing Lake (north)")
    pg.wait_for_timeout(800)
    ok("FLY" in pg.inner_text("#toast"), "lake hint: " + pg.inner_text("#toast"))
    pg.screenshot(path=SHOTS + "lake.png", clip=CLIP)
    step(pg, "0,-1", 7, 7, "ArrowUp")
    ok(pg.evaluate("Overworld.getSave().ty") == 7 and "FLIGHT" in pg.inner_text("#toast"), "can't cross the lake without flight")
    pg.evaluate("() => { Main.getGame().powers.flight = true; }")
    step(pg, "0,-1", 7, 7, "ArrowUp", 2000)
    ok(pg.evaluate("Overworld.getSave().key") in ("0,-1", "0,-2") and pg.evaluate("Overworld.getSave().ty") < 4 or pg.evaluate("Overworld.getSave().key") == "0,-2", "flew across the lake")
    step(pg, "0,-1", 7, 1, "ArrowUp", 400)
    ok(pg.evaluate("Overworld.getSave().key") == "0,-2", "lake -> Sky Isles")
    pg.wait_for_timeout(900)
    ok("SKY ISLES" in pg.inner_text("#toast"), "sky hint: " + pg.inner_text("#toast"))
    pg.evaluate("() => Overworld.debugWorld()['0,-2'].enemies.forEach(e => e.defeated = true)")
    pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "sky.png", clip=CLIP)
    # the time station
    st = pg.evaluate("STATIONS.find(s => s.id === 'time')")
    step(pg, "0,-2", st["x"], st["y"] + 1, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-tutorial" and "TIME" in pg.inner_text("#tut-title"), "time station opens its lesson")
    ok("SKY ISLES" in pg.inner_text("#tut-badge-status"), "status: " + pg.inner_text("#tut-badge-status"))
    pg.screenshot(path=SHOTS + "time_lesson1.png")
    for k in range(10):
        if "CHALLENGE" in pg.inner_text("#btn-tut-next"): break
        pg.click("#btn-tut-next"); pg.wait_for_timeout(250)
        if k == 3: pg.screenshot(path=SHOTS + "time_lesson4.png")
    pg.click("#btn-tut-next"); pg.wait_for_timeout(400)
    for k in range(3):
        pg.wait_for_function("() => { const d = Tutorial.debugState(); return d.problem && !d.locked; }", timeout=8000)
        if k == 0: pg.screenshot(path=SHOTS + "time_challenge.png")
        ans = pg.evaluate("Tutorial.debugState().problem.answer")
        pg.locator("#tut-choices .choice-btn").nth(ans).click(); pg.wait_for_timeout(1800)
    pg.wait_for_timeout(500)
    ok(pg.evaluate("Main.getGame().badges.time") is True, "time badge earned")
    ok("Sky Isles" in pg.inner_text("#tut-caption"), "badge caption: " + pg.inner_text("#tut-caption"))
    ok(pg.inner_text("#hud-badges") == "🏅 1/10", "HUD shows 1/10")
    pg.click("#btn-tut-exit"); pg.wait_for_timeout(200)
    # sky battle uses clocks
    pg.evaluate("() => { Main.getGame().hints.lens = true; Battle.start({type:'ticktock', x:0, y:0}, '0,-2'); }")
    battle_ready(pg)
    ok(pg.evaluate("Battle.debugState().problem.skill") == "clock", "sky battles are clock problems")
    pg.screenshot(path=SHOTS + "sky_battle.png")
    pg.evaluate("() => Battle.debugWin()"); pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
    step(pg, "0,-2", 7, 1, "ArrowUp", 400)
    ok(pg.evaluate("Overworld.getSave().key") == "0,-3", "Sky Isles -> Clock Tower")
    pg.evaluate("() => Overworld.debugWorld()['0,-3'].enemies.forEach(e => e.defeated = true)")
    pg.wait_for_timeout(600)
    pg.screenshot(path=SHOTS + "clocktower.png", clip=CLIP)

    # ---- travel: sky needs flight
    pg.evaluate("() => { const g = Main.getGame(); g.bike = 3; g.powers.flight = false; }")
    pg.evaluate("() => Garage.open('travel')"); pg.wait_for_timeout(150)
    ok("Only flyers" in pg.inner_text("#garage-items .shop-item:has-text('Sky Isles')"), "travel: Sky Isles locked without flight")
    pg.evaluate("() => { Main.getGame().powers.flight = true; Garage.open('travel'); }"); pg.wait_for_timeout(150)
    pg.locator("#garage-items .shop-item:has-text('Sky Isles') .shop-buy").click(); pg.wait_for_timeout(300)
    ok(pg.evaluate("Overworld.getSave().key") == "0,-2", "rode the hover-bike to the Sky Isles")

    # ---- cavern battles: graphs & coins
    seen = set()
    for i in range(12):
        pg.evaluate("() => Battle.start({type:'molebot', x:0, y:0}, '2,-1')"); battle_ready(pg)
        seen.add(pg.evaluate("Battle.debugState().problem.skill")); pg.evaluate("() => Battle.debugWin()")
        pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
    ok(seen & {"barread","barbuild","money"} and seen <= {"barread","barbuild","money","compare","rest","eqbuild","numline"}, f"cavern problems: {seen}")

    # ---- Secret Gardens: shut until the Robo-Baron
    pg.evaluate("""() => { const g = Main.getGame(); g.progress = {city:true,ridge:true,cavern:true,gardens:false,factory:true,baron:false};
        STATIONS.forEach(s => g.badges[s.id] = true); g.hints.cavern = true; Overworld.unlockGates(g); Overworld.debugWorld()["3,-1"].enemies.forEach(e => e.defeated = true); }""")
    step(pg, "3,-1", 14, 4, "ArrowRight", 400)
    ok(pg.evaluate("Overworld.getSave().key") == "3,-1" and "ROBO-BARON" in pg.inner_text("#toast"), "gardens locked: " + pg.inner_text("#toast"))
    pg.evaluate("() => { const g = Main.getGame(); g.progress.baron = true; Overworld.unlockGates(g); }")
    step(pg, "3,-1", 14, 4, "ArrowRight", 400)
    ok(pg.evaluate("Overworld.getSave().key") == "4,-1", "gardens open after the Robo-Baron")
    pg.wait_for_timeout(900)
    ok("SECRET GARDENS" in pg.inner_text("#toast"), "gardens hint: " + pg.inner_text("#toast"))
    pg.evaluate("() => Overworld.debugWorld()['4,-1'].enemies.forEach(e => e.defeated = true)")
    pg.screenshot(path=SHOTS + "gardens.png", clip=CLIP)
    seen = set()
    for i in range(12):
        pg.evaluate("() => Battle.start({type:'buzzbee', x:0, y:0}, '4,-1')"); battle_ready(pg)
        seen.add(pg.evaluate("Battle.debugState().problem.skill"))
        if "add3" in seen and i > 4: pg.screenshot(path=SHOTS + "gardens_battle.png")
        pg.evaluate("() => Battle.debugWin()")
        pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
    ok("add3" in seen and not (seen & {"barread","money","fraction"}), f"gardens problems: {seen}")
    # Thistle Queen: post-game boss
    pg.evaluate("() => { const e = Overworld.debugWorld()['5,-1'].enemies.find(e => e.boss); Battle.start(e, '5,-1'); }")
    battle_ready(pg)
    pg.evaluate("() => Battle.debugWin()"); pg.wait_for_timeout(300)
    msg = pg.inner_text("#battle-msg")
    ok("THISTLE QUEEN" in msg and "trophy" in msg, "thistle queen win: " + msg)
    pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=8000)
    ok(pg.evaluate("Main.getGame().progress.gardens") is True, "gardens boss recorded")
    # sky champion appears after the rescue
    pg.evaluate("() => Overworld.spawnChampions(Main.getGame())")
    ok(pg.evaluate("!!Overworld.debugWorld()['0,-3'].enemies.find(e => e.champion && e.type === 'ticktock')"), "sky champion at the Clock Tower")
    print("page errors:", errs); ok(not errs, "no page errors")
    print("FAILS:", len(fails)); br.close()
