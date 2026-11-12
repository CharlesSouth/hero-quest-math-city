from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch

GAME = GAME_URI
SHOTS = str(SHOT_DIR / "p4_")
fails = []
def ok(cond, msg):
    if not cond: fails.append(msg); print("FAIL:", msg)
    else: print("ok:", msg)

# dungeon id, outdoor screen, door-front tile, template
DUNGEONS = [("bank", "1,0", 11, 4, "B"), ("toyshop", "1,0", 4, 9, "A"), ("geargarage", "1,0", 11, 9, "B"),
            ("arcade", "3,0", 5, 4, "A"), ("hotel", "3,0", 10, 6, "B"), ("cabin", "4,0", 12, 4, "A"),
            ("greenhouse", "4,-1", 11, 8, "B"), ("assembly", "4,1", 10, 4, "A"), ("guardroom", "1,1", 11, 8, "B")]
ZONE_OF = {"bank": "city", "toyshop": "city", "geargarage": "city", "arcade": "city", "hotel": "city",
           "cabin": "ridge", "greenhouse": "gardens", "assembly": "factory", "guardroom": "tower"}

def step(pg, key, x, y, arrow, ms=280):
    pg.evaluate(f"() => Overworld.debugGoTo('{key}', {x}, {y})"); pg.wait_for_timeout(120)
    pg.keyboard.down(arrow); pg.wait_for_timeout(ms); pg.keyboard.up(arrow); pg.wait_for_timeout(250)

def approach(pg, did, tile, through_door):
    # a floor tile next to the given tile that can be reached from the entrance (8,9)
    return pg.evaluate(f"""() => {{
      const s = Overworld.debugWorld()['{did}'], g = s.grid;
      const pass = t => !SOLID.has(t) || ({'true' if through_door else 'false'} && t === T.PUZZLE_DOOR);
      const seen = new Set(['8,9']), q = [[8, 9]];
      while (q.length) {{ const [x, y] = q.shift();
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {{ const nx = x+dx, ny = y+dy, k = nx+','+ny;
          if (nx<0||ny<0||nx>=COLS||ny>=ROWS||seen.has(k)||!pass(g[ny][nx])) continue; seen.add(k); q.push([nx, ny]); }} }}
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === T.{tile})
        for (const [dx, dy, a] of [[0,1,'ArrowUp'],[-1,0,'ArrowRight'],[1,0,'ArrowLeft'],[0,-1,'ArrowDown']])
          if (seen.has((x+dx)+','+(y+dy)) && g[y+dy][x+dx] !== T.PUZZLE_DOOR) return [x+dx, y+dy, a];
      return null; }}""")

def solve_puzzle(pg, right=True):
    pg.wait_for_function("() => Main.currentScreen() === 'screen-puzzle'", timeout=3000)
    ans = pg.evaluate("Puzzle.debugState().problem.answer")
    n = pg.locator("#pz-choices .choice-btn").count()
    pg.locator("#pz-choices .choice-btn").nth(ans if right else (ans + 1) % n).click()
    pg.wait_for_timeout(200)

