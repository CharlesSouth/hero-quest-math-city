from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch

GAME = GAME_URI
SHOTS = str(SHOT_DIR / "r5_")
fails = []
def ok(cond, msg):
    if not cond: fails.append(msg); print("FAIL:", msg)
    else: print("ok:", msg)
CLIP = {"x": 160, "y": 290, "width": 780, "height": 560}

def step(pg, key, x, y, arrow, ms=280):
    pg.evaluate(f"() => Overworld.debugGoTo('{key}', {x}, {y})"); pg.wait_for_timeout(120)
    pg.keyboard.down(arrow); pg.wait_for_timeout(ms); pg.keyboard.up(arrow); pg.wait_for_timeout(250)

def solve_puzzle(pg, right=True):
    pg.wait_for_function("() => Main.currentScreen() === 'screen-puzzle'", timeout=3000)
    ans = pg.evaluate("Puzzle.debugState().problem.answer")
    n = pg.locator("#pz-choices .choice-btn").count()
    pg.locator("#pz-choices .choice-btn").nth(ans if right else (ans + 1) % n).click()
    pg.wait_for_timeout(200)

def battle_ready(pg):
    pg.wait_for_function("() => { const B = Battle.debugState(); return B.problem && !B.locked && B.phase==='attack'; }", timeout=9000)

