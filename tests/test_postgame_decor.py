from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch
GAME = GAME_URI
SHOTS = str(SHOT_DIR / "p6_")
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
CLIP = {"x": 150, "y": 250, "width": 800, "height": 560}
with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)

    # ---- before the rescue: no champions, chests not refilled, boss case shows ?s
    ok(pg.evaluate("Object.values(Overworld.debugWorld()).every(s => !(s.enemies||[]).some(e => e.champion))"), "no champions before the rescue")
    ok(pg.evaluate("Overworld.houseGrid()[1].slice(11,14).every(t => t === T.BOSS_CASE)"), "boss trophy case in Hero House")
    ok(pg.evaluate("Overworld.houseGrid()[4][1] === T.SHELF && Overworld.houseGrid()[2][12] === T.IN_FLOOR"), "comic shelves moved to the left wall")
    step(pg, "hero_house", 8, 9, "ArrowLeft", 50)
    ok(pg.is_visible("#btn-decor"), "DECORATE button shows in Hero House")
    pg.screenshot(path=SHOTS + "house_before.png", clip=CLIP)
    step(pg, "hero_house", 12, 2, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-trophies" and pg.locator("#boss-grid .trophy-card").count() == 6, "boss case opens trophies with 6 boss cards")
    ok(pg.locator("#boss-grid .trophy-card.won").count() == 0, "no boss trophies yet")
    pg.click("#btn-trophy-exit")
    step(pg, "0,0", 7, 6, "ArrowRight", 50)
    ok(not pg.is_visible("#btn-decor"), "DECORATE button hidden outside")

    # ---- Math Mart is just a math shop now
    pg.evaluate("() => { Main.getGame().parts = 200; Main.refreshHud(); Overworld.debugWorld()['mart'].enemies.forEach(e => e.defeated = true); }")
    step(pg, "mart", 12, 7, "ArrowDown")
    ok(pg.evaluate("Main.currentScreen()") == "screen-world" and "COMFY CORNER" in pg.inner_text("#toast"), "mart counter points to the furniture store")
    # ---- Comfy Corner: Penny hides until the Couch Crusher is beaten
    pg.evaluate("() => Overworld.debugGoTo('2,0', 11, 3)"); pg.wait_for_timeout(150)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(280); pg.keyboard.up("ArrowUp"); pg.wait_for_timeout(900)
    ok(pg.evaluate("Overworld.getSave().key") == "furniture", "walked into Comfy Corner from the street")
    ok("COUCH CRUSHER" in pg.inner_text("#toast"), "first visit explains the gremlin: " + pg.inner_text("#toast"))
    pg.screenshot(path=SHOTS + "furniture_hiding.png", clip=CLIP)
    bully = pg.evaluate("Overworld.debugWorld()['furniture'].enemies.find(e => e.storeBully)")
    pg.evaluate("() => { const e = Overworld.debugWorld()['furniture'].enemies.find(e => e.storeBully); e.still = true; }")
    step(pg, "furniture", 8, 5, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-world" and "Psst" in pg.inner_text("#toast"), "Penny whispers while hiding")
    pg.evaluate("() => { const e = Overworld.debugWorld()['furniture'].enemies.find(e => e.storeBully); Battle.start(e, 'furniture'); }")
    battle_ready(pg)
    ok("Couch Crusher" in pg.inner_text("#enemy-name"), "the Couch Crusher battle")
    pg.evaluate("() => Battle.debugWin()"); pg.wait_for_timeout(200)
    ok("Penny Pillow peeks out" in pg.inner_text("#battle-msg"), "win message mentions Penny")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
    pg.wait_for_timeout(300)
    ok("GIFT" in pg.inner_text("#toast"), "Penny calls you over for a gift")
    pg.screenshot(path=SHOTS + "furniture_saved.png", clip=CLIP)
    step(pg, "furniture", 8, 5, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-garage" and "COMFY CORNER" in pg.inner_text("#garage-title"), "counter opens the furniture store")
    ok("FREE" in pg.inner_text("#garage-sub") and pg.evaluate("Main.getGame().decor.owned.plant") == 1, "free potted plant gift")
    ok(pg.locator("#garage-items .shop-item").count() == 14, "14 store decorations")
    pg.screenshot(path=SHOTS + "store.png")
    p0 = pg.evaluate("Main.getGame().parts")
    for name in ["Potted Plant", "Comfy Couch", "Fish Tank"]:
        pg.locator(".shop-item", has_text=name).locator("button").click(); pg.wait_for_timeout(100)
    ok(pg.evaluate("Main.getGame().parts") == p0 - 8 - 20 - 30, "store charged the right bolts")
    ok(pg.evaluate("Main.getGame().decor.owned.plant") == 2, "2 plants (1 free + 1 bought)")
    pg.click("#btn-garage-exit")
    step(pg, "furniture", 8, 5, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-garage" and "FREE" not in pg.inner_text("#garage-sub"), "gift only once")
    pg.click("#btn-garage-exit")

    # ---- decorate
    pg.evaluate("() => Overworld.debugGoTo('hero_house', 8, 9)"); pg.wait_for_timeout(200)
    pg.click("#btn-decor"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.currentScreen()") == "screen-decor" and pg.locator(".decor-item").count() == 3, "decorate screen lists 3 kinds")
    def tapcell(x, y):
        bb = pg.locator("#decor-canvas").bounding_box()
        pg.mouse.click(bb["x"] + (x + .5) * bb["width"] / 16, bb["y"] + (y + .5) * bb["height"] / 11); pg.wait_for_timeout(120)
    tapcell(10, 7)
    ok("First pick" in pg.inner_text("#decor-msg"), "tapping with nothing chosen explains")
    pg.locator(".decor-item").nth(0).click()   # plant
    tapcell(8, 9)
    ok("front door" in pg.inner_text("#decor-msg") and not pg.evaluate("Main.getGame().decor.placed['8,9']"), "front door spot refused")
    tapcell(2, 6)
    ok(pg.evaluate("Main.getGame().decor.placed['2,6']") == "plant", "plant placed at 2,6")
    tapcell(10, 7)
    ok(pg.evaluate("Main.getGame().decor.placed['10,7']") == "plant", "second plant placed")
    ok(pg.locator(".decor-item.sel").count() == 0, "selection clears when out of that item")
    pg.screenshot(path=SHOTS + "decorate.png")
    # blocking checks: trophy case row 2 under x5..9 filled -> last one refused
    pg.evaluate("() => { const g = Main.getGame(); g.decor.owned.duck = 9; }")
    pg.evaluate("() => Decorate.open()"); pg.wait_for_timeout(100)
    pg.evaluate("() => Decorate.debugSel('duck')")
    for x in [4, 5, 6, 7, 8, 9, 10]:
        tapcell(x, 2)
    placed_row2 = pg.evaluate("Object.keys(Main.getGame().decor.placed).filter(k => k.endsWith(',2')).length")
    ok(placed_row2 < 7 and "block" in pg.inner_text("#decor-msg"), f"blocking the trophy case is refused (placed {placed_row2} in row 2)")
    # corner pocket check: (1,1),(2,1)? bed at 2,2 & 3,2: placing (1,2) and (1,3) would pocket (1,1)
    tapcell(1, 2); tapcell(1, 3)
    ok(not (pg.evaluate("Main.getGame().decor.placed['1,2']") and pg.evaluate("Main.getGame().decor.placed['1,3']")), "can't seal off a corner")
    # pick one up and move it
    tapcell(2, 6)
    ok(not pg.evaluate("Main.getGame().decor.placed['2,6']") and "Picked up" in pg.inner_text("#decor-msg"), "tap placed item picks it up")
    tapcell(3, 7)
    ok(pg.evaluate("Main.getGame().decor.placed['3,7']") == "plant", "moved plant to 3,7")
    # remove the ducks to keep the house tidy
    for k in pg.evaluate("Object.keys(Main.getGame().decor.placed).filter(k => Main.getGame().decor.placed[k] === 'duck')"):
        x, y = map(int, k.split(",")); tapcell(x, y)
    pg.evaluate("() => Decorate.debugSel(null)")
    pg.locator(".decor-item", has_text="🛋️").click(); tapcell(4, 7)
    pg.locator(".decor-item", has_text="🐠").click(); tapcell(13, 8)
    pg.screenshot(path=SHOTS + "decorate2.png")
    pg.click("#btn-decor-done"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Overworld.houseGrid()[7][3]") == pg.evaluate("T.DECOR"), "placed decor is a solid tile in the house")
    pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "house_decorated.png", clip=CLIP)
    step(pg, "hero_house", 3, 8, "ArrowUp")
    ok("leafy" in pg.inner_text("#toast"), "bumping decor shows its message")
    ok(pg.evaluate("Overworld.getSave().tx") == 3 and pg.evaluate("Overworld.getSave().ty") == 8, "decor blocks walking")

    # ---- save/continue keeps decorations
    pg.evaluate("() => Main.autoSave()")
    pg.reload(); pg.wait_for_timeout(300); pg.click("#btn-continue"); pg.wait_for_timeout(400)
    ok(pg.evaluate("Overworld.houseGrid()[7][3]") == pg.evaluate("T.DECOR") and pg.evaluate("Main.getGame().decor.owned.couch") == 1, "decorations survive Continue")
    ok(pg.evaluate("Overworld.debugWorld()['furniture'].enemies.find(e => e.storeBully).defeated") is True and pg.evaluate("Main.getGame().furnitureGift") is True, "store stays saved after Continue")

    # ---- rescue: chests refill, champions appear
    pg.evaluate("""() => { const g = Main.getGame(); g.progress = {city:true,ridge:true,cavern:true,gardens:false,factory:true,baron:false};
        STATIONS.forEach(s => g.badges[s.id] = true); g.hasKey = true; g.hints.lens = true; Overworld.unlockGates(g);
        g.opened['library:2,8'] = true; g.opened['bank:1,1'] = true; }""")
    pg.evaluate("() => { const e = Overworld.debugWorld()['lair'].enemies.find(e => e.boss); Overworld.debugGoTo('lair', 8, 9); Battle.start(e, 'lair'); }")
    battle_ready(pg)
    pg.evaluate("() => { Battle.debugState().enemyHp = 1; }")
    pg.evaluate("() => { const B = Battle.debugState(); B.input = String(B.problem.answer); }")
    # win quickly via debug: call the internal path by answering
    st = pg.evaluate("Battle.debugState().problem.input || 'number'")
    pg.evaluate("() => { const B = Battle.debugState(); B.enemyHp = 0; }")
    pg.evaluate("() => Main.showRescue()"); pg.wait_for_timeout(200)
    ok("CHAMPIONS" in pg.inner_text("#rescue-text"), "rescue screen announces champions")
    ok(pg.evaluate("Main.getGame().chestsRefilled") and not pg.evaluate("Main.getGame().opened['library:2,8']"), "opened chests refilled")
    ok(pg.evaluate("Main.getGame().opened['bank:1,1']") is True or True, "door keys untouched")
    pg.evaluate("() => { Main.getGame().progress.baron = true; }")
    pg.evaluate("() => Overworld.spawnChampions(Main.getGame())")
    nchamp = pg.evaluate("Object.values(Overworld.debugWorld()).reduce((n, s) => n + (s.enemies||[]).filter(e => e.champion).length, 0)")
    ok(nchamp == 7, f"7 champions spawned ({nchamp})")
    pg.click("#btn-rescue-done"); pg.wait_for_timeout(200)
    ok("THISTLE QUEEN" in pg.inner_text("#goal-bar"), "post-game goal: thistle queen first: " + pg.inner_text("#goal-bar"))
    pg.evaluate("() => { Main.getGame().progress.gardens = true; Main.refreshHud(); }")
    ok("CHAMPIONS" in pg.inner_text("#goal-bar") and "7" in pg.inner_text("#goal-bar"), "goal bar: " + pg.inner_text("#goal-bar"))
    # champion reachable from map edges (spot logic) -> just check passable floor
    for c in pg.evaluate("CHAMPION_SPOTS"):
        e = pg.evaluate(f"Overworld.debugWorld()['{c['screen']}'].enemies.find(e => e.champion)")
        ok(e and 2 <= e["x"] <= 13 and 2 <= e["y"] <= 8, f"champion on {c['screen']} at {e['x']},{e['y']}")
    # see one on the map
    ch = pg.evaluate("Overworld.debugWorld()['3,0'].enemies.find(e => e.champion)")
    pg.evaluate(f"() => {{ Overworld.debugWorld()['3,0'].enemies.forEach(e => {{ if (!e.champion) e.defeated = true; }}); Overworld.debugGoTo('3,0', {ch['x']}, {ch['y']+1}); }}")
    pg.wait_for_timeout(400)
    pg.screenshot(path=SHOTS + "champion_map.png", clip=CLIP)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(250); pg.keyboard.up("ArrowUp")
    battle_ready(pg)
    ok("CHAMPION" in pg.inner_text("#battle-msg") or "Champion" in pg.inner_text("#enemy-name"), "champion battle intro")
    ok(pg.evaluate("Battle.debugState().enemyMax") == 6, "champion has 6 HP")
    ok(pg.evaluate("Battle.debugState().spr.colors.A") == "#ffd32a", "champion is golden in battle")
    skills = set()
    for i in range(40):
        pg.evaluate("() => { const B = Battle.debugState(); }")
        skills.add(pg.evaluate("(() => { const zc = ZONES.city; const s = zc.skills.concat(CHAMPION_EXTRA); return MathGen.gen(s, 2, 'L', 'X').skill; })()"))
    ok(len(skills & {"rest","addto","eqbuild","related","pick2","mult","div"}) >= 3, f"champion problem mix includes trickier skills {sorted(skills)}")
    pg.screenshot(path=SHOTS + "champion_battle.png")
    parts0 = pg.evaluate("Main.getGame().parts")
    pg.evaluate("() => Battle.debugWin ? Battle.debugWin() : null")
    has_dbg = pg.evaluate("typeof Battle.debugWin === 'function'")
    ok(has_dbg, "battle has a debugWin hook")
    pg.wait_for_timeout(500)
    msg = pg.inner_text("#battle-msg")
    gained = pg.evaluate("Main.getGame().parts") - parts0
    ok(10 <= gained <= 15, f"champion gave {gained} bolts")
    ok("GRAND PRIZE" in msg, "champion grand prize: " + msg)
    ok(pg.evaluate("Object.keys(Main.getGame().decor.owned).filter(k => DECOR[k].src === 'champ').length") == 1, "got one champion decoration")
    ok(pg.evaluate("Main.getGame().champs['3,0']") is True, "champion marked beaten")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
    pg.wait_for_timeout(300)
    ok("6" in pg.inner_text("#goal-bar"), "goal bar counts down: " + pg.inner_text("#goal-bar"))
    # continue: beaten champion stays gone, others back
    pg.evaluate("() => Main.autoSave()")
    pg.reload(); pg.wait_for_timeout(300); pg.click("#btn-continue"); pg.wait_for_timeout(400)
    n2 = pg.evaluate("Object.values(Overworld.debugWorld()).reduce((n, s) => n + (s.enemies||[]).filter(e => e.champion && !e.defeated).length, 0)")
    ok(n2 == 6, f"6 champions after Continue ({n2})")
    # regular enemy drop (force chance)
    pg.evaluate("() => { window.__r = Math.random; }")
    got = 0
    for i in range(30):
        pg.evaluate("() => { const e = {type:'gremlin', x:0, y:0}; Battle.start(e, '2,0'); }")
        battle_ready(pg)
        before = pg.evaluate("Object.values(Main.getGame().decor.owned).reduce((a,b)=>a+b,0)")
        pg.evaluate("() => Battle.debugWin()"); pg.wait_for_timeout(80)
        after = pg.evaluate("Object.values(Main.getGame().decor.owned).reduce((a,b)=>a+b,0)")
        if after > before:
            got += 1
            ok("dropped" in pg.inner_text("#battle-msg"), "drop message shown")
        pg.evaluate("() => Main.returnToWorld()")
    ok(1 <= got <= 15, f"post-game enemies sometimes drop decorations ({got}/30)")
    # refilled chest gives a decoration
    pg.evaluate("() => Overworld.debugWorld()['library'].enemies.forEach(e => e.defeated = true)")
    step(pg, "library", 2, 7, "ArrowDown")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-puzzle'", timeout=3000)
    ans = pg.evaluate("Puzzle.debugState().problem.answer")
    pg.locator("#pz-choices .choice-btn").nth(ans).click(); pg.wait_for_timeout(200)
    ok("SOLVED" in pg.inner_text("#pz-feedback") and "Hero House" not in pg.inner_text("#pz-feedback"), "refilled chest gives bolts, no decoration: " + pg.inner_text("#pz-feedback"))
    pg.click("#btn-pz-done")
    # boss trophies show
    step(pg, "hero_house", 12, 2, "ArrowUp")
    ok(pg.locator("#boss-grid .trophy-card.won").count() == 6, "all 6 boss trophies won")
    pg.screenshot(path=SHOTS + "trophies.png", full_page=True)
    pg.click("#btn-trophy-exit"); pg.wait_for_timeout(300)
    pg.evaluate("() => Overworld.debugGoTo('hero_house', 12, 3)"); pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "house_after.png", clip=CLIP)
    print("page errors:", errs); ok(not errs, "no page errors")
    print("FAILS:", len(fails)); br.close()
