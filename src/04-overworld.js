/* ============================ OVERWORLD ============================ */
function floorOf(zone) {
  return { city: T.ROAD, cavern: T.CAVE_FLOOR, tower: T.TOWER_FLOOR, interior: T.IN_FLOOR }[zone] || T.FLOOR;
}
const Overworld = (() => {
  let canvas, ctx;
  const state = {
    key: "0,0",
    px: 7 * TILE, py: 6 * TILE,       /* pixel position */
    dir: "down", frame: 0, animT: 0,
    moving: false, targetX: 0, targetY: 0,
    lastLabel: "",
    comp: { x: 7, y: 6, px: 7 * TILE, py: 6 * TILE },   /* the rescued friend, one step behind */
  };
  let world = null;
  const keys = {};
  const heldThroughDoor = new Set();
  const SPEED = 3.2;

  function init() {
    canvas = document.getElementById("world-canvas");
    ctx = canvas.getContext("2d");
    world = buildWorld();
    window.addEventListener("keydown", e => {
      if (Main.currentScreen() !== "screen-world") return; /* never steal keys from typing */
      const k = normKey(e.key);
      if (k) {
        e.preventDefault();
        if (!heldThroughDoor.has(k)) keys[k] = true;   /* a key held through a door waits for a fresh press */
      }
    });
    window.addEventListener("keyup", e => {
      const k = normKey(e.key);
      if (k) { keys[k] = false; heldThroughDoor.delete(k); }
    });
    requestAnimationFrame(loop);
  }
  function normKey(k) {
    return { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
             w: "up", s: "down", a: "left", d: "right",
             W: "up", S: "down", A: "left", D: "right" }[k] || null;
  }
  function releaseKeys() { for (const k in keys) keys[k] = false; }

  function screen() { return world[state.key]; }
  function screenKey() { return state.key; }
  function screenCoords() {
    const m = state.key.match(/^(-?\d+),(-?\d+)$/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  }
  function enemies() { return screen().enemies || []; }
  function critters() { return screen().critters || []; }
  function pickups() { return screen().pickups || []; }

  function tileAt(tx, ty) {
    const s = screen();
    if (!s || ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return T.WALL;
    return s.grid[ty][tx];
  }
  function passable(tx, ty) { return !SOLID.has(tileAt(tx, ty)); }
  function heroPassable(tx, ty) {
    const t = tileAt(tx, ty);
    if (t === T.WATER && Main.getGame().powers && Main.getGame().powers.flight) return true;
    return !SOLID.has(t);
  }
  function enemyAt(tx, ty) {
    return enemies().findIndex(e => !e.defeated && e.x === tx && e.y === ty);
  }
  function heroTile() {
    return [Math.round(state.px / TILE), Math.round(state.py / TILE)];
  }

  function companionFollowing() {
    const g = Main.getGame();
    return !!(g.progress && g.progress.baron && g.companion && g.companion.mode === "follow");
  }
  function placeCompanion() {
    const [hx, hy] = heroTile();
    state.comp = { x: hx, y: hy, px: hx * TILE, py: hy * TILE };
  }
  function goTo(key, tx, ty) {
    state.key = key;
    state.px = tx * TILE; state.py = ty * TILE;
    state.targetX = state.px; state.targetY = state.py;
    state.moving = false;
    state.comp = { x: tx, y: ty, px: tx * TILE, py: ty * TILE };
    onEnterScreen();
  }

  /* wandering enemies take a random step every so often */
  let enemyTimer = 0;
  function updateEnemies() {
    enemyTimer++;
    if (enemyTimer % 55 !== 0) return;
    const [hx, hy] = heroTile();
    for (const e of enemies()) {
      if (e.defeated || e.boss || e.still) continue;   /* bosses & guards stand their ground */
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]].sort(() => Math.random() - .5);
      for (const [dx, dy] of dirs) {
        const nx = e.x + dx, ny = e.y + dy;
        if (nx < 1 || nx >= COLS-1 || ny < 1 || ny >= ROWS-1) continue;
        if (!passable(nx, ny)) continue;
        if (enemyAt(nx, ny) !== -1) continue;
        if (nx === hx && ny === hy) {           /* enemy bumps hero! */
          if (Main.getGame().powers && Main.getGame().powers.invis) continue;  /* can't see you! */
          Battle.start(e, screenKey());
          return;
        }
        e.x = nx; e.y = ny;
        break;
      }
    }
    /* friendly critters wander too */
    for (const c of critters()) {
      if (c.still || Math.random() < .5) continue;
      const dirs = [[0,1],[0,-1],[1,0],[-1,0]].sort(() => Math.random() - .5);
      for (const [dx, dy] of dirs) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 1 || nx >= COLS-1 || ny < 1 || ny >= ROWS-1) continue;
        if (!passable(nx, ny)) continue;
        if (nx === hx && ny === hy) continue;
        c.x = nx; c.y = ny;
        break;
      }
    }
  }

  function tryStartMove(dir) {
    state.dir = dir;
    const tx = Math.round(state.px / TILE), ty = Math.round(state.py / TILE);
    let nx = tx, ny = ty;
    if (dir === "up") ny--; if (dir === "down") ny++;
    if (dir === "left") nx--; if (dir === "right") nx++;

    /* screen transition when stepping past the edge through an opening */
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      const coords = screenCoords();
      if (!coords) return;   /* interiors have no edge exits */
      const dx = nx < 0 ? -1 : nx >= COLS ? 1 : 0;
      const dy = ny < 0 ? -1 : ny >= ROWS ? 1 : 0;
      const nextKey = (coords[0] + dx) + "," + (coords[1] + dy);
      if (world[nextKey]) {
        const ex = dx === 1 ? 0 : dx === -1 ? COLS - 1 : nx;
        const ey = dy === 1 ? 0 : dy === -1 ? ROWS - 1 : ny;
        if (!SOLID.has(world[nextKey].grid[ey][ex])) goTo(nextKey, ex, ey);
      }
      return;
    }

    /* doors (enterable buildings) */
    const door = DOORS[state.key + ":" + nx + "," + ny];
    if (door) {
      if (door.to === "lair" && !Main.getGame().hasKey) {
        Sound.play("bump");
        Main.toast("🔒 The lair door is locked TIGHT! Find the 🗝️ GOLDEN KEY — the Key Keeper has it, somewhere east in the Tower...", 6500);
        return;
      }
      if (door.to === "lair") {
        Main.toast("🗝️ The Golden Key fits! *CLICK* The lair door swings open...", 4000);
      }
      Sound.play("banner");
      /* stop! otherwise a held arrow walks straight back out of the exit */
      for (const k in keys) if (keys[k]) heldThroughDoor.add(k);
      releaseKeys();
      goTo(door.to, door.x, door.y);
      return;
    }

    const ei = enemyAt(nx, ny);
    if (ei !== -1) {                      /* hero bumps enemy! */
      Battle.start(enemies()[ei], screenKey());
      return;
    }
    const t = tileAt(nx, ny);
    if (t === T.STATION) {                 /* Practice Park badge stations */
      const st = stationAt(state.key, nx, ny);
      if (st) {
        const g = Main.getGame();
        if (!stationUnlocked(g, st)) {
          const b = BOSSES[GATES[st.zone].boss];
          Sound.play("bump");
          Main.toast(`🔒 ${st.icon} ${st.name} is LOCKED. It opens after you out-smart the ${b.name.toUpperCase()}. ` +
                     `Glowing stations are the ones you need right now!`, 6500);
          Main.flashGoal();
          return;
        }
        Sound.play("banner"); releaseKeys(); Tutorial.open(st.id); return;
      }
    }

    if (t === T.GATE) {
      const g = Main.getGame();
      const zone = GATE_AT[state.key + ":" + nx + "," + ny];
      const gate = GATES[zone];
      if (!bossDone(g, zone)) {
        const b = BOSSES[gate.boss];
        Main.toast(`🔒 ${gate.name.toUpperCase()} is locked! First out-smart the ${b.name.toUpperCase()} at ${b.where}.`, 6500);
      } else {
        const miss = missingBadges(g, zone);
        Main.toast(`🏅 Almost open! ${gate.name} needs the ${badgeList(miss)} ${plural(miss.length, "badge")}. ` +
                   `Earn ${miss.length > 1 ? "them" : "it"} in PRACTICE PARK (far west ⬅)!`, 7500);
      }
      Main.flashGoal();
      Sound.play("bump");
      return;
    }
    if (t === T.ROCK && Main.getGame().powers && Main.getGame().powers.strength) {
      const s = screen();
      s.grid[ny][nx] = floorOf(s.zone);
      s.pickups.push({ x: nx, y: ny, kind: "part" });   /* treasure under the boulder! */
      Sound.play("clatter");
      Main.toast("💪 SUPER STRENGTH! You crushed the boulder — something was underneath!", 3500);
      return;
    }
    if (state.key === "hero_house") {
      const g = Main.getGame();
      const atBed = nx === COMPANION_BED.x && ny === COMPANION_BED.y;
      const atHome = nx === COMPANION_HOME.x && ny === COMPANION_HOME.y && g.companion && g.companion.mode === "home";
      if (atBed || atHome) {
        const friend = g.rescue ? g.rescue.name : "your friend";
        if (!(g.progress && g.progress.baron)) {
          Sound.play("banner");
          Main.toast(`🛏️ A cozy spare bed. It's waiting for ${friend}... rescue them from the Robo-Baron!`, 4500);
        } else {
          releaseKeys();
          Main.openFriendPopup();   /* a choice box: nothing changes unless he taps a button */
        }
        return;
      }
    }
    const ci = critters().findIndex(c => c.x === nx && c.y === ny);
    if (ci !== -1) {
      const c = critters()[ci];
      if (c.shop) { Sound.play("banner"); Main.openShop(); return; }
      Sound.play("victory");
      const spr = CRITTER_SPRITES[c.sprite];
      Main.toast(spr.emoji + " " + c.name + ": " + spr.sound + " 💙", 3000);
      return;
    }
    if (t === T.TROPHY || t === T.BOSS_CASE) { Sound.play("banner"); releaseKeys(); Main.openTrophies(); return; }
    if (t === T.DECOR) {
      const g = Main.getGame();
      if (screen().decorMap) {   /* furniture on display in Comfy Corner */
        const d = DECOR[screen().decorMap[nx + "," + ny]];
        Sound.play("banner");
        Main.toast(g.furnitureSaved ? `${d.icon} ${d.name}: ${d.cost} 🔩. Buy one at Penny's counter!`
                                    : `${d.icon} A ${d.name}... with gremlin footprints on it! 😠`, 3500);
        return;
      }
      const id = ((g.decor || {}).placed || {})[nx + "," + ny];
      if (id && DECOR[id]) { Sound.play("victory"); Main.toast(DECOR[id].icon + " " + DECOR[id].msg, 3500); }
      else Sound.play("bump");
      return;
    }
    if (t === T.COUNTER && state.key === "furniture") { talkToPenny(); return; }
    if (t === T.WATER && state.key === "0,-1" && !(Main.getGame().powers && Main.getGame().powers.flight)) {
      Sound.play("bump");
      Main.toast("🌊 Too deep to swim! Only a hero with FLIGHT 🕊️ can cross to the SKY ISLES. (Rita sells FLIGHT at the Workshop.)", 5000);
      return;
    }
    if (t === T.BIKE)  { Sound.play("banner"); releaseKeys(); Garage.open("bike"); return; }
    if (t === T.PAINT) { Sound.play("banner"); releaseKeys(); Garage.open("paint"); return; }
    if (t === T.CHEST || t === T.PUZZLE_DOOR) {
      const g = Main.getGame();
      const key = state.key + ":" + nx + "," + ny;
      if (t === T.CHEST && g.opened && g.opened[key]) {
        Sound.play("bump");
        Main.toast("📦 Empty! You already opened this treasure chest.", 2500);
        return;
      }
      releaseKeys();
      Sound.play("banner");
      Puzzle.open({ type: t === T.CHEST ? "chest" : "door", key, tier: puzzleTier(),
                    big: !!screen().dungeon });
      return;
    }
    if (t === T.COUNTER && state.key === "workshop") {   /* Rita's counter opens the menu */
      Sound.play("banner");
      Main.openShop();
      return;
    }
    if (t === T.COUNTER && state.key === "garage") {   /* free recharge station! */
      const g = Main.getGame();
      if (g.hearts < g.maxHearts) {
        g.hearts = g.maxHearts;
        Sound.play("victory");
        Main.toast("🔋 ZZZAP! The friendly robots recharged your suit — hearts FULL! Come back any time!", 4500);
        Main.refreshHud();
        Main.autoSave();
      } else {
        Sound.play("banner");
        Main.toast("🔋 The robots check your suit: \"Hearts already full! Looking good!\"", 3000);
      }
      return;
    }
    if (t === T.ROCK) {   /* no strength yet: drop a hint */
      Sound.play("bump");
      Main.toast("🪨 A heavy boulder! If only you had SUPER STRENGTH... (Rita sells it at the Workshop!)", 4500);
      return;
    }
    if (SOLID.has(t) && !heroPassable(nx, ny)) {
      /* interactable solids show a message */
      const msgKey = state.key + ":" + nx + "," + ny;
      if (MESSAGES[msgKey]) {
        const g = Main.getGame();
        Main.toast(MESSAGES[msgKey]
          .replace(/\{rescue\}/g, g.rescue ? g.rescue.name : "your friend")
          .replace(/\{name\}/g, g.name), 4500);
        Sound.play("banner");
      }
      else Sound.play("bump");
      return;
    }
    state.moving = true;
    state.targetX = nx * TILE; state.targetY = ny * TILE;
    state.comp.x = tx; state.comp.y = ty;   /* friend steps into the tile you just left */
  }

  /* Comfy Corner Furniture: Penny hides until the Couch Crusher is beaten */
  function talkToPenny() {
    const g = Main.getGame();
    releaseKeys();
    if (!g.furnitureSaved) {
      Sound.play("bump");
      Main.toast(`😨 Penny Pillow whispers from behind the counter: "Psst! Hero! That COUCH CRUSHER gremlin is wrecking my store! Please stop it!"`, 6000);
      return;
    }
    Sound.play("banner");
    if (!g.furnitureGift) {
      g.furnitureGift = true;
      g.decor = g.decor || { owned: {}, placed: {} };
      g.decor.owned.plant = (g.decor.owned.plant || 0) + 1;
      Main.autoSave();
      Garage.open("store", null, `🎁 Penny Pillow: "You SAVED my store! Here's a 🪴 POTTED PLANT, FREE! Place it at home with 🛋️ DECORATE. And come shop any time!"`);
      return;
    }
    Garage.open("store");
  }
  function applyStoreState(g) {
    for (const e of (world["furniture"].enemies || [])) if (e.storeBully && g.furnitureSaved) e.defeated = true;
  }

  const QUEST_HINTS = {
    dungeon: "🧩 Gremlins are hiding in here! See the purple PUZZLE DOOR? Solve its puzzle to reach the TREASURE CHEST behind it!",
    park:   "🎈 PRACTICE PARK! Only the GLOWING stations are open, and those are exactly the badges you need next. 🔒 Locked ones open later as you beat bosses!",
    ridge:  "⛰️ NUMBER RIDGE! Count by 10s up the mountain. The ROCKSLIDE RAM waits at the top, east!",
    gardens:"🌻 The SECRET GARDENS! Only true heroes get in here. The problems are TRICKY: adding 3 numbers and building equations. The THISTLE QUEEN rules the far end!",
    factory:"🏭 SHAPE FACTORY! Robots cut shapes into halves and fourths here. The SHAPE-SHIFTER is in the back!",
    city:   "🕵️ The Gear-Gremlins ran this way with the donuts! Someone said their boss took {rescue} to the Tower...",
    cavern: "⛏️ The ROBO-CAVERNS! Mole-Bots dig up COINS down here and keep score on BAR GRAPHS. The DRILLMASTER is in the deepest cave!",
    tower:  "🗼 The Robo-Baron's Tower! His lair is locked — rumor says a KEY KEEPER guards the 🗝️ Golden Key in the east wing. Go get it, {name}!",
    furniture: "😨 Uh oh! A COUCH CRUSHER gremlin is wrecking this furniture store, and the shopkeeper is HIDING behind the counter! Stop that gremlin!",
    "0,-1": "🌊 WISHING LAKE! The SKY ISLES float on the other side... but only a hero who can FLY 🕊️ can cross.",
    sky:    "☁️ The SKY ISLES! Clouds, rainbows... and the CLOCK TOWER. Learn to read clocks at the glowing 🕐 TIME station!",
    depot:  "🍩 There's the donut thief — RIGHT THERE! Get those donuts back, {name}!",
  };

  function onEnterScreen() {
    keySeed = seedFor(state.key);
    weather.length = 0; flash = 0; nextFlash = performance.now() + 2500;
    spawnAmbience();
    Music.zone(screen().battleZone || screen().zone);
    Main.refreshHud();   /* e.g. the DECORATE button only shows inside Hero House */
    const s = screen();
    const label = s.label || ZONES[s.zone].label;
    if (label !== state.lastLabel) {
      state.lastLabel = label;
      Main.banner(label);
      Main.setZoneChip(label);
      Sound.play("banner");
    }
    /* one-time quest hints keep the story alive */
    const g = Main.getGame();
    const hintKey = QUEST_HINTS[state.key] ? state.key : s.dungeon ? "dungeon" : (QUEST_HINTS[s.zone] ? s.zone : null);
    const showHint = hintKey && g.hints && !g.hints[hintKey];
    if (showHint) {
      g.hints[hintKey] = true;
      setTimeout(() => Main.toast(
        QUEST_HINTS[hintKey]
          .replace(/\{rescue\}/g, g.rescue ? g.rescue.name : "your friend")
          .replace(/\{name\}/g, g.name), 7000), 700);
    }
    Main.refreshHud();
    /* in the park, always say what's needed right now */
    if (state.key === "-1,0" && !showHint)
      setTimeout(() => Main.toast("🎯 " + nextGoal(g).replace("Go to PRACTICE PARK (far west ⬅) and earn", "Earn"), 6000), 900);
    Main.autoSave();
  }

  function collectPickups() {
    const [hx, hy] = heroTile();
    for (const p of pickups()) {
      if (p.taken || p.x !== hx || p.y !== hy) continue;
      p.taken = true;
      const g = Main.getGame();
      if (p.kind === "part") {
        g.parts++;
        Sound.play("save");
        Main.toast("Picked up a part! 🔩", 1800);
      } else if (p.kind === "key") {
        /* the Key Keeper won't let you just walk off with it! */
        const keeper = enemies().find(e => e.guardsKey && !e.defeated);
        if (keeper && !(g.powers && g.powers.invis)) {
          p.taken = false;
          Sound.play("encounter");
          Main.toast("😠 \"HEY! That's MY key!\" The KEY KEEPER charges at you!", 3500);
          releaseKeys();
          setTimeout(() => Battle.start(keeper, screenKey()), 900);
          return;
        }
        g.hasKey = true;
        Sound.play("victory");
        Main.toast("🗝️ THE GOLDEN KEY! This opens the Robo-Baron's lair. Go save " + (g.rescue ? g.rescue.name : "your friend") + "!", 6500);
      } else if (p.kind === "donut") {
        if (g.hearts < g.maxHearts) {
          g.hearts++;
          Main.toast("Yum, a donut! ❤️ +1 heart!", 2200);
        } else {
          g.parts++;
          Main.toast("Yum, a donut! You traded it for a part. 🔩", 2200);
        }
        Sound.play("victory");
      }
      Main.refreshHud();
      Main.autoSave();
    }
  }

  function update() {
    if (Main.popupOpen()) return;   /* the world waits while a choice box is open */
    updateEnemies();
    const c = state.comp, tx2 = c.x * TILE, ty2 = c.y * TILE;
    c.px += Math.sign(tx2 - c.px) * Math.min(SPEED, Math.abs(tx2 - c.px));
    c.py += Math.sign(ty2 - c.py) * Math.min(SPEED, Math.abs(ty2 - c.py));
    if (state.moving) {
      const dx = state.targetX - state.px, dy = state.targetY - state.py;
      state.px += Math.sign(dx) * Math.min(SPEED, Math.abs(dx));
      state.py += Math.sign(dy) * Math.min(SPEED, Math.abs(dy));
      if (state.px === state.targetX && state.py === state.targetY) {
        state.moving = false;
        collectPickups();
      }
      state.animT++;
      if (state.animT % 8 === 0) state.frame = 1 - state.frame;
    } else {
      const dir = keys.up ? "up" : keys.down ? "down" : keys.left ? "left" : keys.right ? "right" : null;
      if (dir) tryStartMove(dir);
      else if (!beltPush()) state.frame = 0;
    }
  }

  /* ---- rendering ---- */
  /* ===================== ZONE THEMES: every area looks, moves and feels different ===================== */
  const hash2 = (x, y, k) => {
    let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  let keySeed = 0;
  function seedFor(key) { let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
  const isTop = () => state.key === "5,0";   /* the snowy top of Number Ridge */
  function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function cloudPuff(cx, cy, s, c, shade) {
    if (shade) { circle(cx, cy + s * .35, s * .95, shade); }
    circle(cx - s * .55, cy + s * .1, s * .6, c); circle(cx + s * .55, cy + s * .1, s * .6, c); circle(cx, cy - s * .2, s * .75, c);
  }

  /* returns true if the zone has its own look for this tile */
  function drawThemed(t, x, y, zone, px, py) {
    const r = hash2(x, y, keySeed), now = performance.now();
    const groundT = t === T.FLOOR || t === T.CAVE_FLOOR || t === T.TOWER_FLOOR;
    const wallT = t === T.WALL || t === T.CAVE_WALL || t === T.TOWER_WALL;
    const zc = ZONES[zone];
    if (zone === "ridge") {
      if (groundT) {
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        if (isTop() && r < .3) {   /* drifts of snow */
          ctx.fillStyle = "rgba(255,255,255,.8)";
          circle(px + 10 + r * 40, py + 30, 7 + r * 10, "rgba(255,255,255,.8)"); circle(px + 22 + r * 30, py + 34, 6, "rgba(255,255,255,.8)");
        }
        else if (r < .35) { ctx.fillStyle = "#7da650"; for (let k = 0; k < 3; k++) ctx.fillRect(px + 10 + k * 5 + r * 20, py + 30 - k % 2 * 3, 2, 7); }
        else if (r < .55) { circle(px + 14 + r * 30, py + 34, 3, "#8a7a62"); circle(px + 30, py + 14 + r * 20, 2, "#9a8a72"); }
        return true;
      }
      if (wallT) {   /* layered cliff rock */
        ctx.fillStyle = "#7a6650"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#8d785f"; ctx.fillRect(px, py + 4, TILE, 10); ctx.fillRect(px, py + 24, TILE, 8);
        ctx.fillStyle = "#5e4d3b"; ctx.fillRect(px, py + 14, TILE, 3); ctx.fillRect(px, py + 32, TILE, 3);
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(px, py + TILE - 5, TILE, 5);
        if (isTop()) { ctx.fillStyle = "#f4f8ff"; ctx.fillRect(px, py, TILE, 6); circle(px + 12, py + 6, 5, "#f4f8ff"); circle(px + 34, py + 5, 4, "#f4f8ff"); }
        return true;
      }
      if (t === T.TREE) {   /* pine trees, snowy at the top */
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(px + 21, py + 36, 6, 9);
        const tiers = [[24, 4, 10], [24, 14, 14], [24, 24, 18]];
        for (const [cx, ty, hw] of tiers) {
          ctx.fillStyle = "#1f5e3a"; ctx.beginPath(); ctx.moveTo(px + cx, py + ty); ctx.lineTo(px + cx + hw, py + ty + 14); ctx.lineTo(px + cx - hw, py + ty + 14); ctx.closePath(); ctx.fill();
          if (isTop()) { ctx.fillStyle = "#f4f8ff"; ctx.beginPath(); ctx.moveTo(px + cx, py + ty); ctx.lineTo(px + cx + hw * .5, py + ty + 6); ctx.lineTo(px + cx - hw * .5, py + ty + 6); ctx.closePath(); ctx.fill(); }
        }
        return true;
      }
    }
    if (zone === "cavern") {
      if (groundT) {
        ctx.fillStyle = (x + y) % 2 ? "#6e5a4c" : "#73604f"; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5;
        if (r < .4) { ctx.beginPath(); ctx.moveTo(px + 8 + r * 20, py + 10); ctx.lineTo(px + 18, py + 22); ctx.lineTo(px + 14, py + 34); ctx.stroke(); }
        if (r > .85) { circle(px + 34, py + 30, 3.5, "#e8b830"); circle(px + 33, py + 29, 1.4, "#fff3a0"); }   /* a coin in the dirt */
        return true;
      }
      if (wallT) {
        ctx.fillStyle = "#3d3028"; ctx.fillRect(px, py, TILE, TILE);
        circle(px + 14, py + 16, 12, "#4a3a30"); circle(px + 34, py + 30, 13, "#47382e");
        if (r < .3) {   /* glowing crystal flecks in the rock */
          const tw = .5 + Math.sin(now / 300 + r * 20) * .4;
          ctx.fillStyle = `rgba(124,255,107,${tw})`; ctx.fillRect(px + 10 + r * 60, py + 10 + r * 40, 4, 4);
        }
        ctx.fillStyle = "#2a201a";   /* a little stalactite */
        ctx.beginPath(); ctx.moveTo(px + 18, py + TILE - 2); ctx.lineTo(px + 24, py + TILE + 8); ctx.lineTo(px + 30, py + TILE - 2); ctx.closePath(); ctx.fill();
        return true;
      }
      if (t === T.WATER) {   /* glowing underground pool */
        ctx.fillStyle = "#145a6a"; ctx.fillRect(px, py, TILE, TILE);
        const sh = Math.sin(now / 500 + x + y) * 5;
        ctx.fillStyle = "rgba(90,255,230,.35)"; ctx.fillRect(px + 8 + sh, py + 16, 14, 3); ctx.fillRect(px + 24 - sh, py + 32, 12, 3);
        return true;
      }
    }
    if (zone === "gardens") {
      if (groundT) {
        ctx.fillStyle = (x + y) % 2 ? "#86c96a" : "#8fd072"; ctx.fillRect(px, py, TILE, TILE);
        if (r < .3) { const c = ["#ff8fc7", "#fff", "#ffd32a", "#b48cff"][Math.floor(r * 13) % 4];
          circle(px + 12 + r * 60, py + 14 + r * 40, 3, c); circle(px + 12 + r * 60, py + 14 + r * 40, 1.2, "#ffe066"); }
        else if (r < .6) { ctx.fillStyle = "#5fa846"; ctx.fillRect(px + 16 + r * 10, py + 30, 2, 6); ctx.fillRect(px + 21 + r * 10, py + 28, 2, 8); }
        else if (r > .95) { ctx.fillStyle = "#e84a3c"; ctx.beginPath(); ctx.arc(px + 24, py + 28, 7, Math.PI, 0); ctx.fill();   /* a little mushroom */
          ctx.fillStyle = "#fff"; ctx.fillRect(px + 22, py + 28, 4, 7); circle(px + 21, py + 24, 1.5, "#fff"); circle(px + 27, py + 25, 1.5, "#fff"); }
        return true;
      }
      if (wallT) {   /* tall trimmed hedges */
        ctx.fillStyle = "#2f6b2c"; ctx.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 6; k++) circle(px + 6 + (k % 3) * 18, py + 10 + Math.floor(k / 3) * 22, 9, k % 2 ? "#3a8236" : "#357a32");
        if (r < .25) circle(px + 30, py + 18, 3, "#ff6b81");
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(px, py + TILE - 5, TILE, 5);
        return true;
      }
      if (t === T.TREE) {   /* blossom trees */
        ctx.fillStyle = "#86c96a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#6e4a26"; ctx.fillRect(px + 21, py + 28, 6, 16);
        circle(px + 24, py + 18, 16, "#ff9fd0"); circle(px + 16, py + 22, 10, "#ffb8dc"); circle(px + 32, py + 14, 8, "#ffc6e4");
        return true;
      }
      if (t === T.WATER) {   /* lily-pad pond */
        ctx.fillStyle = "#3b9ad8"; ctx.fillRect(px, py, TILE, TILE);
        if (r < .6) { ctx.fillStyle = "#3f9c42"; ctx.beginPath(); ctx.arc(px + 18 + r * 20, py + 22, 8, .4, Math.PI * 2 - .2); ctx.lineTo(px + 18 + r * 20, py + 22); ctx.fill();
          if (r < .25) circle(px + 20 + r * 20, py + 20, 3, "#ff8fc7"); }
        return true;
      }
    }
    if (zone === "factory") {
      if (groundT) {   /* riveted metal plates */
        ctx.fillStyle = (x + y) % 2 ? "#9aa6ba" : "#a3aec1"; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "rgba(60,70,90,.35)"; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
        for (const [a, b] of [[5, 5], [43, 5], [5, 43], [43, 43]]) circle(px + a, py + b, 1.6, "#6a7588");
        if (r < .04) { for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? "#1a1a22" : "#ffd32a"; ctx.fillRect(px + 4 + k * 10, py + 20, 10, 8); } }
        return true;
      }
      if (wallT) {   /* machinery with spinning gears and pipes */
        ctx.fillStyle = "#4a5468"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5a6478"; ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        if (r < .35) {
          const a = now / 600 * (r < .17 ? 1 : -1), cx = px + 24, cy = py + 24;
          ctx.fillStyle = "#8a94a6";
          for (let k = 0; k < 8; k++) { const an = a + k * Math.PI / 4; ctx.fillRect(cx + Math.cos(an) * 13 - 3, cy + Math.sin(an) * 13 - 3, 6, 6); }
          circle(cx, cy, 12, "#8a94a6"); circle(cx, cy, 4, "#4a5468");
        } else { ctx.fillStyle = "#c0782a"; ctx.fillRect(px, py + 18, TILE, 7); ctx.fillStyle = "#e0a050"; ctx.fillRect(px, py + 18, TILE, 2); }
        return true;
      }
      if (t === T.CRYSTAL) {   /* crates of shapes */
        ctx.fillStyle = "#a3aec1"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#b8894a"; ctx.fillRect(px + 6, py + 12, 36, 30); ctx.strokeStyle = "#7a5a2b"; ctx.lineWidth = 2; ctx.strokeRect(px + 6, py + 12, 36, 30);
        ctx.fillStyle = "#ff4757"; ctx.fillRect(px + 10, py + 4, 10, 10);
        ctx.fillStyle = "#29d9ff"; ctx.beginPath(); ctx.moveTo(px + 30, py + 2); ctx.lineTo(px + 38, py + 14); ctx.lineTo(px + 22, py + 14); ctx.closePath(); ctx.fill();
        circle(px + 24, py + 28, 6, "#ffd32a");
        return true;
      }
      if (t === T.LAMP) {   /* spinning warning beacon */
        ctx.fillStyle = "#a3aec1"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#3a3a44"; ctx.fillRect(px + 20, py + 22, 8, 22);
        const on = Math.floor(now / 250) % 2;
        circle(px + 24, py + 18, 9, on ? "#ff8c00" : "#b85a00");
        if (on) { ctx.fillStyle = "rgba(255,140,0,.25)"; ctx.beginPath(); ctx.arc(px + 24, py + 18, 20, 0, 7); ctx.fill(); }
        return true;
      }
    }
    if (t === T.BELT_R || t === T.BELT_L) {   /* conveyor belt with moving chevrons */
      ctx.fillStyle = "#3a3f4a"; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#565d6b"; ctx.fillRect(px, py + 6, TILE, TILE - 12);
      const dir = t === T.BELT_R ? 1 : -1, off = ((now / 25) % 16) * dir;
      ctx.strokeStyle = "#ffd32a"; ctx.lineWidth = 3;
      for (let k = -1; k < 4; k++) {
        const cx = px + ((k * 16 + off) % 64 + 64) % 64 - 8;
        if (cx < px - 4 || cx > px + TILE - 4) continue;
        ctx.beginPath(); ctx.moveTo(cx - 3 * dir, py + 14); ctx.lineTo(cx + 4 * dir, py + 24); ctx.lineTo(cx - 3 * dir, py + 34); ctx.stroke();
      }
      ctx.fillStyle = "#22262e"; ctx.fillRect(px, py + 4, TILE, 3); ctx.fillRect(px, py + TILE - 7, TILE, 3);
      return true;
    }
    if (zone === "tower") {
      if (groundT) {   /* dark stone tiles */
        ctx.fillStyle = (x + y) % 2 ? "#5c5c7a" : "#66668a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "rgba(20,20,40,.35)"; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
        if (r < .15) { ctx.strokeStyle = "rgba(20,20,40,.4)"; ctx.beginPath(); ctx.moveTo(px + 10, py + 30); ctx.lineTo(px + 20, py + 24); ctx.lineTo(px + 26, py + 34); ctx.stroke(); }
        return true;
      }
      if (wallT) {   /* castle bricks; windows on the outer wall flash with lightning */
        ctx.fillStyle = "#2b2b44"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#3a3a5a";
        for (let row = 0; row < 4; row++) for (let k = -1; k < 3; k++) ctx.fillRect(px + k * 20 + (row % 2) * 10 + 1, py + row * 12 + 1, 18, 10);
        if (y === 0 && x % 3 === 1) {
          ctx.fillStyle = flash > 0 ? "#f0f4ff" : "#1a1a33";
          ctx.beginPath(); ctx.moveTo(px + 14, py + 40); ctx.lineTo(px + 14, py + 16); ctx.arc(px + 24, py + 16, 10, Math.PI, 0); ctx.lineTo(px + 34, py + 40); ctx.fill();
          ctx.fillStyle = "#2b2b44"; ctx.fillRect(px + 23, py + 8, 2, 32);
        }
        return true;
      }
      if (t === T.LAMP) {   /* flickering wall torch */
        ctx.fillStyle = (x + y) % 2 ? "#5c5c7a" : "#66668a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#4a3020"; ctx.fillRect(px + 21, py + 22, 6, 22);
        const f = Math.sin(now / 70 + x * 3) * 2 + Math.sin(now / 43 + y) * 1.5;
        ctx.fillStyle = "rgba(255,150,40,.25)"; ctx.beginPath(); ctx.arc(px + 24, py + 16, 18 + f, 0, 7); ctx.fill();
        ctx.fillStyle = "#ff8c1a"; ctx.beginPath(); ctx.ellipse(px + 24, py + 15, 6, 10 + f, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(px + 24, py + 18, 3, 5, 0, 0, 7); ctx.fill();
        return true;
      }
    }
    if (zone === "sky") {
      if (groundT) {   /* soft cloud ground */
        ctx.fillStyle = (x + y) % 2 ? "#eef6ff" : "#e6f1fd"; ctx.fillRect(px, py, TILE, TILE);
        if (r < .3) cloudPuff(px + 14 + r * 60, py + 28, 9 + r * 10, "#ffffff", "rgba(150,190,230,.3)");
        if (r < .12) { const tw = (Math.sin(now / 200 + r * 50) + 1) / 2; ctx.fillStyle = `rgba(255,230,120,${tw})`; ctx.fillRect(px + 34, py + 10, 2, 6); ctx.fillRect(px + 32, py + 12, 6, 2); }
        return true;
      }
      if (wallT) {   /* the edge of the cloud: open sky below */
        const sky = ctx.createLinearGradient(0, py, 0, py + TILE);
        sky.addColorStop(0, "#6fb6ff"); sky.addColorStop(1, "#a8d4ff");
        ctx.fillStyle = sky; ctx.fillRect(px, py, TILE, TILE);
        const drift = Math.sin(now / 1500 + x) * 4;
        if (r < .5) cloudPuff(px + 24 + drift, py + 24, 9, "rgba(255,255,255,.75)");
        return true;
      }
      if (t === T.BUSH) {   /* a fluffy cloud lump */
        ctx.fillStyle = (x + y) % 2 ? "#eef6ff" : "#e6f1fd"; ctx.fillRect(px, py, TILE, TILE);
        cloudPuff(px + 24, py + 26, 18, "#ffffff", "rgba(130,170,220,.45)");
        return true;
      }
    }
    if (zone === "city") {
      if (t === T.ROAD) {
        ctx.fillStyle = "#8a8a96"; ctx.fillRect(px, py, TILE, TILE);
        const gr = screen().grid, open = (xx, yy) => !SOLID.has(gr[yy][xx]);
        const nearNS = (x === 7 || x === 8) && ((y === 1 && open(x, 0)) || (y === 9 && open(x, ROWS - 1)));
        const nearEW = (y === 4 || y === 5) && ((x === 1 && open(0, y)) || (x === 14 && open(COLS - 1, y)));
        if (nearNS || nearEW) {   /* zebra crossings at every street entrance */
          ctx.fillStyle = "#f2f2f2";
          for (let k = 0; k < 4; k++) nearNS ? ctx.fillRect(px + 3 + k * 12, py + 6, 7, TILE - 12) : ctx.fillRect(px + 6, py + 3 + k * 12, TILE - 12, 7);
        } else if (r < .06) {   /* a manhole cover */
          circle(px + 24, py + 24, 11, "#6a6a76"); ctx.strokeStyle = "#55555f"; ctx.lineWidth = 2;
          for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(px + 16, py + 24 + k * 5); ctx.lineTo(px + 32, py + 24 + k * 5); ctx.stroke(); }
        } else {
          ctx.fillStyle = "rgba(255,255,255,.15)";
          ctx.fillRect(px + 6, py + TILE/2 - 2, 12, 4); ctx.fillRect(px + 30, py + TILE/2 - 2, 12, 4);
        }
        return true;
      }
      if (t === T.LAMP) {   /* traffic lights cycling red / yellow / green */
        ctx.fillStyle = "#8a8a96"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#3a3a44"; ctx.fillRect(px + 22, py + 26, 4, 20);
        ctx.fillStyle = "#22222a"; ctx.fillRect(px + 16, py + 2, 16, 28);
        const phase = Math.floor((now / 1000 + x * 1.7 + y) % 6);
        const lit = phase < 3 ? 2 : phase < 5 ? 0 : 1;
        ["#ff4757", "#ffd32a", "#2ed573"].forEach((c, k) => circle(px + 24, py + 8 + k * 8, 3.2, k === lit ? c : "#444450"));
        return true;
      }
    }
    if (zone === "base" && state.key === "0,-1" && t === T.WATER) {   /* Wishing Lake sparkles */
      ctx.fillStyle = "#2f7fd6"; ctx.fillRect(px, py, TILE, TILE);
      const sh = Math.sin(now / 600 + x * 1.3 + y * .7) * 6;
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(px + 8 + sh, py + 14, 14, 3); ctx.fillRect(px + 24 - sh, py + 32, 14, 3);
      if (r < .2) { const tw = (Math.sin(now / 180 + r * 40) + 1) / 2; ctx.fillStyle = `rgba(255,240,150,${tw})`; ctx.fillRect(px + 30, py + 8, 2, 7); ctx.fillRect(px + 27, py + 10, 8, 2); }
      return true;
    }
    return false;
  }

  /* ground details drawn over the tiles: mine rails, red carpet, count-by-10 trail markers, a rainbow */
  function sceneDecor(s) {
    if (!s.themeDeco) {
      const d = s.themeDeco = { rails: [], carpet: [], marks: [] };
      const walk = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !SOLID.has(s.grid[y][x]);
      if (s.zone === "cavern") for (let x = 0; x < COLS; x++) if (walk(x, 5) && s.grid[5][x] === T.CAVE_FLOOR) d.rails.push([x, 5]);
      if (s.zone === "tower") {
        for (let x = 0; x < COLS; x++) for (const y of [4, 5]) if (walk(x, y)) d.carpet.push([x, y]);
        for (let y = 0; y < ROWS; y++) for (const x of [7, 8]) if (walk(x, y) && y !== 4 && y !== 5) d.carpet.push([x, y]);
      }
      if (s.zone === "ridge") {
        const base = state.key === "4,0" ? 10 : 60;
        let n = 0;
        for (let x = 2; x < COLS - 1 && n < 5; x += 3) {
          const y = [4, 5, 3, 6].find(yy => walk(x, yy) && !(s.pickups || []).some(p => p.x === x && p.y === yy));
          if (y !== undefined) d.marks.push([x, y, base + 10 * n++]);
        }
      }
    }
    const d = s.themeDeco;
    for (const [x, y] of d.rails) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#5a4030"; for (let k = 0; k < 4; k++) ctx.fillRect(px + 2 + k * 12, py + 14, 6, 22);
      ctx.fillStyle = "#9aa0ad"; ctx.fillRect(px, py + 17, TILE, 3); ctx.fillRect(px, py + 30, TILE, 3);
    }
    for (const [x, y] of d.carpet) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "rgba(160,20,40,.55)"; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(255,211,42,.35)";
      if (y === 4 || y === 5) ctx.fillRect(px, py + (y === 4 ? 2 : TILE - 4), TILE, 2);
      else ctx.fillRect(px + (x === 7 ? 2 : TILE - 4), py, 2, TILE);
    }
    for (const [x, y, n] of d.marks) {   /* little stone trail posts: count by 10s up the mountain */
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#6e6e78"; ctx.fillRect(px + 30, py + 6, 16, 18);
      ctx.fillStyle = "#8a8a95"; ctx.fillRect(px + 30, py + 6, 16, 4);
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(n, px + 38, py + 20); ctx.textAlign = "start";
    }
    if (s.zone === "sky" && state.key === "0,-2") {   /* a big soft rainbow over the isles */
      const cols = ["#ff4757", "#ff9f1a", "#ffd32a", "#2ed573", "#29a0ff", "#a55eea"];
      ctx.globalAlpha = .28;
      cols.forEach((c, k) => { ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(11 * TILE, 7 * TILE, 4.6 * TILE - k * 7, Math.PI, 0); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
  }

  /* the Clock Tower shows the REAL time right now */
  function drawClockTower(b) {
    const px = b.x * TILE, py = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    ctx.fillStyle = "#e9e2f5"; ctx.fillRect(px + 8, py - 18, w - 16, h + 18);
    ctx.fillStyle = "#b8a8d8"; ctx.fillRect(px + 8, py + h - 10, w - 16, 10);
    ctx.fillStyle = "#7d5cc0"; ctx.beginPath(); ctx.moveTo(px + 2, py - 16); ctx.lineTo(px + w / 2, py - 40); ctx.lineTo(px + w - 2, py - 16); ctx.closePath(); ctx.fill();
    const cx = px + w / 2, cy = py + 30, d = new Date(), hr = d.getHours() % 12, mn = d.getMinutes();
    circle(cx, cy, 26, "#2b1a10"); circle(cx, cy, 23, "#fffdf0");
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.fillStyle = "#2b1a10"; ctx.fillRect(cx + Math.sin(a) * 19 - 1.5, cy - Math.cos(a) * 19 - 1.5, 3, 3); }
    const hand = (len, ang, wdt, c) => { ctx.strokeStyle = c; ctx.lineWidth = wdt; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke(); ctx.lineCap = "butt"; };
    hand(17, mn * Math.PI / 30, 3, "#2c6de8");
    hand(11, (hr + mn / 60) * Math.PI / 6, 5, "#e8453c");
    circle(cx, cy, 2.5, "#2b1a10");
    ctx.fillStyle = "#6e4a26"; ctx.fillRect(cx - 10, py + h - 30, 20, 20);   /* the (locked) door */
  }

  /* weather and light: cave darkness, tower lightning, mountain snow, sky wind */
  let flash = 0, nextFlash = 0, dark = null;
  function drawWeather(s) {
    const now = performance.now();
    if (s.zone === "tower" && !s.label) {
      if (now > nextFlash) { flash = 9; nextFlash = now + 5000 + Math.random() * 6000; if (Math.random() < .7) Sound.play("thunder"); }
      if (flash > 0) { ctx.fillStyle = `rgba(230,235,255,${flash / 30})`; ctx.fillRect(0, 0, canvas.width, canvas.height); flash--; }
    }
    if (s.zone === "cavern" && !s.label) {   /* it's DARK down here: only your light shows the way */
      dark = dark || document.createElement("canvas");
      if (dark.width !== canvas.width || dark.height !== canvas.height) { dark.width = canvas.width; dark.height = canvas.height; }
      const d = dark.getContext("2d");
      d.globalCompositeOperation = "source-over";
      d.fillStyle = "rgba(8,5,20,.8)"; d.fillRect(0, 0, dark.width, dark.height);
      d.globalCompositeOperation = "destination-out";
      const hole = (x, y, rad) => { const gr = d.createRadialGradient(x, y, rad * .25, x, y, rad);
        gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = gr; d.beginPath(); d.arc(x, y, rad, 0, 7); d.fill(); };
      hole(state.px + 24, state.py + 20, 150 + Math.sin(now / 400) * 6);
      if (companionFollowing()) hole(state.comp.px + 24, state.comp.py + 20, 90);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
        if (s.grid[y][x] === T.CRYSTAL || s.grid[y][x] === T.CHEST) hole(x * TILE + 24, y * TILE + 24, 60);
      for (const e of s.enemies) if (e.boss && !e.defeated) hole(e.x * TILE + 24, e.y * TILE + 20, 70);
      ctx.drawImage(dark, 0, 0);
      for (const e of s.enemies) if (!e.defeated && (e.type === "glowbat" || e.type === "molebot")) {   /* glowing eyes in the dark */
        const tw = .6 + Math.sin(now / 250 + e.x) * .3;
        ctx.fillStyle = e.type === "glowbat" ? `rgba(124,255,107,${tw})` : `rgba(41,217,255,${tw})`;
        ctx.fillRect(e.x * TILE + 17, e.y * TILE + 25, 4, 3); ctx.fillRect(e.x * TILE + 29, e.y * TILE + 25, 4, 3);
      }
    }
    if (s.zone === "ridge" && isTop()) {   /* snow */
      weather.length || (weather.push(...Array.from({ length: 40 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, v: .5 + Math.random() * .8, s: 1.5 + Math.random() * 2 }))));
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const f of weather) { f.y += f.v; f.x += Math.sin(now / 900 + f.v * 9) * .4; if (f.y > canvas.height) { f.y = -4; f.x = Math.random() * canvas.width; } ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, 7); ctx.fill(); }
    }
    if (s.zone === "sky") {   /* wind streaks */
      weather.length || (weather.push(...Array.from({ length: 10 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, v: 2 + Math.random() * 2, s: 30 + Math.random() * 40 }))));
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2;
      for (const f of weather) { f.x += f.v; if (f.x > canvas.width + 60) { f.x = -80; f.y = Math.random() * canvas.height; } ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + f.s / 2, f.y - 4, f.x + f.s, f.y); ctx.stroke(); }
    }
  }
  const weather = [];

  /* conveyor belts: standing still on one slides you along */
  function beltPush() {
    const [hx, hy] = heroTile(), t = tileAt(hx, hy);
    if (t !== T.BELT_R && t !== T.BELT_L) return false;
    const nx = hx + (t === T.BELT_R ? 1 : -1);
    if (nx < 1 || nx > COLS - 2 || !heroPassable(nx, hy) || tileAt(nx, hy) === T.WATER || enemyAt(nx, hy) !== -1) return false;
    if (critters().some(c => c.x === nx && c.y === hy)) return false;
    state.moving = true; state.targetX = nx * TILE; state.targetY = hy * TILE;
    state.comp.x = hx; state.comp.y = hy;
    return true;
  }

  function drawTile(t, x, y, zone) {
    const zc = ZONES[zone];
    const px = x * TILE, py = y * TILE;
    if (drawThemed(t, x, y, zone, px, py)) return;
    switch (t) {
      case T.FLOOR: case T.CAVE_FLOOR: case T.TOWER_FLOOR:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        if ((x + y) % 2 === 0) { ctx.fillStyle = "rgba(0,0,0,.04)"; ctx.fillRect(px, py, TILE, TILE); }
        break;
      case T.ROAD:
        ctx.fillStyle = "#8a8a96"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,.15)";
        ctx.fillRect(px + 6, py + TILE/2 - 2, 12, 4); ctx.fillRect(px + 30, py + TILE/2 - 2, 12, 4);
        break;
      case T.WALL: case T.CAVE_WALL: case T.TOWER_WALL:
        ctx.fillStyle = zc.wall; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,.09)"; ctx.fillRect(px, py, TILE, 6);
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(px, py + TILE - 6, TILE, 6);
        break;
      case T.TREE:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(px + 20, py + 28, 8, 16);
        ctx.fillStyle = "#2f7d32"; ctx.beginPath(); ctx.arc(px + 24, py + 18, 16, 0, 7); ctx.fill();
        ctx.fillStyle = "#3f9c42"; ctx.beginPath(); ctx.arc(px + 18, py + 22, 10, 0, 7); ctx.fill();
        break;
      case T.WATER: {
        ctx.fillStyle = "#2f7fd6"; ctx.fillRect(px, py, TILE, TILE);
        const t = performance.now() / 600;
        const shift = Math.sin(t + x * 1.3 + y * 0.7) * 6;
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(px + 8 + shift, py + 14, 14, 3);
        ctx.fillRect(px + 24 - shift, py + 32, 14, 3);
        break;
      }
      case T.ROCK: {
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#6d6d78"; ctx.beginPath(); ctx.arc(px + 24, py + 27, 18, 0, 7); ctx.fill();
        ctx.fillStyle = "#8a8a95"; ctx.beginPath(); ctx.arc(px + 20, py + 22, 10, 0, 7); ctx.fill();
        ctx.strokeStyle = "#4d4d58"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 16, py + 34); ctx.lineTo(px + 24, py + 26);
        ctx.lineTo(px + 22, py + 18); ctx.stroke();
        const gp = Main.getGame();
        if (gp.powers && gp.powers.strength) {   /* smashable sparkle! */
          const tw = (Math.sin(performance.now() / 220 + x * 2) + 1) / 2;
          ctx.fillStyle = `rgba(255,211,42,${.4 + tw * .6})`;
          ctx.font = "16px sans-serif";
          ctx.fillText("💪", px + 28, py + 16);
        }
        break;
      }
      case T.BUILDING:
        ctx.fillStyle = "#5b6a94"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#ffd97a";
        ctx.fillRect(px + 8, py + 10, 10, 10); ctx.fillRect(px + 28, py + 10, 10, 10);
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(px, py + TILE - 8, TILE, 8);
        break;
      case T.DOOR_WORKSHOP:
        ctx.fillStyle = "#5b6a94"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#8a4b23"; ctx.fillRect(px + 10, py + 10, 28, 38);
        ctx.fillStyle = "#ffd32a"; ctx.font = "20px sans-serif";
        ctx.fillText("🔧", px + 13, py + 34);
        break;
      case T.SIGN:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(px + 21, py + 26, 6, 16);
        ctx.fillStyle = "#c98d4b"; ctx.fillRect(px + 8, py + 10, 32, 18);
        ctx.fillStyle = "#5a3a1e";
        ctx.fillRect(px + 12, py + 15, 24, 2); ctx.fillRect(px + 12, py + 21, 24, 2);
        break;
      case T.STATION: {
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        const st = stationAt(state.key, x, y);
        const g = Main.getGame();
        const earned = st && hasBadge(g, st.id);
        const open = st && stationUnlocked(g, st);
        /* gold = earned, glowing purple = needed NOW, grey + lock = later */
        ctx.fillStyle = earned ? "#ffd32a" : open ? "#a55eea" : "#7c7f8a";
        ctx.fillRect(px + 5, py + 6, 38, 36);
        ctx.fillStyle = earned ? "#b88a00" : open ? "#6e3bb0" : "#555863";
        ctx.fillRect(px + 5, py + 36, 38, 6);
        ctx.fillStyle = open ? "#fff" : "#c9cbd1"; ctx.fillRect(px + 9, py + 10, 30, 24);
        ctx.font = (st && st.icon.length > 2 ? "13px" : "18px") + " sans-serif";
        ctx.textAlign = "center";
        if (!open) ctx.globalAlpha = .35;
        ctx.fillText(st ? st.icon : "?", px + 24, py + 29);
        ctx.globalAlpha = 1;
        if (earned) { ctx.font = "16px sans-serif"; ctx.fillText("🏅", px + 40, py + 14); }
        else if (!open) { ctx.font = "18px sans-serif"; ctx.fillText("🔒", px + 24, py + 30); }
        else {   /* thick flashing orange frame (halo + sparkles are drawn in drawStationGlow) */
          const a = .6 + (Math.sin(performance.now() / 160) + 1) / 2 * .4;
          ctx.strokeStyle = `rgba(255,120,0,${a})`; ctx.lineWidth = 5;
          ctx.strokeRect(px + 3, py + 4, 42, 40);
        }
        ctx.textAlign = "start";
        break;
      }
      case T.FLOWERS:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ["#ff6b81", "#ffd32a", "#fff"].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(px + 12 + i * 12, py + 18 + (i % 2) * 14, 4, 0, 7); ctx.fill();
        });
        break;
      case T.LAMP: {
        ctx.fillStyle = (zone === "city") ? "#8a8a96" : zc.floor;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#3a3a44"; ctx.fillRect(px + 21, py + 14, 6, 30);
        const glow = .55 + Math.sin(performance.now() / 300 + x * 2 + y) * .2;
        ctx.fillStyle = zone === "tower" ? `rgba(165,94,234,${glow})` : `rgba(255,220,110,${glow})`;
        ctx.beginPath(); ctx.arc(px + 24, py + 12, 9, 0, 7); ctx.fill();
        ctx.fillStyle = zone === "tower" ? "#d9b3ff" : "#fff3c4";
        ctx.beginPath(); ctx.arc(px + 24, py + 12, 4, 0, 7); ctx.fill();
        break;
      }
      case T.CRYSTAL: {
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        const tw = .6 + Math.sin(performance.now() / 250 + x * 3 + y * 2) * .35;
        ctx.fillStyle = `rgba(41,217,255,${tw})`;
        ctx.beginPath();
        ctx.moveTo(px + 24, py + 8); ctx.lineTo(px + 36, py + 28);
        ctx.lineTo(px + 24, py + 44); ctx.lineTo(px + 12, py + 28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fillRect(px + 21, py + 16, 4, 10);
        break;
      }
      case T.BUSH:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#2f7d32";
        ctx.beginPath(); ctx.arc(px + 16, py + 30, 11, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 30, py + 30, 11, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 23, py + 22, 11, 0, 7); ctx.fill();
        ctx.fillStyle = "#ff6b81";
        ctx.beginPath(); ctx.arc(px + 17, py + 25, 2.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 29, py + 27, 2.5, 0, 7); ctx.fill();
        break;
      case T.BENCH:
        ctx.fillStyle = zc.floor; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#8a5a2b";
        ctx.fillRect(px + 4, py + 20, 40, 8);
        ctx.fillRect(px + 4, py + 10, 40, 6);
        ctx.fillRect(px + 6, py + 28, 5, 12); ctx.fillRect(px + 37, py + 28, 5, 12);
        break;
      case T.IN_FLOOR: {
        const st = screen().style || {};
        const f1 = st.floor || "#c9a06a", f2 = st.floor2 || f1;
        switch (st.pattern) {
          case "planks":   /* long wooden boards */
            ctx.fillStyle = f1; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = f2;
            for (let k = 0; k < 4; k++) ctx.fillRect(px, py + k * 12 + 10, TILE, 2);
            ctx.fillRect(px + ((y * 17) % 40), py + 2, 2, 10); ctx.fillRect(px + ((y * 29 + 20) % 40), py + 26, 2, 10);
            break;
          case "tiles":    /* small square tiles */
            ctx.fillStyle = f1; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = f2; ctx.fillRect(px, py, TILE / 2, TILE / 2); ctx.fillRect(px + TILE / 2, py + TILE / 2, TILE / 2, TILE / 2);
            ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
            break;
          case "carpet":   /* soft carpet with little dots */
            ctx.fillStyle = f1; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = f2;
            for (let k = 0; k < 4; k++) ctx.fillRect(px + 8 + (k % 2) * 24 + ((y % 2) * 12), py + 10 + Math.floor(k / 2) * 24, 4, 4);
            break;
          case "stripes":  /* factory floor */
            ctx.fillStyle = f1; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = f2; ctx.fillRect(px, py, TILE / 4, TILE); ctx.fillRect(px + TILE / 2, py, TILE / 4, TILE);
            break;
          default:         /* checkerboard */
            ctx.fillStyle = (x + y) % 2 === 0 ? f1 : f2; ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = "rgba(0,0,0,.07)"; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        }
        if (st.deco === "oil" && (x * 7 + y * 13) % 11 === 0) {
          ctx.fillStyle = "rgba(30,30,40,.35)";
          ctx.beginPath(); ctx.ellipse(px + 24, py + 26, 13, 8, .5, 0, 7); ctx.fill();
        }
        if (st.deco === "sprinkle" && (x * 5 + y * 7) % 4 === 0) {
          ["#ff6b81","#29d9ff","#ffd32a"].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(px + 8 + i * 12 + ((x + y) % 3) * 3, py + 10 + ((x * y + i) % 22), 6, 3);
          });
        }
        break;
      }
      case T.IN_WALL: {
        const st = screen().style || {};
        ctx.fillStyle = st.wall || "#6e4a26"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(px, py, TILE, 6);
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(px, py + TILE - 6, TILE, 6);
        /* colored trim where the wall meets the floor */
        const below = y + 1 < ROWS ? screen().grid[y + 1][x] : null;
        if (st.trim && below !== null && below !== T.IN_WALL && below !== T.VOID) {
          ctx.fillStyle = st.trim; ctx.fillRect(px, py + TILE - 8, TILE, 4);
        }
        break;
      }
      case T.VOID: {
        ctx.fillStyle = "#0b0e22"; ctx.fillRect(px, py, TILE, TILE);
        if ((x * 7 + y * 11) % 5 === 0) { ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(px + (x * 13) % 40, py + (y * 17) % 40, 2, 2); }
        break;
      }
      case T.SHELF:
        ctx.fillStyle = "#c9a06a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(px + 3, py + 6, TILE - 6, TILE - 12);
        ["#ff6b81","#29d9ff","#ffd32a","#2ed573"].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(px + 7 + i * 9, py + 12, 7, 12);
        });
        ctx.fillStyle = "#6e4a26"; ctx.fillRect(px + 3, py + 27, TILE - 6, 4);
        break;
      case T.BED: {
        const st2 = screen().style || {};
        ctx.fillStyle = ((x + y) % 2 === 0 ? st2.floor : st2.floor2) || "#c9a06a";
        ctx.fillRect(px, py, TILE, TILE);
        /* headboard */
        ctx.fillStyle = "#6e4a26"; ctx.fillRect(px + 4, py + 2, 40, 10);
        ctx.fillStyle = "#8a5f34"; ctx.fillRect(px + 6, py + 4, 36, 6);
        /* mattress + pillow */
        ctx.fillStyle = "#f2ede4"; ctx.fillRect(px + 6, py + 10, 36, 34);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(px + 10, py + 12, 28, 9);
        ctx.strokeStyle = "#d8d2c4"; ctx.lineWidth = 2; ctx.strokeRect(px + 10, py + 12, 28, 9);
        /* striped blanket */
        ctx.fillStyle = "#e84a60"; ctx.fillRect(px + 6, py + 23, 36, 21);
        ctx.fillStyle = "#ff8fa3";
        ctx.fillRect(px + 6, py + 27, 36, 4); ctx.fillRect(px + 6, py + 35, 36, 4);
        /* fold + feet */
        ctx.fillStyle = "#ffffff"; ctx.fillRect(px + 6, py + 23, 36, 3);
        ctx.fillStyle = "#5a3a1e";
        ctx.fillRect(px + 6, py + 44, 5, 3); ctx.fillRect(px + 37, py + 44, 5, 3);
        break;
      }
      case T.TV: {
        const st2 = screen().style || {};
        ctx.fillStyle = ((x + y) % 2 === 0 ? st2.floor : st2.floor2) || "#c9a06a";
        ctx.fillRect(px, py, TILE, TILE);
        /* stand + cabinet */
        ctx.fillStyle = "#6e4a26"; ctx.fillRect(px + 6, py + 36, 36, 8);
        ctx.fillStyle = "#5a3a1e"; ctx.fillRect(px + 20, py + 32, 8, 6);
        /* frame */
        ctx.fillStyle = "#1a1a22"; ctx.fillRect(px + 4, py + 6, 40, 27);
        /* animated cartoon screen */
        const ph = Math.floor(performance.now() / 700 + x) % 3;
        const scr = ["#29d9ff", "#ffd32a", "#ff8fa3"][ph];
        ctx.fillStyle = scr; ctx.fillRect(px + 7, py + 9, 34, 21);
        ctx.fillStyle = "rgba(255,255,255,.85)";
        if (ph === 0) { ctx.fillRect(px + 14, py + 14, 8, 8); ctx.fillRect(px + 26, py + 14, 8, 8); }
        if (ph === 1) { ctx.beginPath(); ctx.arc(px + 24, py + 19, 6, 0, 7); ctx.fill(); }
        if (ph === 2) { ctx.fillRect(px + 12, py + 18, 24, 4); }
        ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(px + 7, py + 9, 10, 21);
        break;
      }
      case T.COUNTER:
        ctx.fillStyle = "#c9a06a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#9a6a35"; ctx.fillRect(px + 2, py + 12, TILE - 4, TILE - 20);
        ctx.fillStyle = "#b8895a"; ctx.fillRect(px + 2, py + 12, TILE - 4, 8);
        break;
      case T.GATE: {
        ctx.fillStyle = zc.wall; ctx.fillRect(px, py, TILE, TILE);
        const gz = GATE_AT[state.key + ":" + x + "," + y];
        const badgeWait = gz && bossDone(Main.getGame(), gz);   /* boss done: only badges left */
        const a = .5 + Math.sin(performance.now() / 200 + x) * .3;
        ctx.fillStyle = badgeWait ? `rgba(165,94,234,${a})` : `rgba(255,71,87,${a})`;
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 6 + i * 11, py + 4, 5, TILE - 8);
        if (badgeWait) { ctx.fillStyle = "rgba(255,211,42,.9)"; ctx.fillRect(px + 4, py + 18, 40, 6); }
        ctx.fillStyle = "rgba(255,255,255,.8)";
        ctx.font = "16px sans-serif"; ctx.fillText(badgeWait ? "🏅" : "🔒", px + 15, py + 30);
        break;
      }
      case T.TROPHY: {
        const st2 = screen().style || {};
        ctx.fillStyle = st2.wall || "#6e4a26"; ctx.fillRect(px, py, TILE, TILE);
        /* wooden cabinet with a glass front */
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(px, py + 2, TILE, TILE - 2);
        ctx.fillStyle = "rgba(170,225,255,.55)"; ctx.fillRect(px + 3, py + 5, TILE - 6, TILE - 12);
        ctx.fillStyle = "#6e4a26"; ctx.fillRect(px, py + TILE - 8, TILE, 8);
        const g = Main.getGame();
        ctx.textAlign = "center";
        for (let k = 0; k < 2; k++) {
          const st = STATIONS[(x - TROPHY_CASE_X) * 2 + k];
          if (!st) continue;
          const cx = px + 13 + k * 22, cy = py + 30;
          ctx.fillStyle = "#c9a24a"; ctx.fillRect(cx - 7, cy + 2, 14, 4);   /* little pedestal */
          if (hasBadge(g, st.id)) {
            ctx.font = "17px sans-serif";
            ctx.fillText(TROPHIES[st.id].icon, cx, cy);
            const tw = (Math.sin(performance.now() / 250 + x * 3 + k) + 1) / 2;
            ctx.fillStyle = `rgba(255,255,255,${tw})`;
            ctx.fillRect(cx + 5, cy - 16, 2, 6); ctx.fillRect(cx + 3, cy - 14, 6, 2);
          } else {
            ctx.font = "bold 13px sans-serif"; ctx.fillStyle = "rgba(60,60,80,.55)";
            ctx.fillText("?", cx, cy - 2);
          }
        }
        ctx.textAlign = "start";
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(px + 5, py + 7, 4, 18);   /* glass shine */
        break;
      }
      case T.BOSS_CASE: {
        const st2 = screen().style || {};
        ctx.fillStyle = st2.wall || "#6e4a26"; ctx.fillRect(px, py, TILE, TILE);
        /* dark cabinet with a red-velvet back: the bosses' corner */
        ctx.fillStyle = "#4a2a14"; ctx.fillRect(px, py + 2, TILE, TILE - 2);
        ctx.fillStyle = "rgba(200,40,70,.55)"; ctx.fillRect(px + 3, py + 5, TILE - 6, TILE - 12);
        ctx.fillStyle = "#ffd32a"; ctx.fillRect(px, py + TILE - 8, TILE, 3);
        ctx.fillStyle = "#3a1e0c"; ctx.fillRect(px, py + TILE - 5, TILE, 5);
        const g = Main.getGame(), ids = Object.keys(BOSS_TROPHIES);
        ctx.textAlign = "center";
        for (let k = 0; k < 2; k++) {
          const id = ids[(x - BOSS_CASE_X) * 2 + k];
          if (!id) continue;
          const cx = px + 13 + k * 22, cy = py + 30;
          ctx.fillStyle = "#c9a24a"; ctx.fillRect(cx - 7, cy + 2, 14, 4);
          if (g.progress && g.progress[id]) {
            ctx.font = "17px sans-serif";
            ctx.fillText(BOSS_TROPHIES[id].icon, cx, cy);
            const tw = (Math.sin(performance.now() / 250 + x * 5 + k) + 1) / 2;
            ctx.fillStyle = `rgba(255,255,255,${tw})`;
            ctx.fillRect(cx + 5, cy - 16, 2, 6); ctx.fillRect(cx + 3, cy - 14, 6, 2);
          } else {
            ctx.font = "bold 13px sans-serif"; ctx.fillStyle = "rgba(255,220,220,.5)";
            ctx.fillText("?", cx, cy - 2);
          }
        }
        ctx.textAlign = "start";
        break;
      }
      case T.DECOR: {
        const st2 = screen().style || {};
        ctx.fillStyle = ((x + y) % 2 === 0 ? st2.floor : st2.floor2) || "#c9a06a";
        ctx.fillRect(px, py, TILE, TILE);
        const id = screen().decorMap ? screen().decorMap[x + "," + y]
                                     : ((Main.getGame().decor || {}).placed || {})[x + "," + y];
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.beginPath(); ctx.ellipse(px + 24, py + 41, 17, 5, 0, 0, 7); ctx.fill();
        if (id && DECOR[id]) {
          ctx.fillStyle = "#000";   /* emoji take the fill's transparency, so use a solid one */
          ctx.textAlign = "center"; ctx.font = "34px sans-serif";
          ctx.fillText(DECOR[id].icon, px + 24, py + 38);
          ctx.textAlign = "start";
        }
        break;
      }
      case T.CHEST: {
        const st2 = screen().style;
        ctx.fillStyle = st2 ? (((x + y) % 2 === 0 ? st2.floor : st2.floor2) || "#c9a06a")
                            : (screen().zone === "city" ? "#8a8a96" : zc.floor);
        ctx.fillRect(px, py, TILE, TILE);
        const g = Main.getGame();
        const open = g.opened && g.opened[state.key + ":" + x + "," + y];
        drawChestBody(px, py, open);
        break;
      }
      case T.PUZZLE_DOOR: {
        const st2 = screen().style || {};
        ctx.fillStyle = st2.wall || "#6e4a26"; ctx.fillRect(px, py, TILE, TILE);
        const a = .6 + Math.sin(performance.now() / 250) * .3;
        ctx.fillStyle = `rgba(165,94,234,${a})`; ctx.fillRect(px + 4, py + 2, 40, 44);
        ctx.strokeStyle = "#ffd32a"; ctx.lineWidth = 3; ctx.strokeRect(px + 5, py + 3, 38, 42);
        ctx.font = "22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🧩", px + 24, py + 32); ctx.textAlign = "start";
        break;
      }
      case T.BIKE: {
        drawTile(T.IN_FLOOR, x, y, zone);
        if (screen().grid[y][x - 1] === T.BIKE) drawBike(px - TILE, py);   /* drawn once, across both tiles */
        break;
      }
      case T.PAINT: {
        drawTile(T.IN_FLOOR, x, y, zone);
        if (screen().grid[y][x + 1] === T.PAINT) {   /* spray booth */
          ctx.fillStyle = "#e0e4ec"; ctx.fillRect(px + 4, py + 2, 40, 42);
          ctx.fillStyle = "#3d4f6a"; ctx.fillRect(px + 4, py + 2, 40, 6);
          ["#ff4757", "#29d9ff", "#ffd32a", "#2ed573"].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(px + 8 + i * 9, py + 14, 6, 22); });
          ctx.font = "16px sans-serif"; ctx.fillText("🎨", px + 14, py + 44);
        } else {                                       /* paint cans */
          [["#ff4757", 6], ["#29d9ff", 20], ["#ffd32a", 34]].forEach(([c, ox]) => {
            ctx.fillStyle = "#9aa0ad"; ctx.fillRect(px + ox, py + 22, 11, 20);
            ctx.fillStyle = c; ctx.fillRect(px + ox, py + 20, 11, 8);
          });
        }
        break;
      }
      case T.RUG:
        ctx.fillStyle = "#c9a06a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#a55eea"; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "#8e44e8"; ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        break;
      default:
        ctx.fillStyle = "#f0f"; ctx.fillRect(px, py, TILE, TILE);
    }
  }

  /* ---- ambient life: butterflies, cave sparkles, tower sparks ---- */
  let particles = [];
  function spawnAmbience() {
    particles = [];
    const z = screen().zone;
    if (screen().label && z !== "base") return;   /* indoors: no weather */
    const count = { base: 3, park: 5, city: 4, cavern: 7, tower: 5, gardens: 9, ridge: isTop() ? 0 : 2, factory: 6, sky: 3 }[z] || 0;
    for (let i = 0; i < count; i++) {
      const at = () => ({ x: 60 + Math.random() * (COLS * TILE - 120), y: 60 + Math.random() * (ROWS * TILE - 120), t: Math.random() * 100 });
      if (z === "city") { particles.push({ kind: "pigeon", ...at() }); continue; }
      if (z === "sky") { particles.push({ kind: "bird", ...at() }); continue; }
      if (z === "factory") { particles.push({ kind: "steam", ...at() }); continue; }
      if (z === "gardens" && i % 2) { particles.push({ kind: "firefly", ...at() }); continue; }
      if (z === "cavern") { particles.push({ kind: "coin", ...at() }); continue; }
      if (z === "base" || z === "park" || z === "gardens" || z === "ridge") {
        particles.push({ kind: "butterfly",
          x: 60 + Math.random() * (COLS * TILE - 120),
          y: 60 + Math.random() * (ROWS * TILE - 120),
          t: Math.random() * 100, hue: Math.random() < .5 ? "#ff8fa3" : "#ffd32a" });
      } else if (z === "cavern") {
        particles.push({ kind: "sparkle",
          x: Math.random() * COLS * TILE, y: Math.random() * ROWS * TILE,
          t: Math.random() * 100 });
      } else if (z === "tower" || z === "factory") {
        particles.push({ kind: "spark",
          x: Math.random() * COLS * TILE, y: Math.random() * ROWS * TILE,
          t: Math.random() * 100 });
      }
    }
  }
  function drawAmbience() {
    for (const p of particles) {
      p.t += 0.03;
      if (p.kind === "butterfly") {
        p.x += Math.sin(p.t * 1.7) * 1.2;
        p.y += Math.cos(p.t * 1.1) * 0.9;
        const flap = Math.abs(Math.sin(p.t * 6)) * 5 + 2;
        ctx.fillStyle = p.hue;
        ctx.beginPath(); ctx.ellipse(p.x - 4, p.y, flap, 4, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x + 4, p.y, flap, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#333"; ctx.fillRect(p.x - 1, p.y - 4, 2, 8);
      } else if (p.kind === "sparkle") {
        const a = (Math.sin(p.t * 3) + 1) / 2 * .8;
        ctx.fillStyle = `rgba(41,217,255,${a})`;
        ctx.fillRect(p.x - 1, p.y - 4, 2, 8);
        ctx.fillRect(p.x - 4, p.y - 1, 8, 2);
      } else if (p.kind === "pigeon") {   /* city pigeons pecking around */
        const hop = Math.max(0, Math.sin(p.t * 2)) * 3;
        if (Math.sin(p.t * .7) > .95) p.x += Math.sin(p.t) * 2;
        ctx.fillStyle = "#8a8f9e"; ctx.beginPath(); ctx.ellipse(p.x, p.y - hop, 7, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6a6f7e"; ctx.beginPath(); ctx.arc(p.x + 6, p.y - 5 - hop + Math.abs(Math.sin(p.t * 5)) * 2, 3.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffb020"; ctx.fillRect(p.x + 9, p.y - 5 - hop, 3, 2);
      } else if (p.kind === "bird") {   /* little birds gliding over the clouds */
        p.x += 1.1; if (p.x > COLS * TILE + 20) { p.x = -20; p.y = 40 + Math.random() * (ROWS * TILE - 80); }
        const w = Math.sin(p.t * 6) * 5;
        ctx.strokeStyle = "#4a5a7a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - w); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + 7, p.y - w); ctx.stroke();
      } else if (p.kind === "steam") {   /* steam puffs drifting up from the machines */
        p.y -= .5; p.x += Math.sin(p.t) * .3;
        const life = (p.t * 20) % 60;
        if (life < .5) { p.y = 80 + Math.random() * (ROWS * TILE - 120); p.x = 40 + Math.random() * (COLS * TILE - 80); }
        ctx.fillStyle = `rgba(240,244,250,${.45 * (1 - life / 60)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + life / 5, 0, 7); ctx.fill();
      } else if (p.kind === "firefly") {   /* magic twinkles in the secret garden */
        p.x += Math.sin(p.t * 1.3) * .8; p.y += Math.cos(p.t * .9) * .6;
        const a = (Math.sin(p.t * 4) + 1) / 2;
        ctx.fillStyle = `rgba(255,240,140,${a * .35})`; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255,250,200,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill();
      } else if (p.kind === "coin") {   /* coins glinting in the cave dirt */
        const a = Math.max(0, Math.sin(p.t * 2.5));
        ctx.fillStyle = `rgba(255,211,42,${a})`;
        ctx.fillRect(p.x - 1, p.y - 5, 2, 10); ctx.fillRect(p.x - 5, p.y - 1, 10, 2);
      } else if (p.kind === "spark") {
        p.y -= 0.6;
        if (p.y < -6) { p.y = ROWS * TILE + 6; p.x = Math.random() * COLS * TILE; }
        const a = (Math.sin(p.t * 4) + 1) / 2 * .7 + .2;
        ctx.fillStyle = `rgba(165,94,234,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill();
      }
    }
  }

  function drawLabels() {
    const labels = LABELS[state.key];
    if (!labels) return;
    ctx.textAlign = "center";
    for (const L of labels) {
      const big = L.text.length <= 2;   /* math symbols on stations */
      ctx.font = big ? "bold 22px 'Comic Sans MS', sans-serif"
               : L.small ? "bold 11px 'Comic Sans MS', sans-serif"
                         : "bold 13px 'Comic Sans MS', sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.75)";
      ctx.strokeText(L.text, L.x * TILE, L.y * TILE);
      ctx.fillStyle = L.color || (big ? "#ffd32a" : "#ffffff");
      ctx.fillText(L.text, L.x * TILE, L.y * TILE);
    }
    ctx.textAlign = "start";
  }

  /* draw whole buildings as coherent structures with varied styles */
  function drawBuildings() {
    const s = screen();
    for (const b of (s.buildings || [])) {
      if (state.key === "0,-3") { drawClockTower(b); continue; }
      const px = b.x * TILE, py = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      const st = b.style;
      /* facade */
      ctx.fillStyle = st.facade; ctx.fillRect(px, py, w, h);
      /* roof band */
      ctx.fillStyle = st.roof; ctx.fillRect(px - 3, py - 6, w + 6, 16);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(px - 3, py - 6, w + 6, 4);
      /* windows: deterministic lit/dark pattern */
      for (let wy = 0; wy < b.h; wy++) {
        for (let wx = 0; wx < b.w; wx++) {
          const lit = ((b.x + wx) * 7 + (b.y + wy) * 13) % 3 !== 0;
          ctx.fillStyle = lit ? st.win : "#2b3350";
          ctx.fillRect(px + wx * TILE + 12, py + wy * TILE + 14, 12, 14);
          ctx.fillStyle = "rgba(0,0,0,.25)";
          ctx.fillRect(px + wx * TILE + 12, py + wy * TILE + 14, 12, 3);
          if (lit && ((b.x + wx + b.y + wy) % 4 === 0)) {   /* a friendly robot in some windows */
            ctx.fillStyle = "#556";
            ctx.fillRect(px + wx * TILE + 15, py + wy * TILE + 20, 6, 6);
          }
        }
      }
      /* awning over bottom edge, for shops */
      if (st.awning) {
        for (let i = 0; i < b.w * 2; i++) {
          ctx.fillStyle = i % 2 === 0 ? st.awning : "#fff";
          ctx.fillRect(px + i * TILE / 2, py + h - 8, TILE / 2, 10);
        }
      }
      /* ground shadow */
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(px, py + h - 4, w, 4);
    }
    /* redraw workshop door over its building facade */
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (s.grid[y][x] === T.DOOR_WORKSHOP) {
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = "#8a4b23"; ctx.fillRect(px + 8, py + 8, 32, 40);
        ctx.fillStyle = "#ffd32a"; ctx.font = "20px sans-serif";
        ctx.fillText("🔧", px + 13, py + 34);
      }
    }
    /* doors on this screen (enterable!) */
    for (const dk in DOORS) {
      const [sk, coord] = dk.split(":");
      if (sk !== state.key) continue;
      const [dx, dy] = coord.split(",").map(Number);
      const px = dx * TILE, py = dy * TILE;
      ctx.fillStyle = "#8a4b23"; ctx.fillRect(px + 8, py + 8, 32, 40);
      ctx.fillStyle = "#5a2f14"; ctx.fillRect(px + 8, py + 8, 32, 6);
      ctx.fillStyle = "#ffd97a"; ctx.fillRect(px + 12, py + 16, 24, 10);   /* door window */
      ctx.fillStyle = "#ffd32a";
      ctx.beginPath(); ctx.arc(px + 34, py + 32, 3, 0, 7); ctx.fill();     /* handle */
      /* welcome mat */
      if (dy < ROWS - 1 && !SOLID.has(screen().grid[dy + 1] ? screen().grid[dy + 1][dx] : T.WALL)) {
        ctx.fillStyle = "rgba(255,211,42,.35)";
        ctx.fillRect(px + 10, (dy + 1) * TILE + 4, 28, 10);
      }
    }
  }

  function drawPickups() {
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    const bob = Math.sin(performance.now() / 350) * 3;
    for (const p of pickups()) {
      if (p.taken) continue;
      if (p.kind === "key") {   /* golden glow */
        const a = .3 + (Math.sin(performance.now() / 250) + 1) / 2 * .4;
        ctx.fillStyle = `rgba(255,211,42,${a})`;
        ctx.beginPath(); ctx.arc(p.x * TILE + 24, p.y * TILE + 24, 20, 0, 7); ctx.fill();
      }
      ctx.fillText(p.kind === "part" ? "🔩" : p.kind === "key" ? "🗝️" : "🍩",
                   p.x * TILE + 24, p.y * TILE + 32 + bob);
    }
    ctx.textAlign = "start";
  }

  /* stations he needs RIGHT NOW: a big pulsing orange halo, orbiting sparkles, and a bouncing arrow */
  function drawStationGlow() {
    const g = Main.getGame(), t = performance.now();
    for (const st of STATIONS) {
      if ((st.screen || "-1,0") !== state.key) continue;
      if (!stationUnlocked(g, st) || hasBadge(g, st.id)) continue;
      const cx = st.x * TILE + 24, cy = st.y * TILE + 24;
      const pulse = (Math.sin(t / 260) + 1) / 2;
      const r = 40 + pulse * 10;
      const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
      halo.addColorStop(0, `rgba(255,140,0,${.75 + pulse * .2})`);
      halo.addColorStop(.6, `rgba(255,90,0,${.35 + pulse * .2})`);
      halo.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      drawTile(T.STATION, st.x, st.y, screen().zone);   /* station back on top of its halo */
      /* sparkles orbiting the station */
      for (let k = 0; k < 5; k++) {
        const ang = t / 700 + k * Math.PI * 2 / 5;
        const sx = cx + Math.cos(ang) * 34, sy = cy + Math.sin(ang) * 30;
        const sz = 3 + ((Math.sin(t / 150 + k * 1.7) + 1) / 2) * 5;
        ctx.fillStyle = k % 2 ? "#ffffff" : "#fff3a0";
        ctx.beginPath();
        ctx.moveTo(sx, sy - sz * 1.6); ctx.lineTo(sx + sz * .45, sy - sz * .45);
        ctx.lineTo(sx + sz * 1.6, sy); ctx.lineTo(sx + sz * .45, sy + sz * .45);
        ctx.lineTo(sx, sy + sz * 1.6); ctx.lineTo(sx - sz * .45, sy + sz * .45);
        ctx.lineTo(sx - sz * 1.6, sy); ctx.lineTo(sx - sz * .45, sy - sz * .45);
        ctx.closePath(); ctx.fill();
      }
      /* big bouncing arrow (below, so it never covers the label) */
      ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
      ctx.lineWidth = 4; ctx.strokeStyle = "#7a2e00";
      const ay = st.y * TILE + TILE + 46 + Math.sin(t / 150) * 5;   /* under the zone tag, pointing up */
      ctx.strokeText("⬆", cx, ay); ctx.fillStyle = "#ffb000"; ctx.fillText("⬆", cx, ay);
      ctx.textAlign = "start";
    }
  }

  /* the hover-bike looks better with every repair, and wears your suit color when done */
  function drawBike(px, py) {
    const g = Main.getGame(), stage = g.bike || 0, t = performance.now();
    const done = stage >= BIKE_STAGES.length;
    const hover = done ? Math.sin(t / 250) * 3 - 4 : 0;
    const body = done ? Main.suit().primary : "#8a8f99";
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.ellipse(px + 48, py + 42, 36, 6, 0, 0, 7); ctx.fill();
    const y0 = py + hover;
    /* wheels (stage 2) or bare axles */
    if (stage >= 2) {
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(px + 22, y0 + 34, 9, 0, 7); ctx.arc(px + 74, y0 + 34, 9, 0, 7); ctx.fill();
      ctx.fillStyle = "#9aa0ad"; ctx.beginPath(); ctx.arc(px + 22, y0 + 34, 4, 0, 7); ctx.arc(px + 74, y0 + 34, 4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "#555"; ctx.fillRect(px + 18, y0 + 32, 8, 4); ctx.fillRect(px + 70, y0 + 32, 8, 4);
    }
    /* body + seat + handlebars */
    ctx.fillStyle = body; ctx.fillRect(px + 16, y0 + 20, 64, 12);
    ctx.fillStyle = "#2b2f38"; ctx.fillRect(px + 34, y0 + 14, 22, 7);
    ctx.fillStyle = "#2b2f38"; ctx.fillRect(px + 70, y0 + 8, 4, 14); ctx.fillRect(px + 66, y0 + 8, 12, 3);
    /* engine (stage 1) */
    ctx.fillStyle = stage >= 1 ? "#29d9ff" : "#444";
    ctx.fillRect(px + 40, y0 + 24, 14, 6);
    /* turbo jets (stage 3) */
    if (stage >= 3) {
      ctx.fillStyle = "#ffd32a"; ctx.fillRect(px + 6, y0 + 22, 12, 8);
      const f = (Math.sin(t / 60) + 1) / 2;
      ctx.fillStyle = `rgba(255,${120 + f * 80},0,.9)`;
      ctx.beginPath(); ctx.moveTo(px + 6, y0 + 22); ctx.lineTo(px - 6 - f * 6, y0 + 26); ctx.lineTo(px + 6, y0 + 30); ctx.fill();
    } else if (Math.floor(t / 400) % 3 === 0) {   /* broken: little sparks */
      ctx.fillStyle = "#ffd32a"; ctx.fillRect(px + 30 + (t / 50) % 20, y0 + 16, 3, 3);
    }
    if (!done) { ctx.font = "14px sans-serif"; ctx.fillText("🔧", px + 82, py + 14); }
  }

  function drawChestBody(px, py, open) {
        ctx.fillStyle = "#7a4a1e"; ctx.fillRect(px + 6, py + 20, 36, 22);          /* box */
        ctx.fillStyle = "#ffd32a"; ctx.fillRect(px + 6, py + 28, 36, 4);           /* gold band */
        if (open) {
          ctx.fillStyle = "#3a2410"; ctx.fillRect(px + 8, py + 14, 32, 8);         /* empty inside */
          ctx.fillStyle = "#9a6a35"; ctx.fillRect(px + 6, py + 6, 36, 8);          /* lid tipped back */
        } else {
          ctx.fillStyle = "#9a6a35"; ctx.fillRect(px + 6, py + 12, 36, 10);        /* closed lid */
          ctx.fillStyle = "#ffd32a"; ctx.fillRect(px + 20, py + 26, 8, 9);          /* lock */
          ctx.font = "13px sans-serif"; ctx.fillText("🧩", px + 30, py + 14);
        }
  }

  /* unopened treasure chests: pulsing gold halo + twinkles so they're easy to spot */
  function drawChestGlow() {
    const s = screen(), g = Main.getGame(), t = performance.now();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (s.grid[y][x] !== T.CHEST || (g.opened && g.opened[state.key + ":" + x + "," + y])) continue;
      const cx = x * TILE + 24, cy = y * TILE + 28;
      const pulse = (Math.sin(t / 240 + x) + 1) / 2;
      const r = 36 + pulse * 12;
      const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, r);
      halo.addColorStop(0, `rgba(255,230,90,${.85})`);
      halo.addColorStop(.55, `rgba(255,170,0,${.35 + pulse * .25})`);
      halo.addColorStop(1, "rgba(255,170,0,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      drawChestBody(x * TILE, y * TILE, false);
      /* light beams + twinkles */
      for (let k = 0; k < 4; k++) {
        const ang = t / 900 + k * Math.PI / 2;
        const sx = cx + Math.cos(ang) * 26, sy = cy - 6 + Math.sin(ang) * 22;
        const sz = 2 + ((Math.sin(t / 130 + k * 2) + 1) / 2) * 4;
        ctx.fillStyle = "#fffbe0";
        ctx.fillRect(sx - sz / 2, sy - sz * 1.5, sz, sz * 3); ctx.fillRect(sx - sz * 1.5, sy - sz / 2, sz * 3, sz);
      }
    }
  }

  function render() {
    const s = screen();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        drawTile(s.grid[y][x], x, y, s.zone);
    sceneDecor(s);
    drawStationGlow();
    drawChestGlow();
    drawBuildings();
    drawLabels();
    drawAmbience();
    drawPickups();
    /* lair scene: the captured friend in a cage (freed after the Baron falls) */
    if (state.key === "lair") {
      const g = Main.getGame();
      const civ = CIVILIANS[g.rescue ? g.rescue.sprite : "man"];
      const freed = g.progress && g.progress.baron;
      const cx = 12 * TILE, cy = 3 * TILE;
      if (!freed) drawGrid(ctx, civ.grid, civ.colors, cx + 6, cy - 4, 3);   /* once freed, they come with you */
      if (!freed) {
        /* "Help me!" speech bubble */
        const bx = cx - 66, by = cy - 44;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.roundRect(bx, by, 108, 30, 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + 88, by + 28); ctx.lineTo(bx + 104, by + 44); ctx.lineTo(bx + 100, by + 28); ctx.fill();
        ctx.fillStyle = "#223";
        ctx.font = "bold 13px 'Comic Sans MS', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Help me, " + g.name + "!", bx + 54, by + 20);
        ctx.textAlign = "start";
        ctx.fillStyle = "#33334d";
        for (let i = 0; i < 4; i++) ctx.fillRect(cx + 2 + i * 13, cy - 10, 5, 60);
        ctx.fillRect(cx - 2, cy - 12, 52, 5); ctx.fillRect(cx - 2, cy + 46, 52, 5);
      }
    }
    /* friendly critters & NPCs */
    for (const c of critters()) {
      const spr = CRITTER_SPRITES[c.sprite];
      const rows = spr.frames[0].length;
      drawGrid(ctx, spr.frames[Math.floor(performance.now() / 300) % 2], spr.colors,
               c.x * TILE + 6, c.y * TILE + (TILE - rows * 3) - 2, 3);
    }
    /* enemies (12x12 grid at 3px = 36px; bosses bigger!) */
    const eFrame = Math.floor(performance.now() / 350) % 2;
    for (const e of enemies()) {
      if (e.defeated) continue;
      const spr = ENEMY_SPRITES[e.type];
      if (e.boss) {
        const bs = 54 / spr.frames[0][0].length;   /* bosses are drawn 54px wide whatever their grid size */
        const bob = Math.sin(performance.now() / 400 + e.x) * 2;
        drawGrid(ctx, spr.frames[eFrame], spr.colors, e.x * TILE - 3, e.y * TILE - 8 + bob, bs);
      } else if (e.champion) {
        const t = performance.now();
        const a = .35 + Math.sin(t / 220 + e.x) * .2;   /* golden glow */
        const grd = ctx.createRadialGradient(e.x * TILE + 24, e.y * TILE + 26, 4, e.x * TILE + 24, e.y * TILE + 26, 34);
        grd.addColorStop(0, `rgba(255,211,42,${a})`); grd.addColorStop(1, "rgba(255,211,42,0)");
        ctx.fillStyle = grd; ctx.fillRect(e.x * TILE - 12, e.y * TILE - 12, TILE + 24, TILE + 24);
        const gs = goldSprite(spr);
        drawGrid(ctx, gs.frames[eFrame], gs.colors, e.x * TILE + 6, e.y * TILE + 8, 3);
        ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.font = "18px sans-serif";
        ctx.fillText("👑", e.x * TILE + 24, e.y * TILE + 6 + Math.sin(t / 300) * 2);
        ctx.textAlign = "start";
        const tw = (Math.sin(t / 180 + e.y) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.fillRect(e.x * TILE + 40, e.y * TILE + 12, 2, 8); ctx.fillRect(e.x * TILE + 37, e.y * TILE + 15, 8, 2);
      } else {
        drawGrid(ctx, spr.frames[eFrame], spr.colors, e.x * TILE + 6, e.y * TILE + 8, 3);
      }
    }
    /* Penny Pillow behind her counter: hiding and shaking until the Couch Crusher is gone */
    const vend = screen().vendor;
    if (vend) {
      const civ = CIVILIANS[vend.sprite], saved = Main.getGame().furnitureSaved, t = performance.now();
      const vx = vend.x * TILE + 6, vy = vend.y * TILE - 4;
      ctx.save();
      ctx.beginPath(); ctx.rect(vend.x * TILE - 8, 0, TILE + 16, (vend.y + 1) * TILE + 6); ctx.clip();   /* the counter hides her legs */
      if (saved) drawGrid(ctx, civ.grid, civ.colors, vx, vy, 3);
      else drawGrid(ctx, civ.grid, civ.colors, vx + Math.sin(t / 35) * 1.5, vy + 26, 3);   /* crouched down, shaking */
      ctx.restore();
      ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.font = "18px sans-serif";
      ctx.fillText(saved ? "😊" : "😨", vx + 34, vy + (saved ? 6 : 26) + Math.sin(t / 300) * 2);
      ctx.textAlign = "start";
    }
    /* the rescued friend: following you, or relaxing at home */
    {
      const g = Main.getGame();
      const civ = g.rescue && CIVILIANS[g.rescue.sprite];
      if (civ && companionFollowing()) {
        const c = state.comp;
        const moving = Math.abs(c.px - c.x * TILE) + Math.abs(c.py - c.y * TILE) > 0;
        const stride = moving && Math.floor(performance.now() / 140) % 2 === 1;   /* feet step like the hero's */
        drawGrid(ctx, civGrid(g.rescue.sprite, stride), civ.colors, c.px + 6, c.py - 4, 3);
      } else if (civ && state.key === "hero_house" && g.companion && g.companion.mode === "home") {
        drawGrid(ctx, civ.grid, civ.colors, COMPANION_HOME.x * TILE + 6, COMPANION_HOME.y * TILE - 4, 3);
        ctx.font = "14px sans-serif";
        ctx.fillText("💤", COMPANION_HOME.x * TILE + 34, COMPANION_HOME.y * TILE + Math.sin(performance.now() / 400) * 3);
      }
    }
    /* hero: 12x16 grid at 3px scale = 36x48, centered in tile */
    const heroPowers = Main.getGame().powers || {};
    const onWater = tileAt(Math.round(state.px / TILE), Math.round(state.py / TILE)) === T.WATER;
    if (onWater) {   /* hover shadow while flying over water */
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath(); ctx.ellipse(state.px + 24, state.py + 44, 16, 5, 0, 0, 7); ctx.fill();
    }
    drawHero(ctx, state.px + 6, state.py - 4 - (onWater ? 8 : 0), state.dir, state.frame, Main.suit(), 3, heroPowers);
    drawWeather(screen());
  }

  function loop() {
    if (Main.currentScreen() === "screen-world") { update(); render(); }
    else if (Main.currentScreen() === "screen-battle") { Battle.render(); }
    else if (Main.currentScreen() === "screen-powerup") { Main.renderPowerup(); }
    requestAnimationFrame(loop);
  }

  function zoneOf(key) { return world[key] ? (world[key].battleZone || world[key].zone) : null; }
  /* puzzles: easier at home and in the city, harder later */
  function puzzleTier() {
    const z = screen().battleZone || screen().zone;
    return ["base", "park", "city", "interior"].includes(z) ? 1 : 2;
  }
  /* a solved puzzle door disappears; opened chests stay open (also after Continue) */
  /* hover-bike fast travel */
  function travel(key, tx, ty) {
    releaseKeys();
    state.lastLabel = "";
    goTo(key, tx, ty);
  }
  function openPuzzleDoor(key) {
    const m = key.match(/^(.+):(\d+),(\d+)$/);
    if (m && world[m[1]] && world[m[1]].grid[+m[3]][+m[2]] === T.PUZZLE_DOOR) world[m[1]].grid[+m[3]][+m[2]] = T.IN_FLOOR;
  }
  function applyOpened(opened) {
    for (const k in (opened || {})) {
      const m = k.match(/^(.+):(\d+),(\d+)$/);
      if (!m || !world[m[1]]) continue;
      const [sk, x, y] = [m[1], +m[2], +m[3]];
      if (world[sk].grid[y][x] === T.PUZZLE_DOOR) world[sk].grid[y][x] = T.IN_FLOOR;
    }
  }
  /* bosses stay beaten across save/continue */
  function applyProgress(progress, hasKey) {
    for (const k in world) {
      for (const e of (world[k].enemies || [])) {
        if (e.boss && progress[e.boss]) e.defeated = true;
      }
      if (hasKey) for (const p of (world[k].pickups || [])) {
        if (p.kind === "key") p.taken = true;
      }
    }
  }
  /* open every gate whose boss is beaten AND whose badges are earned */
  function gateOpen(g, zone) { return zoneOpen(g, zone); }
  function unlockGates(g) {
    for (const [zone, tiles] of Object.entries(GATE_TILES)) {
      if (!zoneOpen(g, zone)) continue;
      for (const [k, x, y] of tiles) world[k].grid[y][x] = floorOf(world[k].zone);
    }
  }
  /* ---- post-game ---- */
  function houseGrid() { return world["hero_house"].grid; }
  function applyDecor(g) {   /* placed decorations become solid DECOR tiles in Hero House */
    const grid = houseGrid();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === T.DECOR) grid[y][x] = T.IN_FLOOR;
    for (const k in ((g.decor || {}).placed || {})) {
      const [x, y] = k.split(",").map(Number);
      if (grid[y] && grid[y][x] === T.IN_FLOOR) grid[y][x] = T.DECOR;
    }
  }
  function refillChests(g) {   /* after the rescue every chest fills up once more */
    if (g.chestsRefilled) return;
    for (const k of Object.keys(g.opened || {})) {
      const m = k.match(/^(.+):(\d+),(\d+)$/);
      if (m && world[m[1]] && world[m[1]].grid[+m[3]][+m[2]] === T.CHEST) delete g.opened[k];
    }
    g.chestsRefilled = true;
  }
  function champSpot(s) {   /* a reachable open tile near the middle of the screen */
    const pass = (x, y) => !SOLID.has(s.grid[y][x]);
    const seen = new Set(), q = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
      if ((x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) && pass(x, y)) { seen.add(x + "," + y); q.push([x, y]); }
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || !pass(nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    let best = null, bd = 1e9;
    for (const k of seen) {
      const [x, y] = k.split(",").map(Number);
      if (x < 2 || y < 2 || x > COLS - 3 || y > ROWS - 3) continue;
      if ((s.enemies || []).some(e => !e.defeated && e.x === x && e.y === y)) continue;
      if ((s.pickups || []).some(p => !p.taken && p.x === x && p.y === y)) continue;
      const d = Math.abs(x - 8) + Math.abs(y - 5) * 1.2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  function spawnChampions(g) {
    if (!(g.progress && g.progress.baron)) return;
    for (const c of CHAMPION_SPOTS) {
      const s = world[c.screen];
      if (!s || (g.champs && g.champs[c.screen])) continue;
      if (s.enemies.some(e => e.champion)) continue;
      const spot = champSpot(s);
      if (!spot) continue;
      s.enemies.push({ type: c.type, x: spot[0], y: spot[1], still: true, champion: true, champKey: c.screen,
                       name: "Champion " + ENEMY_SPRITES[c.type].name });
    }
  }
  function resetWorldState(seed) {
    world = buildWorld(seed || 1);   /* fresh seeded layout: gates, rocks, enemies, pickups */
  }

  function getSave() {
    return { key: state.key,
             tx: Math.round(state.px / TILE), ty: Math.round(state.py / TILE) };
  }
  function loadSave(pos) {
    state.lastLabel = "";
    if (pos) {
      const key = pos.key || (pos.screenX !== undefined ? pos.screenX + "," + pos.screenY : null);
      if (key && world[key]) {
        goTo(key, pos.tx, pos.ty);
        return;
      }
    }
    onEnterScreen();
  }
  function resetToBase() {
    state.key = "0,0";
    state.px = 7 * TILE; state.py = 6 * TILE;
    state.targetX = state.px; state.targetY = state.py;
    state.moving = false; state.lastLabel = "";
  }
  /* test hook: jump straight to a screen */
  function debugGoTo(key, tx, ty) { if (world[key]) goTo(key, tx, ty); }
  function debugWorld() { return world; }

  return { init, getSave, loadSave, resetToBase, onEnterScreen, zoneOf, resetWorldState,
           unlockGates, gateOpen, applyProgress, applyOpened, openPuzzleDoor, travel, placeCompanion, companionFollowing, releaseKeys, debugGoTo, debugWorld, collectPickups,
           houseGrid, applyDecor, refillChests, spawnChampions, applyStoreState };
})();