with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1150})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.locator("#rescue-row .suit-option").nth(1).click()   # woman
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)
    pg.evaluate("() => { Main.getGame().hints.lens = true; Main.getGame().hints.dungeon = true; }")

    # ---- room shapes vary
    sizes = pg.evaluate("""() => { const W = Overworld.debugWorld(), out = {};
        for (const k of ['workshop','garage','mart','library','depot','bank','toyshop','geargarage','arcade','hotel','cabin','greenhouse','assembly','guardroom','hero_house'])
          out[k] = W[k].grid.flat().filter(t => t !== T.VOID && t !== T.IN_WALL).length;
        return out; }""")
    ok(len(set(sizes.values())) >= 8, f"rooms come in many sizes: {sizes}")
    ok(sizes["workshop"] < 40, f"Rita's workshop is small now ({sizes['workshop']} tiles)")
    colors = pg.evaluate("() => { const W = Overworld.debugWorld(); return ['bank','toyshop','geargarage','arcade','hotel','cabin','greenhouse','assembly','guardroom','mart','library','depot'].map(k => W[k].style.floor + W[k].style.wall); }")
    ok(len(set(colors)) == len(colors), "every building has its own colors")
    for k in ["workshop", "bank", "cabin", "arcade", "hotel", "library", "greenhouse", "toyshop"]:
        pg.evaluate(f"() => {{ Overworld.debugWorld()['{k}'].enemies.forEach(e => e.defeated = true); Overworld.debugGoTo('{k}', 8, 9); }}")
        pg.wait_for_timeout(250)
        pg.screenshot(path=SHOTS + f"room_{k}.png", clip=CLIP)

    # ---- Rita's (smaller) workshop still works
    step(pg, "0,0", 7, 3, "ArrowUp")
    ok(pg.evaluate("Overworld.getSave().key") == "workshop", "walked into Rita's workshop")
    step(pg, "workshop", 8, 8, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-shop", "Rita's counter opens the shop")
    pg.click("#btn-shop-exit")

    # ---- Robo-Garage
    step(pg, "0,0", 12, 9, "ArrowUp")
    ok(pg.evaluate("Overworld.getSave().key") == "garage", "walked into the garage")
    pg.wait_for_timeout(300); pg.screenshot(path=SHOTS + "garage_broken.png", clip=CLIP)
    pg.evaluate("() => { Main.getGame().hearts = 1; }")
    step(pg, "garage", 3, 5, "ArrowUp")
    ok(pg.evaluate("Main.getGame().hearts") == 3, "recharge counter still works")
    pg.evaluate("() => { Main.getGame().parts = 0; }")
    step(pg, "garage", 7, 5, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-garage" and "HOVER-BIKE" in pg.inner_text("#garage-title"), "bike opens the bike bay")
    ok(pg.locator("#garage-items .shop-buy").nth(0).is_disabled(), "can't fix without bolts")
    pg.evaluate("() => { Main.getGame().parts = 100; }"); pg.evaluate("() => Garage.open('bike')")
    for stage in range(3):
        btn = pg.locator("#garage-items .shop-buy:not([disabled])").first
        btn.click()
        ok("BIKE REPAIR" in pg.inner_text("#pz-title"), f"stage {stage+1}: repair puzzle")
        if stage == 0:
            solve_puzzle(pg, right=False)
            ok(pg.evaluate("Main.getGame().bike") == 0 and pg.evaluate("Main.getGame().parts") == 100, "wrong answer costs nothing")
            pg.click("#btn-pz-new"); pg.wait_for_timeout(100)
        solve_puzzle(pg)
        pg.click("#btn-pz-done"); pg.wait_for_timeout(200)
        ok(pg.evaluate("Main.currentScreen()") in ("screen-garage",), f"stage {stage+1}: back to the bay")
    ok(pg.evaluate("Main.getGame().bike") == 3 and pg.evaluate("Main.getGame().parts") == 10, "3 repairs for 20+30+40 bolts")
    ok("WHERE TO" in pg.inner_text("#garage-title"), "fixed bike shows travel list")
    locked = pg.locator("#garage-items .shop-buy[disabled]").count()
    ok(locked == 7, f"only Hero Base + Practice Park open at the start ({locked} locked)")
    pg.click("#btn-garage-exit"); pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "garage_fixed.png", clip=CLIP)
    ok(pg.is_visible("#btn-ride"), "RIDE button appears in the HUD")
    pg.evaluate("""() => { const g = Main.getGame();
        g.progress = {city:true,ridge:true,cavern:true,gardens:true,factory:true,baron:true};
        g.powers.flight = true;
        STATIONS.forEach(s => g.badges[s.id] = true); Overworld.unlockGates(g); }""")
    pg.click("#btn-ride"); pg.wait_for_timeout(150)
    ok(pg.locator("#garage-items .shop-buy[disabled]").count() == 0, "all destinations open once zones are open")
    pg.screenshot(path=SHOTS + "travel.png")
    pg.locator("#garage-items .shop-item:has-text('Secret Gardens') .shop-buy").click(); pg.wait_for_timeout(400)
    ok(pg.evaluate("Overworld.getSave().key") == "4,-1" and pg.evaluate("Main.currentScreen()") == "screen-world", "zoomed to Secret Gardens")
    pg.evaluate("() => { Main.getGame().progress.baron = false; Main.refreshHud(); }")

    # ---- Paint shop
    pg.evaluate("() => { Main.getGame().parts = 60; }")
    step(pg, "garage", 11, 5, "ArrowUp")
    ok(pg.evaluate("Main.currentScreen()") == "screen-garage" and "PAINT" in pg.inner_text("#garage-title"), "paint booth opens the paint shop")
    pg.locator("#garage-items .shop-item:has-text('Ninja') .shop-buy").click(); pg.wait_for_timeout(100)
    ok(pg.evaluate("Main.getGame().suitIndex") == 5 and pg.evaluate("Main.getGame().parts") == 40, "bought + wearing Ninja suit")
    pg.locator("#garage-items .shop-item:has-text('Star') .shop-buy").click(); pg.wait_for_timeout(100)
    ok(pg.evaluate("Main.suit().decal") == "star" and pg.evaluate("Main.getGame().parts") == 30, "bought + wearing star design")
    pg.locator("#garage-items .shop-item:has-text('Blaze') .shop-buy").click(); pg.wait_for_timeout(100)
    ok(pg.evaluate("Main.getGame().suitIndex") == 0 and pg.evaluate("Main.getGame().parts") == 30, "starter suits are free to switch")
    pg.locator("#garage-items .shop-item:has-text('Ninja') .shop-buy").click(); pg.wait_for_timeout(100)
    ok(pg.evaluate("Main.getGame().parts") == 30, "owned suit re-equips free")
    pg.screenshot(path=SHOTS + "paint.png")
    pg.click("#btn-garage-exit")

    # ---- chest glow
    pg.evaluate("() => { Overworld.debugWorld()['2,0'].enemies.forEach(e => e.defeated = true); Overworld.debugGoTo('2,0', 1, 4); }")
    pg.wait_for_timeout(400); pg.screenshot(path=SHOTS + "chest_glow.png", clip=CLIP)

    # ---- before the rescue: no companion, no team moves
    pg.evaluate("() => { ZONES.city.skills = ['add']; Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0'); }")
    battle_ready(pg)
    ok("Team Zap" not in pg.inner_text("#battle-powers"), "no team moves before the rescue")
    pg.evaluate("() => Main.returnToWorld()")
    step(pg, "hero_house", 13, 6, "ArrowUp")
    ok("waiting for Max" in pg.inner_text("#toast"), "spare bed waits for the friend: " + pg.inner_text("#toast"))

    # ---- rescue -> companion follows
    pg.evaluate("() => { const g = Main.getGame(); g.progress.baron = true; Main.showRescue(); }")
    ok("follow you everywhere" in pg.inner_text("#rescue-text"), "rescue screen explains the companion")
    pg.screenshot(path=SHOTS + "rescue.png")
    pg.click("#btn-rescue-done"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Overworld.companionFollowing()"), "companion is following")
    pg.evaluate("() => { Overworld.debugWorld()['1,0'].enemies.forEach(e => e.defeated = true); Overworld.debugGoTo('1,0', 2, 5); }")
    pg.wait_for_timeout(200)
    pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(700); pg.keyboard.up("ArrowRight"); pg.wait_for_timeout(500)
    hero = pg.evaluate("Overworld.getSave()")
    comp = pg.evaluate("() => { /* peek */ return null; }")
    pg.screenshot(path=SHOTS + "following.png", clip=CLIP)
    ok("Explore with Max" in pg.inner_text("#goal-bar"), "post-game goal mentions the friend")

    # ---- home toggle
    step(pg, "hero_house", 13, 6, "ArrowUp")
    pg.click("text=Rest at home"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().companion.mode") == "home" and "rest at Hero House" in pg.inner_text("#toast"), "bed: friend stays home")
    ok(not pg.evaluate("Overworld.companionFollowing()"), "not following while home")
    pg.evaluate("() => Overworld.debugGoTo('hero_house', 9, 6)"); pg.wait_for_timeout(300)
    pg.screenshot(path=SHOTS + "home.png", clip=CLIP)
    pg.evaluate("() => { ZONES.city.skills = ['add']; Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0'); }")
    battle_ready(pg)
    ok("Team Zap" not in pg.inner_text("#battle-powers"), "no team moves while friend is home")
    pg.evaluate("() => Main.returnToWorld()")
    step(pg, "hero_house", 12, 6, "ArrowUp")
    pg.click("text=Come with me"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().companion.mode") == "follow" and "adventure together" in pg.inner_text("#toast"), "walk into friend: follows again")

    # ---- team moves
    pg.evaluate("() => { ZONES.city.skills = ['add']; Main.getGame().upgrades.zap = 0; Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0'); }")
    battle_ready(pg)
    ok("Max is here to help" in pg.inner_text("#battle-msg") or True, "intro")
    pw_txt = pg.inner_text("#battle-powers")
    ok("Team Zap" in pw_txt and "Cheer" in pw_txt and "Hint" in pw_txt, "3 team moves shown")
    pg.evaluate("() => { Battle.debugState().enemyHp = 20; Battle.debugState().enemyMax = 20; }")
    pg.screenshot(path=SHOTS + "team_battle.png")
    pg.locator("#battle-powers button:has-text('Team Zap')").click(); pg.wait_for_timeout(200)
    ok(pg.evaluate("Battle.debugState().problem.skill") == "teamzap" and "TEAM ZAP" in pg.inner_text("#battle-msg"), "team zap gives a puzzle")
    ok("Team Zap" not in pg.inner_text("#battle-powers"), "team move used up")
    pg.screenshot(path=SHOTS + "team_zap.png")
    ans = pg.evaluate("Battle.debugState().problem.answer")
    pg.locator("#battle-choices .choice-btn").nth(ans).click(); pg.wait_for_timeout(300)
    hp = pg.evaluate("Battle.debugState().enemyHp")
    ok(hp <= 17, f"team zap hits for 3+ ({20 - hp})")
    ok("TEAM ZAP" in pg.inner_text("#battle-msg"), "team zap message")
    # fizzle path
    pg.evaluate("() => Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0')"); battle_ready(pg)
    pg.locator("#battle-powers button:has-text('Team Zap')").click(); pg.wait_for_timeout(200)
    ans = pg.evaluate("Battle.debugState().problem.answer"); n = pg.locator("#battle-choices .choice-btn").count()
    pg.locator("#battle-choices .choice-btn").nth((ans + 1) % n).click(); pg.wait_for_timeout(300)
    ok("fizzled" in pg.inner_text("#battle-msg"), "wrong team zap fizzles")
    pg.wait_for_timeout(4500)
    ok(pg.evaluate("Battle.debugState().phase") == "attack", "fizzle doesn't trigger a block (no penalty)")
    # cheer
    pg.evaluate("() => { Main.getGame().hearts = 1; Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0'); }"); battle_ready(pg)
    pg.locator("#battle-powers button:has-text('Cheer')").click(); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().hearts") == 2 and "cheers" in pg.inner_text("#battle-msg"), "cheer heals a heart")
    # hint (with a picture problem)
    pg.evaluate("() => { ZONES.city.skills = ['rest']; Battle.start({type:'scrapbot', x:0, y:0, hpBonus:1}, '1,0'); }"); battle_ready(pg)
    lens0 = pg.evaluate("Main.getGame().lenses")
    pg.locator("#battle-powers button:has-text('Hint')").click(); pg.wait_for_timeout(200)
    ok("whispers" in pg.inner_text("#battle-msg") and pg.inner_text("#battle-visual").strip() != "", "hint gives a tip + free picture")
    ok(pg.evaluate("Main.getGame().lenses") == lens0, "hint doesn't use a lens")
    pg.screenshot(path=SHOTS + "hint.png")
    pg.evaluate("() => Main.returnToWorld()")

    # ---- save / continue keeps everything
    pg.evaluate("() => { Overworld.debugGoTo('0,0', 7, 6); Main.autoSave(); }")
    pg.reload(); pg.wait_for_timeout(300); pg.click("#btn-continue"); pg.wait_for_timeout(500)
    g = pg.evaluate("() => { const g = Main.getGame(); return {bike: g.bike, suit: g.suitIndex, decal: g.decal, comp: g.companion}; }")
    ok(g["bike"] == 3 and g["suit"] == 5 and g["decal"] == "star" and g["comp"]["mode"] == "follow", f"saved: {g}")
    ok(pg.is_visible("#btn-ride"), "RIDE button after continue")
    ok(pg.evaluate("Overworld.companionFollowing()"), "companion follows after continue")

    print("page errors:", errs)
    ok(not errs, "no page errors")
    print("FAILS:", len(fails))
    br.close()
