import re
from playwright.sync_api import sync_playwright
from common import GAME_URI, SHOT_DIR, launch

GAME = GAME_URI
SHOTS = str(SHOT_DIR / "p3_")
fails = []
def ok(cond, msg):
    if not cond: fails.append(msg); print("FAIL:", msg)
    else: print("ok:", msg)

# selectors for the two places problems appear
UI = {
  "battle": dict(pad="#numpad", ops="#oppad", choices="#battle-choices", check="#btn-check", disp="#battle-display"),
  "tut":    dict(pad="#tut-pad",  ops="#tut-ops", choices="#tut-choices",    check="#btn-tut-check", disp="#tut-display"),
}
def solve(pg, where, p, right=True):
    u = UI[where]; inp = p["input"]
    def press(s):
        for ch in s: pg.locator(f"{u['pad']} .pad-btn:text-is('{ch}'), {u['ops']} .pad-btn:text-is('{ch}')").first.click()
    if inp == "number":
        press(str(p["answer"] if right else p["answer"] + 1)); pg.locator(f"{u['pad']} .pad-btn:text-is('OK')").click()
    elif inp == "equation":
        eq = p["reveal"].replace(" ", "")
        if not right:
            m = re.match(r"(\d+)([+−])(\d+)=(\d+)", eq); eq = f"{m.group(1)}{m.group(2)}{m.group(3)}={int(m.group(4))+1}"
        press(eq); pg.locator(f"{u['pad']} .pad-btn:text-is('OK')").click()
    elif inp == "choice":
        n = pg.locator(f"{u['choices']} .choice-btn").count()
        pg.locator(f"{u['choices']} .choice-btn").nth(p["answer"] if right else (p["answer"] + 1) % n).click()
    elif inp == "multi":
        ans = p["answer"] if right else [p["answer"][0], [i for i in range(3) if i not in p["answer"]][0]]
        for i in ans: pg.locator(f"{u['choices']} .choice-btn").nth(i).click()
        pg.click(u["check"])
    elif inp == "graph":
        last = p["answer"][-1]
        vals = p["answer"] if right else p["answer"][:-1] + [last - 1 if last > 1 else last + 1]
        for r, v in enumerate(vals): pg.locator(f"{u['disp']} .bg-cell[data-r='{r}'][data-k='{v}']").click()
        pg.click(u["check"])
    elif inp == "coins":
        left = p["answer"] + (0 if right else 1)
        for v in sorted(p["coinSet"], reverse=True):
            while left >= v:
                pg.locator(f"{u['disp']} .coin-palette .coin[data-v='{v}']").click(); left -= v
        pg.click(u["check"])

PJS = "(p) => ({skill:p.skill, input:p.input, answer:p.answer, reveal:p.reveal, coinSet:p.coinSet || null})"
def battle_problem(pg): return pg.evaluate(f"({PJS})(Battle.debugState().problem)")
def tut_problem(pg): return pg.evaluate(f"({PJS})(Tutorial.debugState().problem)")
def battle_ready(pg):
    pg.wait_for_function("() => { const B = Battle.debugState(); return B.problem && !B.locked && (B.phase==='attack'||B.phase==='block'); }", timeout=9000)
def tut_ready(pg):
    pg.wait_for_function("() => { const d = Tutorial.debugState(); return d.problem && !d.locked && (d.mode==='challenge'||d.mode==='free'); }", timeout=9000)

