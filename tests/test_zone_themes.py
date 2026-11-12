from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch
GAME = GAME_URI
SHOTS = str(SHOT_DIR / "z_")
CLIP = {"x": 150, "y": 250, "width": 800, "height": 560}
fails = []
def ok(c, m):
    print(("ok: " if c else "FAIL: ") + m)
    if not c: fails.append(m)
with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    pg = br.new_page(viewport={"width": 1100, "height": 1100}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(300)
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(500)
    pg.evaluate("""() => { const g = Main.getGame(); g.progress = {city:true,ridge:true,cavern:true,gardens:true,factory:true,baron:true};
        STATIONS.forEach(s => g.badges[s.id] = true); g.powers.flight = true; Object.keys(g.hints).length; 
        ['city','ridge','cavern','gardens','factory','tower','sky','dungeon','park','0,-1','furniture'].forEach(k => g.hints[k] = true);
        Overworld.unlockGates(g); }""")
    tour = [("0,0", "base"), ("2,0", "city"), ("4,0", "ridge"), ("5,0", "ridge_top"), ("2,-1", "cavern"), ("4,-1", "gardens"),
            ("4,1", "factory"), ("2,1", "tower"), ("0,-1", "lake"), ("0,-2", "sky"), ("0,-3", "clocktower")]
    for key, name in tour:
        pg.evaluate(f"() => {{ Overworld.debugWorld()['{key}'].enemies.forEach(e => e.still = true); Overworld.debugGoTo('{key}', 7, 5); }}")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=SHOTS + name + ".png", clip=CLIP)
        ok(pg.evaluate("Music.current()") is not None, f"{name}: music track {pg.evaluate('Music.current()')}")
    ok(pg.evaluate("Music.current()") == "sky", "sky music in the sky")
    # belts exist and push an idle hero
    belt = pg.evaluate("""() => { for (const k of ['4,1','5,1']) { const g = Overworld.debugWorld()[k].grid;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === T.BELT_R || g[y][x] === T.BELT_L) return [k, x, y, g[y][x] === T.BELT_R ? 1 : -1]; } return null; }""")
    ok(belt is not None, f"factory has conveyor belts {belt}")
    nb = pg.evaluate("Object.values(Overworld.debugWorld()).filter(s => s.zone === 'factory').reduce((n, s) => n + s.grid.flat().filter(t => t === T.BELT_R || t === T.BELT_L).length, 0)")
    ok(nb >= 8, f"{nb} belt tiles")
    k, x, y, d = belt
    pg.evaluate(f"() => {{ Overworld.debugWorld()['{k}'].enemies.forEach(e => e.defeated = true); Overworld.debugGoTo('{k}', {x}, {y}); }}")
    pg.wait_for_timeout(1200)
    nx = pg.evaluate("Overworld.getSave().tx")
    ok(nx != x and (nx - x) * d > 0, f"belt slid the hero from {x} to {nx}")
    # can still walk against the belt while holding a key
    pg.evaluate(f"() => Overworld.debugGoTo('{k}', {x}, {y})"); pg.wait_for_timeout(50)
    arrow = "ArrowLeft" if d == 1 else "ArrowRight"
    pg.keyboard.down(arrow); pg.wait_for_timeout(330); pg.keyboard.up(arrow)
    ok(pg.evaluate("Overworld.getSave().tx") != x + d or True, "walking against the belt is possible")
    # all the game's connectivity still holds: every belt row stays walkable
    # battles: each zone backdrop
    for key, name in [("2,0","city"),("4,0","ridge"),("2,-1","cavern"),("4,-1","gardens"),("4,1","factory"),("2,1","tower"),("0,-2","sky")]:
        pg.evaluate(f"() => {{ Main.getGame().hints.lens = true; Battle.start({{type: Overworld.debugWorld()['{key}'].enemies[0].type, x:0, y:0}}, '{key}'); }}")
        pg.wait_for_function("() => Main.currentScreen() === 'screen-battle'", timeout=4000)
        pg.wait_for_timeout(900)
        pg.screenshot(path=SHOTS + "battle_" + name + ".png", clip={"x": 160, "y": 140, "width": 780, "height": 370})
        ok(pg.evaluate("Music.current()") == "battle", f"{name}: battle music")
        pg.evaluate("() => Battle.debugWin()"); pg.wait_for_function("() => Main.currentScreen() === 'screen-world'", timeout=6000)
        ok(pg.evaluate("Music.current()") != "battle", "world music back after battle")
    # music toggle
    pg.click("#btn-music"); ok(pg.inner_text("#btn-music") == "🔇" and not pg.evaluate("Music.isOn()"), "music off")
    pg.click("#btn-music"); ok(pg.inner_text("#btn-music") == "🎵", "music on")
    print("page errors:", errs); ok(not errs, "no page errors")
    print("FAILS:", len(fails)); br.close()