with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)
    pg.evaluate("""() => { const g = Main.getGame();
        g.progress = {city:true,ridge:true,cavern:true,gardens:true,factory:true,baron:false};
        STATIONS.forEach(s => g.badges[s.id] = true); g.hints.lens = true; Overworld.unlockGates(g); }""")

    first = True
    for did, outside, fx, fy, tpl in DUNGEONS:
        # clear the dungeon's enemies so walking is predictable
        pg.evaluate(f"() => Overworld.debugWorld()['{did}'].enemies.forEach(e => e.defeated = true)")
        step(pg, outside, fx, fy, "ArrowUp")
        ok(pg.evaluate("Overworld.getSave().key") == did, f"{did}: walked in through its door")
        if first:
            pg.wait_for_timeout(700)
            ok("PUZZLE DOOR" in pg.inner_text("#toast"), "first dungeon explains puzzle doors: " + pg.inner_text("#toast"))
            pg.screenshot(path=SHOTS + f"inside_{did}.png", clip={"x": 160, "y": 290, "width": 780, "height": 560})
        # chest is locked away before the door is solved
        door = approach(pg, did, "PUZZLE_DOOR", False)
        chest = approach(pg, did, "CHEST", True)
        ok(door is not None and chest is not None, f"{did}: found door and chest approach tiles")
        step(pg, did, door[0], door[1], door[2])
        ok(pg.evaluate("Main.currentScreen()") == "screen-puzzle", f"{did}: puzzle door opens a puzzle")
        ok("PUZZLE DOOR" in pg.inner_text("#pz-title"), f"{did}: titled puzzle door")
        if first:
            pg.screenshot(path=SHOTS + "puzzle_door.png")
            solve_puzzle(pg, right=False)
            fb = pg.inner_text("#pz-feedback")
            ok("Not quite" in fb and pg.is_visible("#btn-pz-new"), "wrong answer shows tip + new-puzzle button")
            ok(pg.locator("#pz-choices .choice-btn.right").count() == 1, "right answer highlighted")
            pg.click("#btn-pz-new"); pg.wait_for_timeout(150)
        parts0 = pg.evaluate("Main.getGame().parts")
        solve_puzzle(pg)
        ok("door slides open" in pg.inner_text("#pz-feedback"), f"{did}: door solved")
        pg.click("#btn-pz-done"); pg.wait_for_timeout(150)
        ok(pg.evaluate(f"(() => {{ const g = Overworld.debugWorld()['{did}'].grid; return g.flat().includes(T.PUZZLE_DOOR); }})()") is False, f"{did}: door tile gone")
        # walk through and open the chest
        lens0 = pg.evaluate("Main.getGame().lenses"); parts0 = pg.evaluate("Main.getGame().parts")
        step(pg, did, chest[0], chest[1], chest[2])
        ok(pg.evaluate("Main.currentScreen()") == "screen-puzzle" and "BIG" in pg.inner_text("#pz-sub"), f"{did}: big chest puzzle")
        solve_puzzle(pg)
        gained = pg.evaluate("Main.getGame().parts") - parts0
        ok(12 <= gained <= 18 and pg.evaluate("Main.getGame().lenses") == lens0 + 1, f"{did}: chest gave {gained} bolts + 1 lens")
        if first: pg.screenshot(path=SHOTS + "chest_open.png")
        pg.click("#btn-pz-done"); pg.wait_for_timeout(150)
        step(pg, did, chest[0], chest[1], chest[2])
        ok(pg.evaluate("Main.currentScreen()") == "screen-world" and "Empty" in pg.inner_text("#toast"), f"{did}: chest stays empty")
        if first:
            pg.wait_for_timeout(300)
            pg.screenshot(path=SHOTS + f"inside_after_{did}.png", clip={"x": 160, "y": 290, "width": 780, "height": 560})
        # battles inside use the zone's problems
        zone = pg.evaluate(f"Main.zoneOfScreen('{did}')")
        ok(zone == ZONE_OF[did], f"{did}: battles use {ZONE_OF[did]} problems ({zone})")
        # walk back out
        step(pg, did, 8, 9, "ArrowDown")
        ok(pg.evaluate("Overworld.getSave().key") == outside, f"{did}: walked back out")
        first = False

    # outdoor puzzle chest
    pos = pg.evaluate("""() => { const s = Overworld.debugWorld()['2,0'];
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (s.grid[y][x] === T.CHEST)
          for (const [dx,dy,a] of [[0,1,'ArrowUp'],[-1,0,'ArrowRight'],[1,0,'ArrowLeft'],[0,-1,'ArrowDown']])
            if (!SOLID.has(s.grid[y+dy][x+dx])) return [x+dx, y+dy, a];
        return null; }""")
    ok(pos is not None, "outdoor chest found on 2,0")
    pg.evaluate("() => Overworld.debugWorld()['2,0'].enemies.forEach(e => e.defeated = true)")
    step(pg, "2,0", pos[0], pos[1], pos[2])
    pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "outdoor_chest_puzzle.png")
    parts0 = pg.evaluate("Main.getGame().parts")
    ok(pg.evaluate("Main.currentScreen()") == "screen-puzzle" and "BIG" not in pg.inner_text("#pz-sub"), "outdoor chest is a small chest puzzle")
    solve_puzzle(pg)
    gained = pg.evaluate("Main.getGame().parts") - parts0
    ok(6 <= gained <= 10, f"outdoor chest gave {gained} bolts")
    pg.click("#btn-pz-done")

    # every puzzle kind renders (screenshots)
    for kind in ["pattern", "growing", "numpattern", "oddone", "matrix", "balance", "riddle"]:
        pg.evaluate(f"""() => {{ Puzzle.open({{type:'door', key:'test:1,1', tier:2, big:false}});
            const p = Puzzles.MAKERS['{kind}'](2);
            document.getElementById('pz-story').textContent = p.story;
            document.getElementById('pz-display').innerHTML = p.display;
            const h = document.getElementById('pz-choices'); h.innerHTML = '';
            p.choices.forEach(c => {{ const b = document.createElement('button'); b.className = 'choice-btn'; b.innerHTML = c.html; h.appendChild(b); }}); }}""")
        pg.wait_for_timeout(100)
        pg.screenshot(path=SHOTS + f"kind_{kind}.png", clip={"x": 150, "y": 150, "width": 800, "height": 600})
    pg.click("#btn-pz-exit")

    # save / continue keeps doors open and chests empty
    pg.evaluate("() => { Overworld.debugGoTo('0,0', 7, 6); Main.autoSave(); }")
    pg.reload(); pg.wait_for_timeout(300); pg.click("#btn-continue"); pg.wait_for_timeout(400)
    ok(pg.evaluate("Overworld.debugWorld()['bank'].grid[4][8]") == pg.evaluate("T.IN_FLOOR"), "bank door still open after continue")
    ok(pg.evaluate("Object.keys(Main.getGame().opened).length") >= 19, "opened chests/doors saved: " + str(pg.evaluate("Object.keys(Main.getGame().opened).length")))
    ok(pg.evaluate("Main.getGame().puzzles") >= 19, "puzzle count saved")

    # a real dungeon battle: walk into an enemy in the cabin
    pg.evaluate("() => { const e = Overworld.debugWorld()['cabin'].enemies[0]; e.defeated = false; e.still = true; Overworld.debugGoTo('cabin', e.x, e.y + 1); }")
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(250); pg.keyboard.up("ArrowUp")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-battle'", timeout=4000)
    pg.wait_for_function("() => { const B = Battle.debugState(); return B.problem && !B.locked; }", timeout=9000)
    sk = pg.evaluate("Battle.debugState().problem.skill")
    ok(sk in [s.split(":")[0] for s in pg.evaluate("RIDGE_SKILLS")], f"cabin battle problem is a Number Ridge skill ({sk})")

    print("page errors:", errs)
    ok(not errs, "no page errors")
    print("FAILS:", len(fails))
    br.close()