def earn(pg, sid, shot=False):
    pg.evaluate(f"() => Tutorial.open('{sid}')")
    pg.wait_for_timeout(150)
    ok(GATE_NAME[sid] in pg.inner_text("#tut-badge-status").upper(), f"{sid}: status says which zone it opens")
    steps = 0
    while "CHALLENGE" not in pg.inner_text("#btn-tut-next") and steps < 12:
        if shot and steps == 0: pg.screenshot(path=SHOTS + f"lesson_{sid}.png")
        pg.click("#btn-tut-next"); steps += 1; pg.wait_for_timeout(50)
    pg.click("#btn-tut-next")
    for i in range(3):
        tut_ready(pg); p = tut_problem(pg)
        if shot and i == 0: pg.screenshot(path=SHOTS + f"challenge_{sid}.png")
        solve(pg, "tut", p)
    pg.wait_for_function("() => Tutorial.debugState().mode === 'done'", timeout=6000)
    pg.wait_for_timeout(150)
    ok(pg.evaluate(f"Main.getGame().badges['{sid}']") is True, f"{sid}: badge earned")
    cap = pg.inner_text("#tut-caption")
    pg.click("#btn-tut-exit")
    return cap

def beat_boss(pg, screen, boss_id):
    pg.evaluate(f"""() => {{ const e = Overworld.debugWorld()['{screen}'].enemies.find(e => e.boss === '{boss_id}');
                           Main.getGame().hints.lens = true; Battle.start(e, '{screen}'); }}""")
    battle_ready(pg)
    pg.evaluate("() => { Battle.debugState().enemyHp = 1; }")
    for _ in range(4):
        p = battle_problem(pg); solve(pg, "battle", p)
        pg.wait_for_function("() => { const B = Battle.debugState(); return B.phase === 'won' || (!B.locked && (B.phase==='attack'||B.phase==='block')); }", timeout=9000)
        if pg.evaluate("Battle.debugState().phase") == "won": break
    pg.wait_for_timeout(600)
    msg = pg.inner_text("#battle-msg")
    pg.wait_for_function("() => Main.currentScreen() !== 'screen-battle'", timeout=9000)
    pg.wait_for_timeout(200)
    return msg

def walk(pg, key, tx, ty, direction, ms):
    pg.evaluate(f"() => Overworld.debugGoTo('{key}', {tx}, {ty})"); pg.wait_for_timeout(200)
    pg.keyboard.down(direction); pg.wait_for_timeout(ms); pg.keyboard.up(direction); pg.wait_for_timeout(250)
    return pg.evaluate("Overworld.getSave().key")

