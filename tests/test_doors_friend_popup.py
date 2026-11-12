from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch
GAME = GAME_URI
SHOTS = str(SHOT_DIR / "r6_")
fails = []
def ok(c, m):
    print(("ok: " if c else "FAIL: ") + m)
    if not c: fails.append(m)
def new(pg):
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)
with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    new(pg)
    pg.evaluate("""() => { const g = Main.getGame(); g.progress = {city:true,ridge:true,cavern:true,gardens:true,factory:true,baron:false};
        STATIONS.forEach(s => g.badges[s.id] = true); g.hasKey = true; Overworld.unlockGates(g);
        Object.values(Overworld.debugWorld()).forEach(s => (s.enemies||[]).forEach(e => e.defeated = true)); }""")
    # lair door from all four sides, holding the key long
    for (x, y, arrow) in [(8, 7, "ArrowDown"), (8, 9, "ArrowUp"), (7, 8, "ArrowRight"), (9, 8, "ArrowLeft")]:
        pg.evaluate(f"() => Overworld.debugGoTo('2,1', {x}, {y})"); pg.wait_for_timeout(150)
        pg.keyboard.down(arrow); pg.wait_for_timeout(1200); pg.keyboard.up(arrow); pg.wait_for_timeout(300)
        ok(pg.evaluate("Overworld.getSave().key") == "lair", f"lair door works holding {arrow}")
    # after release, pressing Down again does walk out
    pg.keyboard.down("ArrowDown"); pg.wait_for_timeout(400); pg.keyboard.up("ArrowDown"); pg.wait_for_timeout(300)
    ok(pg.evaluate("Overworld.getSave().key") == "2,1", "fresh Down press walks out of lair")
    # rescue -> companion follows, stride frames differ
    pg.evaluate("""() => { const g = Main.getGame(); g.progress.baron = true; g.companion = {mode:'follow'}; Overworld.placeCompanion(); Main.refreshHud(); }""")
    ok(pg.evaluate("civGrid('woman', true).join() !== civGrid('woman', false).join()"), "stride frame differs")
    ok(all(pg.evaluate(f"civGrid('{k}', true).every(r => r.length === 12)") for k in ["man","woman","boy","girl"]), "stride rows 12 wide")
    ok(pg.is_visible("#btn-friend") and "Max" in pg.inner_text("#btn-friend"), "🤝 button visible after rescue")
    # popup from HUD, rest at home
    pg.click("#btn-friend"); pg.wait_for_timeout(200)
    ok(pg.is_visible("#friend-pop") and "Rest at home" in pg.inner_text("#friend-pop-btns"), "popup offers Rest at home")
    pg.screenshot(path=SHOTS + "popup.png")
    pos0 = pg.evaluate("Overworld.getSave()")
    pg.keyboard.down("ArrowLeft"); pg.wait_for_timeout(500); pg.keyboard.up("ArrowLeft")
    ok(pg.evaluate("Overworld.getSave()") == pos0, "hero frozen while popup open")
    pg.click("text=Rest at home"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().companion.mode") == "home" and not pg.is_visible("#friend-pop"), "rest at home works")
    # bumping the bed now just opens popup (no change)
    pg.evaluate("() => Overworld.debugGoTo('hero_house', 13, 6)"); pg.wait_for_timeout(150)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(250); pg.keyboard.up("ArrowUp"); pg.wait_for_timeout(200)
    # (13,5) is the bed; friend at (12,5)
    ok(pg.is_visible("#friend-pop") and pg.evaluate("Main.getGame().companion.mode") == "home", "bumping bed opens popup without changing anything")
    pg.click("text=Stay home"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().companion.mode") == "home", "Stay home keeps her home")
    pg.click("#btn-friend"); pg.wait_for_timeout(150); pg.click("text=Come with me"); pg.wait_for_timeout(200)
    ok(pg.evaluate("Main.getGame().companion.mode") == "follow", "Come with me from anywhere")
    pg.evaluate("() => Overworld.debugGoTo('0,0', 7, 6)"); pg.wait_for_timeout(200)
    pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(700); pg.keyboard.up("ArrowRight"); pg.wait_for_timeout(100)
    pg.screenshot(path=SHOTS + "walk.png", clip={"x":150,"y":250,"width":800,"height":560})
    print("page errors:", errs); ok(not errs, "no page errors")
    print("FAILS:", len(fails)); br.close()
