from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch

GAME = GAME_URI
SHOTS = str(SHOT_DIR / "r4_")
fails = []
def ok(cond, msg):
    if not cond: fails.append(msg); print("FAIL:", msg)
    else: print("ok:", msg)

with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(600)

    # --- glowing stations in the park
    pg.evaluate("() => { Main.getGame().hints.park = true; Overworld.debugGoTo('-1,0', 8, 5); }")
    pg.wait_for_timeout(700)
    pg.screenshot(path=SHOTS + "park_glow.png", clip={"x": 160, "y": 290, "width": 780, "height": 560})

    # --- trophy case: empty, then partly filled
    pg.evaluate("() => Overworld.debugGoTo('hero_house', 7, 2)"); pg.wait_for_timeout(300)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(250); pg.keyboard.up("ArrowUp"); pg.wait_for_timeout(300)
    ok(pg.evaluate("Main.currentScreen()") == "screen-trophies", "walking into the case opens the trophy screen")
    ok("0 of 10" in pg.inner_text("#trophy-count"), "0 of 10 trophies")
    ok(pg.locator("#trophy-grid .trophy-card.won").count() == 0 and pg.locator("#trophy-grid .trophy-card").count() == 10, "10 locked cards")
    pg.click("#btn-trophy-exit")
    pg.evaluate("() => { const g = Main.getGame(); ['addsub','story','tens','money'].forEach(b => g.badges[b] = true); Main.refreshHud(); Overworld.debugGoTo('hero_house', 7, 3); }")
    pg.wait_for_timeout(400)
    pg.screenshot(path=SHOTS + "house.png", clip={"x": 160, "y": 290, "width": 780, "height": 560})
    pg.evaluate("() => Main.openTrophies()"); pg.wait_for_timeout(300)
    ok("4 of 10" in pg.inner_text("#trophy-count") and pg.locator("#trophy-grid .trophy-card.won").count() == 4, "4 trophies shown")
    ok("Bag of Lucky Coins" in pg.inner_text("#trophy-grid") and "Coin Counter badge" not in pg.inner_text("#trophy-grid"), "money trophy named")
    ok("Fair Shares badge" in pg.inner_text("#trophy-grid"), "locked card says which badge")
    pg.screenshot(path=SHOTS + "trophies.png")
    pg.click("#btn-trophy-exit")

    # --- badge screen mentions the trophy
    pg.evaluate("() => { delete Main.getGame().badges.addsub; Tutorial.open('addsub'); }")
    for _ in range(10):
        if "CHALLENGE" in pg.inner_text("#btn-tut-next"): break
        pg.click("#btn-tut-next")
    pg.click("#btn-tut-next")
    for i in range(3):
        pg.wait_for_function("() => { const d = Tutorial.debugState(); return d.problem && !d.locked && d.mode==='challenge'; }", timeout=8000)
        a = pg.evaluate("Tutorial.debugState().problem.answer")
        for ch in str(a): pg.locator(f"#tut-pad .pad-btn:text-is('{ch}')").click()
        pg.locator("#tut-pad .pad-btn:text-is('OK')").click()
    pg.wait_for_function("() => Tutorial.debugState().mode === 'done'", timeout=6000); pg.wait_for_timeout(200)
    ok("Golden Plus Cup" in pg.inner_text("#tut-caption"), "badge screen names trophy: " + pg.inner_text("#tut-caption"))
    pg.click("#btn-tut-exit")

    # --- prices
    pg.evaluate("() => { Main.getGame().parts = 0; Main.openShop(); }")
    txt = pg.inner_text("#shop-items")
    for name, price in [("Mega Zap", 30), ("Tough Plating", 25), ("Picture Lens", 5), ("Lens Pack", 20), ("Extra Heart", 30), ("SUPER STRENGTH", 45), ("FLIGHT", 80), ("INVISIBILITY", 110)]:
        cost = pg.evaluate(f"() => document.evaluate(\"//div[contains(@class,'shop-item')][.//div[@class='shop-name' and text()='{name}']]//button\", document, null, 9, null).singleNodeValue.textContent")
        ok(cost.startswith(str(price)), f"{name} costs {price} ({cost})")
    pg.click("#btn-shop-exit")

    # --- Key Keeper ambush
    pg.evaluate("() => { const g = Main.getGame(); g.progress = {city:true,ridge:true,cavern:true,gardens:true,factory:true,baron:false}; STATIONS.forEach(s => g.badges[s.id] = true); Overworld.unlockGates(g); g.hints.lens = true; }")
    key = pg.evaluate("() => { const s = Overworld.debugWorld()['3,1']; const k = s.pickups.find(p => p.kind === 'key'); const e = s.enemies.find(e => e.guardsKey); return {kx:k.x, ky:k.y, ex:e.x, ey:e.y}; }")
    # find a free tile next to the key that is not the keeper
    start = pg.evaluate(f"""() => {{ const s = Overworld.debugWorld()['3,1'];
        for (const [dx,dy,dir] of [[0,1,'ArrowUp'],[0,-1,'ArrowDown'],[1,0,'ArrowLeft'],[-1,0,'ArrowRight']]) {{
          const x = {key['kx']}+dx, y = {key['ky']}+dy;
          if (x === {key['ex']} && y === {key['ey']}) continue;
          if (!SOLID.has(s.grid[y][x]) && !s.enemies.some(e => !e.defeated && e.x===x && e.y===y)) return [x,y,dir];
        }} return null; }}""")
    ok(start is not None, "found a tile next to the key")
    pg.evaluate("() => { ZONES.tower.skills = ['add']; Overworld.debugWorld()['3,1'].enemies.forEach(e => { if (!e.guardsKey) e.defeated = true; }); }")
    pg.evaluate(f"() => Overworld.debugGoTo('3,1', {start[0]}, {start[1]})"); pg.wait_for_timeout(200)
    pg.keyboard.down(start[2]); pg.wait_for_timeout(330); pg.keyboard.up(start[2])
    pg.wait_for_timeout(300)
    ok(not pg.evaluate("Main.getGame().hasKey"), "key not taken yet")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-battle'", timeout=4000)
    ok("MY key" in pg.inner_text("#battle-msg"), "keeper shouts: " + pg.inner_text("#battle-msg"))
    ok(pg.inner_text("#enemy-name") == "Key Keeper", "battle is with the Key Keeper")
    pg.wait_for_function("() => { const B = Battle.debugState(); return B.problem && !B.locked && B.phase==='attack'; }", timeout=9000)
    pg.evaluate("() => { Battle.debugState().enemyHp = 1; }")
    # answer whatever is up (it was generated before the skill swap)
    p = pg.evaluate("() => { const p = Battle.debugState().problem; return {input:p.input, answer:p.answer, reveal:p.reveal, coinSet:p.coinSet||null}; }")
    if p["input"] == "number":
        for ch in str(p["answer"]): pg.locator(f"#numpad .pad-btn:text-is('{ch}')").click()
        pg.locator("#numpad .pad-btn:text-is('OK')").click()
    else:
        pg.evaluate("() => { const B = Battle.debugState(); B.enemyHp = 0; }")
        pg.evaluate("() => { const B = Battle.debugState(); B.locked = false; }")
        pg.evaluate("() => Battle.debugState().enemy.defeated = true")
    pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=10000)
    pg.wait_for_timeout(300)
    if p["input"] == "number":
        ok(pg.evaluate("Main.getGame().hasKey"), "after beating the keeper, the key is yours")
        ok("GOLDEN KEY" in pg.inner_text("#toast"), "key toast after win")

    # --- boss sprites (battle view of each)
    for bid, sid in [("gremlinking", "city"), ("ridgeram", "ridge"), ("drillmaster", "cavern"), ("thistlequeen", "gardens"), ("shapeshifter", "factory"), ("robobaron", "baron")]:
        pg.evaluate(f"() => Battle.start({{type:'{bid}', boss:'{sid}', x:0, y:0}}, '1,1')")
        pg.wait_for_timeout(500)
        pg.screenshot(path=SHOTS + f"boss_{bid}.png", clip={"x": 160, "y": 200, "width": 780, "height": 370})
    # overworld view of the ram
    pg.evaluate("() => { Main.show('screen-world'); const g = Main.getGame(); g.progress.ridge = false; Overworld.applyProgress({}, false); }")
    pg.evaluate("() => { const e = Overworld.debugWorld()['5,0'].enemies.find(e => e.boss); e.defeated = false; Overworld.debugGoTo('5,0', e.x - 2, e.y); }")
    pg.wait_for_timeout(400)
    pg.screenshot(path=SHOTS + "ram_world.png", clip={"x": 160, "y": 290, "width": 780, "height": 560})

    print("page errors:", errs)
    ok(not errs, "no page errors")
    print("FAILS:", len(fails))
    br.close()