with sync_playwright() as pw:
    br = launch(pw, ["--no-sandbox"])
    pg = br.new_page(viewport={"width": 1100, "height": 1200})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME); pg.wait_for_timeout(400)
    GATE_NAME = pg.evaluate("() => Object.fromEntries(STATIONS.filter(s => GATES[s.zone]).map(s => [s.id, GATES[s.zone].name.toUpperCase()]))")
    pg.click("#btn-new"); pg.fill("#name-input", "Sam"); pg.fill("#rescue-input", "Max")
    pg.click("#btn-begin"); pg.click("#btn-story-go"); pg.wait_for_timeout(1000)
    goal = pg.inner_text("#goal-bar")
    ok(("PRACTICE PARK" in goal or "glowing" in goal) and "Add & Take Away" in goal and "Story Detective" in goal and "CITY STREETS" in goal, "start goal: " + goal)
    ok("🎯" in pg.inner_text("#toast"), "welcome toast points at goal box")
    ok(pg.inner_text("#hud-badges") == "🏅 0/10", "0/10 badges")

    # park: first visit hint, only 2 stations open, locked station refuses
    walk(pg, "0,0", 1, 4, "ArrowLeft", 500)
    ok(pg.evaluate("Overworld.getSave().key") == "-1,0", "walked into park")
    pg.wait_for_timeout(900)
    ok("GLOWING" in pg.inner_text("#toast"), "park first-visit hint: " + pg.inner_text("#toast"))
    unlocked = pg.evaluate("() => STATIONS.filter(s => !s.screen && stationUnlocked(Main.getGame(), s)).map(s => s.id)")
    ok(unlocked == ["addsub", "story"], f"only city stations unlocked: {unlocked}")
    pg.screenshot(path=SHOTS + "park_start.png")
    walk(pg, "-1,0", 7, 3, "ArrowUp", 250)
    ok(pg.evaluate("Main.currentScreen()") == "screen-world" and "LOCKED" in pg.inner_text("#toast"), "locked station toast: " + pg.inner_text("#toast"))
    walk(pg, "-1,0", 2, 3, "ArrowUp", 250)
    ok(pg.evaluate("Main.currentScreen()") == "screen-tutorial", "open station opens")
    pg.click("#btn-tut-exit")

    earn(pg, "addsub")
    cap = earn(pg, "story")
    ok("CITY STREETS is now OPEN" in cap, "city opened: " + cap)
    pg.wait_for_timeout(400)
    ok("Next" in pg.inner_text("#toast") and "GREMLIN KING" in pg.inner_text("#toast"), "after badge, next-goal toast: " + pg.inner_text("#toast"))
    ok("GREMLIN KING" in pg.inner_text("#goal-bar"), "goal: gremlin king")
    ok(walk(pg, "0,0", 14, 4, "ArrowRight", 600) == "1,0", "base -> city")

    # Ridge gate: locked before boss (red)
    walk(pg, "3,0", 14, 4, "ArrowRight", 300)
    ok(pg.evaluate("Overworld.getSave().key") == "3,0" and "GREMLIN KING" in pg.inner_text("#toast"), "ridge gate needs boss: " + pg.inner_text("#toast"))
    msg = beat_boss(pg, "1,0", "city")
    ok("NEW in Practice Park" in msg and "Tens" in msg, "king win announces Tens station: " + msg)
    ok("Tens" in pg.inner_text("#goal-bar"), "goal: tens badge")
    walk(pg, "3,0", 14, 4, "ArrowRight", 300)
    ok("Almost open" in pg.inner_text("#toast"), "ridge gate wants badge: " + pg.inner_text("#toast"))
    pg.screenshot(path=SHOTS + "badge_gate.png")
    pg.evaluate("() => Overworld.debugGoTo('-1,0', 8, 6)"); pg.wait_for_timeout(1200)
    ok("Tens" in pg.inner_text("#toast"), "park entry repeats goal: " + pg.inner_text("#toast"))
    pg.screenshot(path=SHOTS + "park_tens.png")
    cap = earn(pg, "tens", shot=True)
    ok("NUMBER RIDGE is now OPEN" in cap, "ridge open: " + cap)
    ok(walk(pg, "3,0", 14, 4, "ArrowRight", 600) == "4,0", "city -> ridge")
    pg.wait_for_timeout(900); pg.screenshot(path=SHOTS + "ridge.png")
    ok(walk(pg, "4,0", 14, 4, "ArrowRight", 600) == "5,0", "ridge -> ridge top")

    # Caverns (now bar graphs & coins)
    msg = beat_boss(pg, "5,0", "ridge")
    ok("Bar Graphs" in msg and "Coin Counter" in msg, "ram win announces cavern stations: " + msg)
    earn(pg, "graphs"); cap = earn(pg, "money", shot=True)
    ok("ROBO-CAVERNS is now OPEN" in cap, "caverns open: " + cap)
    ok(walk(pg, "1,0", 7, 1, "ArrowUp", 600) == "1,-1", "city -> caverns")
    pg.wait_for_timeout(900); pg.screenshot(path=SHOTS + "caverns.png")

    # the Secret Gardens stay shut until the Robo-Baron is beaten
    walk(pg, "3,-1", 14, 4, "ArrowRight", 300)
    ok(pg.evaluate("Overworld.getSave().key") == "3,-1" and "ROBO-BARON" in pg.inner_text("#toast"), "gardens gate needs the robo-baron: " + pg.inner_text("#toast"))

    # Factory
    walk(pg, "4,0", 7, 9, "ArrowDown", 300)
    ok(pg.evaluate("Overworld.getSave().key") == "4,0", "factory gate closed")
    msg = beat_boss(pg, "3,-1", "cavern")
    ok("Shape Splitter" in msg and "Equation Master" in msg, "drillmaster win announces factory stations: " + msg)
    earn(pg, "eqmaster"); cap = earn(pg, "shapes", shot=True)
    ok("SHAPE FACTORY is now OPEN" in cap, "factory open: " + cap)
    ok(walk(pg, "4,0", 7, 9, "ArrowDown", 600) == "4,1", "ridge -> factory")
    pg.wait_for_timeout(900); pg.screenshot(path=SHOTS + "factory.png")
    ok(walk(pg, "4,1", 14, 4, "ArrowRight", 600) == "5,1", "factory -> factory back")

    # Tower
    msg = beat_boss(pg, "5,1", "factory")
    ok("Fair Shares" in msg and "Equal Groups" in msg, "shifter win announces groups + div: " + msg)
    earn(pg, "mult"); cap = earn(pg, "div")
    ok("VILLAIN'S TOWER is now OPEN" in cap, "tower open: " + cap)
    ok(walk(pg, "1,0", 7, 9, "ArrowDown", 600) == "1,1", "city -> tower")
    ok("GOLDEN KEY" in pg.inner_text("#goal-bar"), "goal: golden key")
    ok(pg.inner_text("#hud-badges") == "🏅 9/10", "9/10 badges (the sky time badge is a bonus)")
    ok(pg.evaluate("zoneOpen(Main.getGame(), 'gardens')") is False, "gardens still locked before the rescue")

    # battles in each new zone use that zone's skills; coins/fraction/mirror solvable in battle
    for zone, screen in [("ridge", "4,0"), ("cavern", "1,-1"), ("factory", "4,1"), ("tower", "1,1")]:
        allowed = set(s.split(":")[0] for s in pg.evaluate(f"ZONES.{zone}.skills"))
        seen = set()
        for i in range(6):
            pg.evaluate(f"() => {{ Main.getGame().hearts = 5; Battle.start({{type:'scrapbot', x:0, y:0, hpBonus:1}}, '{screen}'); }}")
            battle_ready(pg)
            pg.evaluate("() => { Battle.debugState().enemyHp = 30; }")
            p = battle_problem(pg); seen.add(p["skill"])
            hp0 = pg.evaluate("Battle.debugState().enemyHp")
            solve(pg, "battle", p); pg.wait_for_timeout(300)
            ok(pg.evaluate("Battle.debugState().enemyHp") < hp0, f"{zone}: {p['skill']} ({p['input']}) answered right hits")
        ok(seen <= allowed, f"{zone} skills {seen} within {allowed}")
    for sk in ["money", "fraction", "mirror"]:
        for k in range(8):
            pg.evaluate(f"() => {{ ZONES.factory.skills = ['{sk}']; Battle.start({{type:'scrapbot', x:0, y:0, hpBonus:1}}, '4,1'); }}")
            battle_ready(pg); p = battle_problem(pg)
            if sk != "money" or p["input"] == "coins": break
        pg.screenshot(path=SHOTS + f"battle_{sk}.png")
        solve(pg, "battle", p, right=False); pg.wait_for_timeout(400)
        ok("Not quite" in pg.inner_text("#battle-msg"), f"{sk} wrong answer reveal: " + pg.inner_text("#battle-msg"))
        if p["input"] == "coins": pg.screenshot(path=SHOTS + "battle_coins_wrong.png")
    pg.evaluate("() => { ZONES.factory.skills = FACTORY_SKILLS; }")

    # save / continue
    pg.evaluate("() => { Overworld.debugGoTo('0,0', 7, 6); Main.autoSave(); }")
    pg.reload(); pg.wait_for_timeout(400); pg.click("#btn-continue"); pg.wait_for_timeout(500)
    ok(walk(pg, "4,0", 7, 9, "ArrowDown", 600) == "4,1", "gates still open after continue")
    ok(pg.evaluate("Main.getGame().progress.factory") is True, "progress kept")
    pg.evaluate("() => Overworld.debugGoTo('-1,0', 8, 6)"); pg.wait_for_timeout(400)
    pg.screenshot(path=SHOTS + "park_done.png")

    print("page errors:", errs)
    ok(not errs, "no page errors")
    print("FAILS:", len(fails))
    br.close()
