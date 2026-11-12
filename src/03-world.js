/* ============================ WORLD ============================ */
/* Screens keyed "x,y". Layout:
                 (1,-1)cavern  (2,-1)cavern
   (-1,0)park    (0,0)base     (1,0)city     (2,0)city
                               (1,1)tower    (2,1)tower
   Hand-built placeholder layouts for Chunk 1 (MapGen randomizes in Chunk 5). */

function blankScreen(fill) {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
}
function border(g, wallTile, openings, floorT = T.FLOOR) {
  for (let x = 0; x < COLS; x++) { g[0][x] = wallTile; g[ROWS-1][x] = wallTile; }
  for (let y = 0; y < ROWS; y++) { g[y][0] = wallTile; g[y][COLS-1] = wallTile; }
  const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
  if (openings.n) { g[0][mx-1] = floorT; g[0][mx] = floorT; }
  if (openings.s) { g[ROWS-1][mx-1] = floorT; g[ROWS-1][mx] = floorT; }
  if (openings.w) { g[my][0] = floorT; g[my-1][0] = floorT; }
  if (openings.e) { g[my][COLS-1] = floorT; g[my-1][COLS-1] = floorT; }
}

/* seeded RNG so each New Game builds a fresh but reproducible world */
function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scatter(g, tile, spots) { spots.forEach(([x, y]) => { g[y][x] = tile; }); }

/* Building visual styles: varied facades, roofs, windows, optional awnings */
const BUILDING_STYLES = [
  { facade: "#5b6a94", roof: "#3d4a75", win: "#ffd97a" },
  { facade: "#946a5b", roof: "#6e4a3d", win: "#ffe9b0" },
  { facade: "#5b8f94", roof: "#3d6a70", win: "#eaffff", awning: "#ff6b81" },
  { facade: "#7a5b94", roof: "#573d70", win: "#f0e0ff" },
  { facade: "#8f945b", roof: "#6a703d", win: "#ffffd0", awning: "#29d9ff" },
];
/* fills tiles solid AND records the building so it renders as one structure */
function building(scr, x, y, w, h, styleIdx) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      scr.grid[yy][xx] = T.BUILDING;
  scr.buildings.push({ x, y, w, h, style: BUILDING_STYLES[styleIdx % BUILDING_STYLES.length] });
}
/* interior room helper */
/* shape: floor spans columns l..r and rows t..9 (the exit is always at 8,10);
   cuts: [x1, y1, x2, y2] rectangles carved back out (for L-shaped rooms).
   Everything outside the walls is dark VOID, so rooms really feel different sizes. */
function room(zoneLabel, style, shape) {
  const sh = shape || { l: 1, t: 1, r: 14 };
  const g = blankScreen(T.VOID);
  for (let y = sh.t; y <= ROWS - 2; y++) for (let x = sh.l; x <= sh.r; x++) g[y][x] = T.IN_FLOOR;
  for (const [x1, y1, x2, y2] of (sh.cuts || []))
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = T.VOID;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (g[y][x] !== T.VOID) continue;
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS && g[yy][xx] === T.IN_FLOOR) near = true;
    }
    if (near) g[y][x] = T.IN_WALL;
  }
  return { grid: g, zone: "interior", label: zoneLabel, buildings: [], pickups: [], enemies: [],
           critters: [],
           style: style || { floor: "#c9a06a", floor2: "#c9a06a", wall: "#6e4a26" } };
}

function buildWorld(seed = 1) {
  const rng = mulberry32(seed);
  const R = {
    int: n => Math.floor(rng() * n),
    between: (a, b) => a + Math.floor(rng() * (b - a + 1)),
    pick: arr => arr[Math.floor(rng() * arr.length)],
    chance: p => rng() < p,
  };
  const W = {};
  const mk = (grid, zone) => ({ grid, zone, buildings: [], pickups: [], enemies: [], critters: [] });

  /* ============ FIXED SCREENS (hand-designed, stable every game) ============ */

  /* ---- HERO BASE (0,0) ---- */
  {
    const s = mk(blankScreen(T.FLOOR), "base");
    const g = s.grid;
    border(g, T.WALL, { w: true, e: true });
    for (let x = 1; x < COLS-1; x++) { g[5][x] = T.ROAD; g[4][x] = T.ROAD; }
    building(s, 6, 1, 4, 2, 0);          /* workshop */
    g[2][7] = T.DOOR_WORKSHOP;
    scatter(g, T.SIGN, [[9,3]]);
    building(s, 2, 7, 3, 2, 1);          /* hero house */
    building(s, 11, 7, 3, 2, 2);         /* robo-garage */
    scatter(g, T.SIGN, [[5,7],[10,7]]);
    scatter(g, T.LAMP, [[2,3],[13,3],[2,6],[13,6]]);
    scatter(g, T.FLOWERS, [[6,3],[11,2],[12,2],[6,9],[9,9],[5,2]]);
    scatter(g, T.BUSH, [[1,1],[14,1],[10,2]]);
    scatter(g, T.BENCH, [[7,9],[8,9]]);
    scatter(g, T.SIGN, [[3,5]]);
    g[0][12] = T.FLOOR; g[0][13] = T.FLOOR;   /* path north to Wishing Lake */
    scatter(g, T.SIGN, [[14,2]]);
    s.pickups.push({ x: 12, y: 9, kind: "part" });
    W["0,0"] = s;
  }

  /* ---- PRACTICE PARK (-1,0) ---- */
  {
    const s = mk(blankScreen(T.FLOOR), "park");
    const g = s.grid;
    border(g, T.TREE, { e: true });
    scatter(g, T.STATION, STATIONS.filter(st => !st.screen).map(st => [st.x, st.y]));
    scatter(g, T.FLOWERS, [[1,5],[5,5],[9,9],[14,9],[14,1]]);
    scatter(g, T.BENCH, [[7,5],[8,5]]);
    scatter(g, T.SIGN, [[13,5]]);
    s.pickups.push({ x: 2, y: 9, kind: "part" });
    W["-1,0"] = s;
  }

  /* ============ RANDOMIZED COMBAT SCREENS ============ */

  /* protected cells: never clutter next to any potential opening */
  const PROTECTED = new Set(["7,1","8,1","7,9","8,9","1,4","1,5","14,4","14,5"]);

  function freeCells(s, reserved) {
    const out = [];
    for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) {
        const key = x + "," + y;
        if (SOLID.has(s.grid[y][x])) continue;
        if (PROTECTED.has(key) || reserved.has(key)) continue;
        out.push([x, y]);
      }
    return out;
  }
  function takeCell(s, reserved) {
    const cells = freeCells(s, reserved);
    if (!cells.length) return null;
    const [x, y] = cells[R.int(cells.length)];
    reserved.add(x + "," + y);
    return [x, y];
  }
  function connected(s, required) {
    /* BFS over hero-walkable tiles (gates count: they unlock) */
    const ok = t => !SOLID.has(t) || t === T.GATE;
    const start = required[0];
    const seen = new Set([start.join(",")]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        const k = nx + "," + ny;
        if (seen.has(k) || !ok(s.grid[ny][nx])) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return required.every(([x, y]) => seen.has(x + "," + y));
  }

  /* generic combat-screen generator with retry-until-connected */
  function genScreen(key, spec) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const s = mk(blankScreen(spec.floor), spec.zone);
      const g = s.grid;
      border(g, spec.wall, spec.openings, spec.floor);
      const reserved = new Set();
      const required = [];
      /* opening-inner tiles must stay connected */
      if (spec.openings.n) required.push([7,1],[8,1]);
      if (spec.openings.s) required.push([7,9],[8,9]);
      if (spec.openings.w) required.push([1,4],[1,5]);
      if (spec.openings.e) required.push([14,4],[14,5]);
      spec.fixed && spec.fixed(s, reserved, required);

      /* random wall/obstacle clusters */
      const clusters = spec.clusters ? R.between(spec.clusters[0], spec.clusters[1]) : 0;
      for (let c = 0; c < clusters; c++) {
        const cell = takeCell(s, reserved);
        if (!cell) break;
        let [cx, cy] = cell;
        const size = R.between(1, 3);
        for (let i = 0; i < size; i++) {
          if (cx > 0 && cx < COLS-1 && cy > 0 && cy < ROWS-1 &&
              !SOLID.has(g[cy][cx]) && !PROTECTED.has(cx + "," + cy)) {
            g[cy][cx] = spec.clusterTile;
          }
          cx += R.int(3) - 1; cy += R.int(3) - 1;
        }
      }
      /* decorations */
      for (const [tile, lo, hi] of (spec.decor || [])) {
        const n = R.between(lo, hi);
        for (let i = 0; i < n; i++) {
          const cell = takeCell(s, reserved);
          if (cell) g[cell[1]][cell[0]] = tile;
        }
      }
      /* water pond (flight bonus) with treasure on it */
      if (spec.pond) {
        const cell = takeCell(s, reserved);
        if (cell) {
          const [wx, wy] = cell;
          for (const [dx, dy] of [[0,0],[1,0],[0,1],[1,1]]) {
            const px2 = wx + dx, py2 = wy + dy;
            if (px2 > 0 && px2 < COLS-1 && py2 > 0 && py2 < ROWS-1 &&
                !SOLID.has(g[py2][px2]) && !PROTECTED.has(px2 + "," + py2)) {
              g[py2][px2] = T.WATER;
              reserved.add(px2 + "," + py2);
            }
          }
          s.pickups.push({ x: wx, y: wy, kind: "part" });   /* needs Flight! */
        }
      }
      /* puzzle-locked treasure chest: needs a reachable tile next to it */
      if (spec.chest || CHEST_SCREENS.includes(key)) {
        for (let t = 0; t < 40; t++) {
          const cell = takeCell(s, reserved);
          if (!cell) break;
          const [cx, cy] = cell;
          const nb = [[cx, cy + 1], [cx - 1, cy], [cx + 1, cy], [cx, cy - 1]].find(([x, y]) =>
            x > 0 && x < COLS - 1 && y > 0 && y < ROWS - 1 && !SOLID.has(g[y][x]) &&
            !reserved.has(x + "," + y) && !PROTECTED.has(x + "," + y));
          if (!nb) continue;
          g[cy][cx] = T.CHEST;
          reserved.add(nb.join(",")); required.push(nb);
          break;
        }
      }
      /* boulders (strength bonus) */
      for (let i = 0; i < (spec.rocks || 0); i++) {
        const cell = takeCell(s, reserved);
        if (cell) g[cell[1]][cell[0]] = T.ROCK;
      }
      /* wandering enemies */
      for (let i = 0; i < (spec.enemies || 0); i++) {
        const cell = takeCell(s, reserved);
        if (!cell) break;
        s.enemies.push({ type: R.pick(spec.enemyTypes || ["scrapbot", "gremlin"]),
                         x: cell[0], y: cell[1],
                         hpBonus: spec.hpBonus ? 1 : undefined });
        required.push(cell);
      }
      /* ground pickups */
      for (let i = 0; i < (spec.pickupN || 0); i++) {
        const cell = takeCell(s, reserved);
        if (!cell) break;
        s.pickups.push({ x: cell[0], y: cell[1], kind: R.chance(.2) ? "donut" : "part" });
        required.push(cell);
      }
      if (connected(s, required)) { W[key] = s; return; }
    }
    throw new Error("mapgen failed for " + key);
  }

  /* ---- CITY (fixed buildings/signs hold the doors & labels) ---- */
  genScreen("1,0", {
    zone: "city", floor: T.ROAD, wall: T.BUILDING,
    openings: { w: true, e: true, n: true, s: true },
    clusterTile: T.BUILDING, clusters: null,
    decor: [[T.LAMP, 2, 4], [T.FLOWERS, 0, 2]],
    rocks: 1, enemies: 2, pickupN: 1,
    fixed: (s, reserved, required) => {
      building(s, 3, 2, 3, 2, 2);   /* Math Mart */
      building(s, 10, 2, 3, 2, 3);
      building(s, 3, 7, 3, 2, 4);
      building(s, 10, 7, 3, 2, 0);  /* Gear Garage */
      scatter(s.grid, T.SIGN, [[6,3],[9,7]]);
      required.push([4,4]);          /* mart door front */
      for (const c of [[11,4],[4,9],[11,9]]) { required.push(c); reserved.add(c.join(",")); }   /* bank, toy shop, gear garage */
      s.enemies.push({ type: "gremlinking", x: 7, y: 1, boss: "city" });
      reserved.add("7,1");
    },
  });
  genScreen("2,0", {
    zone: "city", floor: T.ROAD, wall: T.BUILDING,
    openings: { w: true, e: true },
    decor: [[T.LAMP, 2, 3], [T.FLOWERS, 1, 3]],
    pond: true, enemies: 2, pickupN: 1,
    fixed: (s, reserved, required) => {
      building(s, 4, 2, 3, 3, 1);   /* Donut Depot */
      building(s, 9, 6, 3, 3, 3);   /* Library */
      building(s, 10, 1, 3, 2, 4);  /* Comfy Corner Furniture */
      scatter(s.grid, T.SIGN, [[7,4],[8,6],[8,2]]);
      required.push([5,5],[10,9],[11,3]);   /* door fronts */
      reserved.add("11,3");
    },
  });
  genScreen("3,0", {
    zone: "city", floor: T.ROAD, wall: T.BUILDING,
    openings: { w: true, n: true, s: true, e: true },
    decor: [[T.LAMP, 2, 4], [T.FLOWERS, 1, 3]],
    rocks: 2, enemies: 2, pickupN: 2,
    fixed: (s, reserved, required) => {
      building(s, 3, 2, 4, 2, 4);   /* Arcade */
      building(s, 9, 3, 3, 3, 2);   /* Hotel */
      scatter(s.grid, T.SIGN, [[12,7]]);
      for (const c of [[5,4],[10,6]]) { required.push(c); reserved.add(c.join(",")); }   /* arcade, hotel door fronts */
    },
  });

  /* ---- ROBO-CAVERNS ---- */
  genScreen("1,-1", {
    zone: "cavern", floor: T.CAVE_FLOOR, wall: T.CAVE_WALL,
    openings: { s: true, e: true },
    clusterTile: T.CAVE_WALL, clusters: [3, 5],
    decor: [[T.CRYSTAL, 2, 4]],
    rocks: 1, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["molebot", "glowbat"],
  });
  genScreen("2,-1", {
    zone: "cavern", floor: T.CAVE_FLOOR, wall: T.CAVE_WALL,
    openings: { w: true, s: true, e: true },
    clusterTile: T.CAVE_WALL, clusters: [3, 5],
    decor: [[T.CRYSTAL, 2, 4]],
    pond: true, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["molebot", "glowbat"],
  });
  genScreen("3,-1", {
    zone: "cavern", floor: T.CAVE_FLOOR, wall: T.CAVE_WALL,
    openings: { w: true, s: true, e: true },
    clusterTile: T.CAVE_WALL, clusters: [3, 6],
    decor: [[T.CRYSTAL, 2, 4]],
    rocks: 1, enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["molebot", "glowbat"],
    fixed: (s, reserved, required) => {
      const spots = [[8,2],[10,3],[5,2],[12,3],[8,3]];
      const [bx, by] = spots[R.int(spots.length)];
      s.enemies.push({ type: "drillmaster", x: bx, y: by, boss: "cavern" });
      reserved.add(bx + "," + by);
      required.push([bx, by]);
    },
  });

  /* ---- NUMBER RIDGE (east of the city) ---- */
  const bossSpot = (type, id, spots) => (s, reserved, required) => {
    const [bx, by] = spots[R.int(spots.length)];
    s.enemies.push({ type, x: bx, y: by, boss: id });
    reserved.add(bx + "," + by);
    required.push([bx, by]);
  };
  const signAt = (x, y) => (s, reserved) => { s.grid[y][x] = T.SIGN; reserved.add(x + "," + y); };
  genScreen("4,0", {
    zone: "ridge", floor: T.FLOOR, wall: T.WALL,
    openings: { w: true, e: true, s: true },
    clusterTile: T.WALL, clusters: [2, 4],
    decor: [[T.TREE, 2, 4], [T.BUSH, 1, 2]],
    rocks: 2, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["rockroller", "billybot"],
    fixed: (s, reserved, required) => {
      signAt(2, 2)(s, reserved);
      building(s, 11, 2, 3, 2, 1);   /* Ranger Cabin */
      required.push([12, 4]); reserved.add("12,4");
    },
  });
  genScreen("5,0", {
    zone: "ridge", floor: T.FLOOR, wall: T.WALL,
    openings: { w: true },
    clusterTile: T.WALL, clusters: [3, 5],
    decor: [[T.TREE, 2, 4]],
    pond: true, enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["rockroller", "billybot"],
    fixed: bossSpot("ridgeram", "ridge", [[12,4],[12,5],[11,3],[13,6],[10,2]]),
  });

  /* ---- GRAPH GARDENS (east of the caverns) ---- */
  genScreen("4,-1", {
    zone: "gardens", floor: T.FLOOR, wall: T.WALL,
    openings: { w: true, e: true },
    clusterTile: T.BUSH, clusters: [3, 5],
    decor: [[T.FLOWERS, 4, 7], [T.TREE, 1, 3]],
    pond: true, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["bramblebug", "buzzbee"],
    fixed: (s, reserved, required) => {
      signAt(2, 2)(s, reserved);
      building(s, 10, 6, 3, 2, 2);   /* Greenhouse */
      required.push([11, 8]); reserved.add("11,8");
    },
  });
  genScreen("5,-1", {
    zone: "gardens", floor: T.FLOOR, wall: T.WALL,
    openings: { w: true },
    clusterTile: T.BUSH, clusters: [3, 5],
    decor: [[T.FLOWERS, 4, 7], [T.TREE, 1, 3]],
    rocks: 1, enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["bramblebug", "buzzbee"],
    fixed: bossSpot("thistlequeen", "gardens", [[12,4],[12,5],[11,3],[13,6],[10,7]]),
  });

  /* ---- SHAPE FACTORY (south of Number Ridge) ---- */
  genScreen("4,1", {
    zone: "factory", floor: T.FLOOR, wall: T.WALL,
    openings: { n: true, e: true },
    clusterTile: T.WALL, clusters: [3, 5],
    decor: [[T.LAMP, 2, 3], [T.CRYSTAL, 1, 2]],
    rocks: 1, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["gizmobot", "sprocket"],
    fixed: (s, reserved, required) => {
      signAt(2, 2)(s, reserved);
      building(s, 9, 2, 4, 2, 3);    /* Assembly Hall */
      required.push([10, 4]); reserved.add("10,4");
    },
  });
  genScreen("5,1", {
    zone: "factory", floor: T.FLOOR, wall: T.WALL,
    openings: { w: true },
    clusterTile: T.WALL, clusters: [3, 5],
    decor: [[T.LAMP, 2, 3], [T.CRYSTAL, 1, 2]],
    pond: true, enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["gizmobot", "sprocket"],
    fixed: bossSpot("shapeshifter", "factory", [[12,4],[12,5],[11,3],[13,6],[10,7]]),
  });

  /* conveyor belts in the Shape Factory: they slide the hero along when he stands still */
  function addBelts(key, n) {
    const s = W[key], g = s.grid;
    const busy = new Set([...s.enemies.map(e => e.x + "," + e.y), ...s.pickups.map(p => p.x + "," + p.y),
                          ...Object.values(DOORS).filter(d => d.to === key).map(d => d.x + "," + d.y)]);   /* never under a doorway */
    let placed = 0;
    for (let tries = 0; tries < 80 && placed < n; tries++) {
      const y = R.between(2, 8), x0 = R.between(2, 8), len = R.between(4, 6);
      let okRun = true;
      for (let x = x0; x < x0 + len; x++)
        if (x > 13 || g[y][x] !== T.FLOOR || busy.has(x + "," + y) || g[y - 1][x] === T.BELT_R || g[y - 1][x] === T.BELT_L ||
            g[y + 1][x] === T.BELT_R || g[y + 1][x] === T.BELT_L) okRun = false;
      if (!okRun) continue;
      const t = R.chance(.5) ? T.BELT_R : T.BELT_L;
      for (let x = x0; x < x0 + len; x++) g[y][x] = t;
      placed++;
    }
  }
  addBelts("4,1", 2);
  addBelts("5,1", 2);

  /* ---- VILLAIN'S TOWER ---- */
  genScreen("1,1", {
    zone: "tower", floor: T.TOWER_FLOOR, wall: T.TOWER_WALL,
    openings: { n: true, e: true },
    clusterTile: T.TOWER_WALL, clusters: [3, 5],
    decor: [[T.LAMP, 1, 2], [T.CRYSTAL, 0, 2]],
    enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["knightbot", "sparkghost"],
    fixed: (s, reserved, required) => {
      building(s, 10, 6, 3, 2, 3);   /* Guard Room */
      required.push([11, 8]); reserved.add("11,8");
    },
  });
  genScreen("2,1", {
    zone: "tower", floor: T.TOWER_FLOOR, wall: T.TOWER_WALL,
    openings: { w: true, n: true, e: true },
    clusterTile: T.TOWER_WALL, clusters: [3, 5],
    decor: [[T.LAMP, 1, 2], [T.CRYSTAL, 0, 1]],
    rocks: 1, enemies: 2, hpBonus: true, pickupN: 1, enemyTypes: ["knightbot", "sparkghost"],
    fixed: (s, reserved, required) => {
      scatter(s.grid, T.SIGN, [[8,8]]);   /* the lair door */
      reserved.add("8,8");
      required.push([8,9]);               /* must be able to reach the door */
    },
  });
  genScreen("3,1", {
    zone: "tower", floor: T.TOWER_FLOOR, wall: T.TOWER_WALL,
    openings: { w: true, n: true },
    clusterTile: T.TOWER_WALL, clusters: [3, 5],
    decor: [[T.LAMP, 1, 2], [T.CRYSTAL, 0, 2]],
    enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["knightbot", "sparkghost"],
    fixed: (s, reserved, required) => {
      /* the Golden Key + its Keeper, somewhere fresh each game */
      for (let tries = 0; tries < 30; tries++) {
        const cell = takeCell(s, reserved);
        if (!cell) break;
        const [kx, ky] = cell;
        const adj = [[kx+1,ky],[kx-1,ky],[kx,ky+1],[kx,ky-1]]
          .filter(([x,y]) => x>0 && x<COLS-1 && y>0 && y<ROWS-1 &&
                  !SOLID.has(s.grid[y][x]) && !PROTECTED.has(x+","+y) && !reserved.has(x+","+y));
        if (!adj.length) continue;
        const [gx, gy] = adj[R.int(adj.length)];
        s.pickups.push({ x: kx, y: ky, kind: "key" });
        s.enemies.push({ type: "knightbot", x: gx, y: gy, hpBonus: 1, name: "Key Keeper", still: true, guardsKey: true });
        reserved.add(gx + "," + gy);
        required.push([kx, ky], [gx, gy]);
        return;
      }
      throw new Error("key placement failed");
    },
  });

  /* ---- WISHING LAKE (0,-1): only a hero with FLIGHT can cross ---- */
  {
    const s = mk(blankScreen(T.FLOOR), "base");
    s.label = "🌊 Wishing Lake"; s.battleZone = "sky";
    const g = s.grid;
    border(g, T.TREE, { n: true });
    g[ROWS-1][12] = T.FLOOR; g[ROWS-1][13] = T.FLOOR;   /* back down to Hero Base */
    for (let y = 4; y <= 6; y++) for (let x = 1; x <= 14; x++) g[y][x] = T.WATER;
    scatter(g, T.FLOWERS, [[2,8],[4,9],[9,9],[14,8],[3,2],[12,1]]);
    scatter(g, T.TREE, [[1,8],[1,9],[14,9]]);
    scatter(g, T.SIGN, [[10,8], [5,2]]);
    s.pickups.push({ x: 4, y: 5, kind: "part" }, { x: 11, y: 4, kind: "part" });   /* floating on the lake */
    W["0,-1"] = s;
  }
  /* ---- SKY ISLES (0,-2 and 0,-3) ---- */
  genScreen("0,-2", {
    zone: "sky", floor: T.FLOOR, wall: T.WALL,
    openings: { n: true, s: true },
    clusterTile: T.WALL, clusters: [2, 4],
    decor: [[T.BUSH, 2, 4]],
    enemies: 2, hpBonus: true, pickupN: 2, enemyTypes: ["puffcloud", "ticktock"],
    fixed: (s, reserved, required) => {
      const st = STATIONS.find(q => q.id === "time");
      s.grid[st.y][st.x] = T.STATION; reserved.add(st.x + "," + st.y);
      required.push([st.x, st.y + 1]); reserved.add(st.x + "," + (st.y + 1));
      signAt(11, 8)(s, reserved);
    },
  });
  genScreen("0,-3", {
    zone: "sky", floor: T.FLOOR, wall: T.WALL,
    openings: { s: true },
    clusterTile: T.WALL, clusters: [2, 4],
    decor: [[T.BUSH, 2, 3]],
    enemies: 3, hpBonus: true, pickupN: 2, enemyTypes: ["puffcloud", "ticktock"],
    fixed: (s, reserved, required) => {
      building(s, 10, 1, 3, 3, 0);   /* the Clock Tower */
      for (const c of ["9,1","9,2","9,3","13,1","13,2","13,3","10,4","11,4","12,4"]) reserved.add(c);
      signAt(3, 8)(s, reserved);
    },
  });

  /* ============ MINI-DUNGEONS (walk-in buildings) ============
     A front room with enemies, a 🧩 PUZZLE DOOR, and a back room with a big
     treasure chest. Template A splits the room left/right, B front/back.
     Every dungeon has its own size, shape and colors. */
  function dungeon(id, label, style, zone, template, enemyTypes, shape, decor) {
    const s = room(label, style, shape);
    s.battleZone = zone; s.dungeon = true;
    const g = s.grid;
    const { l, t, r } = shape;
    const bonus = zone === "city" ? undefined : 1;
    const isFloor = ([x, y]) => g[y] && g[y][x] === T.IN_FLOOR && !(x === 8 && y === 9);
    const firstFloor = cands => cands.find(isFloor);
    let enemySpots;
    if (template === "A") {
      const wx = r - 4, my = Math.floor((t + 9) / 2);
      for (let y = t; y <= 9; y++) g[y][wx] = T.IN_WALL;
      g[my][wx] = T.PUZZLE_DOOR;
      g[my][r - 1] = T.CHEST;
      s.pickups.push({ x: r - 2, y: t, kind: "part" }, { x: r - 2, y: 9, kind: "donut" });
      enemySpots = [firstFloor([[l + 1, t + 1], [l + 2, t + 2], [l + 1, 7], [5, 5]]),
                    firstFloor([[wx - 2, 7], [wx - 3, 6], [wx - 2, 5]])];
    } else {
      const wy = t + 3;
      for (let x = l; x <= r; x++) g[wy][x] = T.IN_WALL;
      g[wy][8] = T.PUZZLE_DOOR;
      g[t + 1][r - 2] = T.CHEST;
      s.pickups.push({ x: l + 1, y: t + 1, kind: "part" }, { x: l + 3, y: t, kind: "donut" });
      enemySpots = [firstFloor([[l + 1, wy + 2], [l + 2, wy + 3], [l + 1, wy + 1]]),
                    firstFloor([[r - 1, wy + 1], [r - 2, wy + 2], [r - 1, wy + 3]])];
    }
    for (const [tile, spots] of decor) for (const [x, y] of spots) if (g[y] && g[y][x] === T.IN_FLOOR) g[y][x] = tile;
    enemySpots.forEach((sp, i) => { if (sp && g[sp[1]][sp[0]] === T.IN_FLOOR)
      s.enemies.push({ type: enemyTypes[i % enemyTypes.length], x: sp[0], y: sp[1], hpBonus: bonus }); });
    W[id] = s;
  }
  const CITYFOES = ["gremlin", "scrapbot"];
  dungeon("bank", "🏦 Bolt Bank",
          { floor: "#ece6d6", floor2: "#d8d0b8", wall: "#7a6a3a", trim: "#ffd32a", pattern: "checker" },
          "city", "B", CITYFOES, { l: 2, t: 1, r: 13 },
          [[T.COUNTER, [[3,7],[4,7],[11,9],[12,9]]], [T.SHELF, [[10,1],[12,1]]]]);
  dungeon("toyshop", "🧸 Toy Shop",
          { floor: "#ffd0e8", floor2: "#ffffff", wall: "#c94a8a", trim: "#ffd32a", pattern: "carpet", deco: "sprinkle" },
          "city", "A", CITYFOES, { l: 4, t: 3, r: 13 },
          [[T.SHELF, [[5,3],[6,3],[7,3]]], [T.RUG, [[5,8],[6,8]]]]);
  dungeon("geargarage", "⚙️ Gear Garage",
          { floor: "#a8a8b0", floor2: "#9c9ca4", wall: "#5b5b68", trim: "#ff4757", pattern: "tiles", deco: "oil" },
          "city", "B", ["scrapbot", "scrapbot"], { l: 1, t: 2, r: 14 },
          [[T.COUNTER, [[1,9],[2,9],[13,9],[14,9]]], [T.SHELF, [[13,2],[14,2]]]]);
  dungeon("arcade", "🕹️ Robo Arcade",
          { floor: "#2a2a55", floor2: "#ff6bd5", wall: "#a55eea", trim: "#29d9ff", pattern: "carpet" },
          "city", "A", CITYFOES, { l: 1, t: 1, r: 14, cuts: [[1, 1, 3, 3]] },
          [[T.TV, [[4,1],[5,1],[6,1],[8,1]]], [T.LAMP, [[1,9]]]]);
  dungeon("hotel", "🏨 Hotel Bolt",
          { floor: "#a83a3a", floor2: "#d8a040", wall: "#3d6a70", trim: "#ffd32a", pattern: "carpet" },
          "city", "B", CITYFOES, { l: 4, t: 1, r: 11 },
          [[T.BED, [[10,1],[11,1]]], [T.RUG, [[6,7],[7,7],[9,7]]], [T.LAMP, [[4,5],[11,5]]]]);
  dungeon("cabin", "🛖 Ranger Cabin",
          { floor: "#a8814f", floor2: "#8f6a3c", wall: "#5a3a1e", trim: "#3f7a3a", pattern: "planks" },
          "ridge", "A", ["rockroller", "billybot"], { l: 5, t: 4, r: 13 },
          [[T.SHELF, [[5,4],[6,4]]], [T.RUG, [[5,8],[6,8]]]]);
  dungeon("greenhouse", "🌱 Greenhouse",
          { floor: "#a8d890", floor2: "#90c078", wall: "#3f7a3a", trim: "#d8ffe6", pattern: "tiles" },
          "gardens", "B", ["bramblebug", "buzzbee"], { l: 1, t: 3, r: 14 },
          [[T.FLOWERS, [[4,8],[5,9],[11,9],[2,5],[6,3]]], [T.BUSH, [[14,9],[1,9]]]]);
  dungeon("assembly", "🏭 Assembly Hall",
          { floor: "#9aa6ba", floor2: "#8592a8", wall: "#4a5468", trim: "#f0a020", pattern: "stripes", deco: "oil" },
          "factory", "A", ["gizmobot", "sprocket"], { l: 1, t: 1, r: 14 },
          [[T.COUNTER, [[3,3],[4,3],[5,3],[3,7],[4,7]]], [T.LAMP, [[9,1]]]]);
  dungeon("guardroom", "💂 Guard Room",
          { floor: "#3a3a55", floor2: "#2c2c44", wall: "#22223a", trim: "#ff4757", pattern: "checker" },
          "tower", "B", ["knightbot", "sparkghost"], { l: 4, t: 1, r: 11 },
          [[T.LAMP, [[11,1],[4,9],[11,9]]]]);

  /* ============ INTERIORS (fixed) ============ */
  {
    const s = room("🏠 Hero House",
      { floor: "#c9a06a", floor2: "#b8905c", wall: "#6e4a26", trim: "#8a5f34", pattern: "planks" });
    s.critters.push({ x: 8, y: 4, sprite: "dog", name: "Bear" },
                     { x: 5, y: 6, sprite: "cat", name: "Mimi" });
    const g = s.grid;
    scatter(g, T.BED, [[2,2],[3,2]]);
    scatter(g, T.SHELF, [[1,4],[1,5]]);
    scatter(g, T.TV, [[6,4],[7,4]]);
    scatter(g, T.RUG, [[7,6],[8,6],[7,7],[8,7]]);
    g[COMPANION_BED.y][COMPANION_BED.x] = T.BED;   /* the rescued friend's bed */
    for (let i = 0; i < 5; i++) g[TROPHY_CASE_Y][TROPHY_CASE_X + i] = T.TROPHY;
    for (let i = 0; i < 3; i++) g[BOSS_CASE_Y][BOSS_CASE_X + i] = T.BOSS_CASE;
    s.pickups.push({ x: 12, y: 8, kind: "part" }, { x: 3, y: 8, kind: "donut" });
    W["hero_house"] = s;
  }
  {
    const s = room("🤖 Robo-Garage",
      { floor: "#9ea3ad", floor2: "#8f949e", wall: "#3d4f6a", trim: "#ffd32a", pattern: "tiles", deco: "oil" },
      { l: 2, t: 3, r: 13 });
    const g = s.grid;
    scatter(g, T.COUNTER, [[3,4],[4,4]]);          /* free recharge station */
    scatter(g, T.BIKE, [[7,4],[8,4]]);             /* the hover-bike */
    scatter(g, T.PAINT, [[11,4],[12,4]]);          /* paint booth */
    scatter(g, T.SHELF, [[13,7],[13,8]]);
    s.pickups.push({ x: 3, y: 8, kind: "part" });
    W["garage"] = s;
  }
  {
    const s = room("🔢 Math Mart",
      { floor: "#d8f0e0", floor2: "#ffffff", wall: "#3d6a70", trim: "#2ed573", pattern: "tiles" },
      { l: 2, t: 2, r: 13 });
    const g = s.grid;
    scatter(g, T.SHELF, [[3,3],[4,3],[5,3],[6,3],[9,3],[10,3],[11,3],[12,3],
                         [3,6],[4,6],[5,6],[6,6],[9,6],[10,6],[11,6],[12,6]]);
    scatter(g, T.COUNTER, [[13,8],[12,8]]);
    s.enemies.push({ type: "gremlin", x: 8, y: 4 });
    s.pickups.push({ x: 2, y: 8, kind: "part" }, { x: 7, y: 8, kind: "part" });
    W["mart"] = s;
  }
  {
    const s = room("🛋️ Comfy Corner Furniture",
      { floor: "#ead7f2", floor2: "#f6ecfa", wall: "#7a4a8a", trim: "#ffb347", pattern: "carpet" },
      { l: 3, t: 3, r: 12 });
    const g = s.grid;
    scatter(g, T.COUNTER, [[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4]]);
    scatter(g, T.SHELF, [[4,3],[11,3]]);
    s.decorMap = { "4,6": "couch", "11,6": "fish", "4,8": "rocket", "11,8": "planet", "6,6": "teddy", "9,6": "plant" };
    for (const k in s.decorMap) { const [x, y] = k.split(",").map(Number); g[y][x] = T.DECOR; }
    s.vendor = { x: 7, y: 3, name: "Penny Pillow", sprite: "woman" };
    s.enemies.push({ type: "gremlin", x: 9, y: 8, name: "Couch Crusher", hpBonus: 2, storeBully: true });
    W["furniture"] = s;
  }
  {
    const s = room("📚 City Library",
      { floor: "#8a6a40", floor2: "#7a5c36", wall: "#4d3319", trim: "#a87f4d", pattern: "planks" },
      { l: 1, t: 1, r: 14, cuts: [[1, 1, 4, 3]] });
    const g = s.grid;
    scatter(g, T.SHELF, [[6,2],[7,2],[8,2],[10,2],[11,2],[12,2],[13,2],
                         [2,5],[3,5],[4,5],[7,5],[8,5],[9,5],[11,5],[12,5],[13,5]]);
    scatter(g, T.RUG, [[7,7],[8,7]]);
    g[8][2] = T.CHEST;   /* a puzzle chest hidden among the books */
    s.pickups.push({ x: 13, y: 8, kind: "part" });
    W["library"] = s;
  }
  {
    const s = room("🍩 Donut Depot",
      { floor: "#ffd9e0", floor2: "#fff0f4", wall: "#d64a6a", trim: "#ffffff", pattern: "checker", deco: "sprinkle" },
      { l: 3, t: 3, r: 12 });
    const g = s.grid;
    scatter(g, T.COUNTER, [[4,4],[5,4],[6,4],[7,4]]);
    scatter(g, T.SHELF, [[10,4],[11,4],[12,4]]);
    s.enemies.push({ type: "gremlin", x: 10, y: 7, name: "Donut Thief", hpBonus: 1 });
    s.pickups.push({ x: 4, y: 7, kind: "donut" }, { x: 9, y: 6, kind: "donut" },
                   { x: 12, y: 8, kind: "donut" });
    W["depot"] = s;
  }
  {
    const s = room("👑 Robo-Baron's Lair",
      { floor: "#3a3a55", floor2: "#333349", wall: "#22223a", trim: "#a55eea", pattern: "checker" });
    s.zone = "tower";
    const g = s.grid;
    for (let x = 3; x <= 12; x++) g[1][x] = T.IN_WALL;
    scatter(g, T.LAMP, [[2,2],[13,2]]);
    s.enemies.push({ type: "robobaron", x: 7, y: 4, boss: "baron" });
    W["lair"] = s;
  }
  {
    const s = room("🔧 Rita's Workshop",
      { floor: "#8a8a95", floor2: "#7c7c88", wall: "#4d4d58", trim: "#ff9f43", pattern: "tiles", deco: "oil" },
      { l: 5, t: 5, r: 10 });
    const g = s.grid;
    scatter(g, T.COUNTER, [[6,7],[7,7],[8,7],[9,7]]);
    scatter(g, T.SHELF, [[5,5],[10,5]]);
    scatter(g, T.LAMP, [[5,9],[10,9]]);
    s.critters.push({ x: 7, y: 6, sprite: "rita", name: "Rita", still: true, shop: true });
    W["workshop"] = s;
  }

  /* extra edge alignments for manually opened borders */
  W["2,0"].grid[0][7] = T.ROAD; W["2,0"].grid[0][8] = T.ROAD;
  W["2,1"].grid[0][7] = T.TOWER_FLOOR; W["2,1"].grid[0][8] = T.TOWER_FLOOR;
  W["2,0"].grid[ROWS-1][7] = T.ROAD; W["2,0"].grid[ROWS-1][8] = T.ROAD;
  W["2,-1"].grid[ROWS-1][7] = T.CAVE_FLOOR; W["2,-1"].grid[ROWS-1][8] = T.CAVE_FLOOR;
  W["3,0"].grid[0][7] = T.ROAD; W["3,0"].grid[0][8] = T.ROAD;
  W["3,-1"].grid[ROWS-1][7] = T.CAVE_FLOOR; W["3,-1"].grid[ROWS-1][8] = T.CAVE_FLOOR;
  W["3,0"].grid[ROWS-1][7] = T.ROAD; W["3,0"].grid[ROWS-1][8] = T.ROAD;
  W["3,1"].grid[0][7] = T.TOWER_FLOOR; W["3,1"].grid[0][8] = T.TOWER_FLOOR;

  /* --- GATES last, so nothing paves over them --- */
  for (const [zone, tiles] of Object.entries(GATE_TILES))
    for (const [k, x, y] of tiles) W[k].grid[y][x] = T.GATE;

  return W;
}

/* Where each zone's gate stands: [screen, x, y] */
const GATE_TILES = {
  city:    [["0,0", 15, 4], ["0,0", 15, 5]],
  ridge:   [["3,0", 15, 4], ["3,0", 15, 5]],
  cavern:  [["1,0", 7, 0], ["1,0", 8, 0], ["2,0", 7, 0], ["2,0", 8, 0], ["3,0", 7, 0], ["3,0", 8, 0]],
  gardens: [["3,-1", 15, 4], ["3,-1", 15, 5]],
  factory: [["4,0", 7, 10], ["4,0", 8, 10]],
  tower:   [["1,0", 7, 10], ["1,0", 8, 10], ["2,0", 7, 10], ["2,0", 8, 10], ["3,0", 7, 10], ["3,0", 8, 10]],
};
const GATE_AT = {};
for (const [zone, tiles] of Object.entries(GATE_TILES))
  for (const [k, x, y] of tiles) GATE_AT[k + ":" + x + "," + y] = zone;

/* Doors: walking into these tiles teleports (enterable buildings!) */
const DOORS = {
  "0,0:7,2":         { to: "workshop", x: 8, y: 9 },
  "workshop:8,10":   { to: "0,0", x: 7, y: 3 },
  "2,1:8,8":         { to: "lair", x: 8, y: 9 },
  "lair:8,10":       { to: "2,1", x: 8, y: 9 },
  "0,0:3,8":   { to: "hero_house", x: 8, y: 9 },
  "0,0:12,8":  { to: "garage",     x: 8, y: 9 },
  "1,0:4,3":   { to: "mart",       x: 8, y: 9 },
  "2,0:5,4":   { to: "depot",      x: 8, y: 9 },
  "2,0:10,8":  { to: "library",    x: 8, y: 9 },
  "2,0:11,2":  { to: "furniture",  x: 8, y: 9 },
  "furniture:8,10":  { to: "2,0", x: 11, y: 3 },
  "hero_house:8,10": { to: "0,0", x: 3,  y: 9 },
  "garage:8,10":     { to: "0,0", x: 12, y: 9 },
  "mart:8,10":       { to: "1,0", x: 4,  y: 4 },
  "depot:8,10":      { to: "2,0", x: 5,  y: 5 },
  "library:8,10":    { to: "2,0", x: 10, y: 9 },
  /* mini-dungeons */
  "1,0:11,3":  { to: "bank",       x: 8, y: 9 },  "bank:8,10":       { to: "1,0", x: 11, y: 4 },
  "1,0:4,8":   { to: "toyshop",    x: 8, y: 9 },  "toyshop:8,10":    { to: "1,0", x: 4,  y: 9 },
  "1,0:11,8":  { to: "geargarage", x: 8, y: 9 },  "geargarage:8,10": { to: "1,0", x: 11, y: 9 },
  "3,0:5,3":   { to: "arcade",     x: 8, y: 9 },  "arcade:8,10":     { to: "3,0", x: 5,  y: 4 },
  "3,0:10,5":  { to: "hotel",      x: 8, y: 9 },  "hotel:8,10":      { to: "3,0", x: 10, y: 6 },
  "4,0:12,3":  { to: "cabin",      x: 8, y: 9 },  "cabin:8,10":      { to: "4,0", x: 12, y: 4 },
  "4,-1:11,7": { to: "greenhouse", x: 8, y: 9 },  "greenhouse:8,10": { to: "4,-1", x: 11, y: 8 },
  "4,1:10,3":  { to: "assembly",   x: 8, y: 9 },  "assembly:8,10":   { to: "4,1", x: 10, y: 4 },
  "1,1:11,7":  { to: "guardroom",  x: 8, y: 9 },  "guardroom:8,10":  { to: "1,1", x: 11, y: 8 },
};

/* Sign / door messages (keyed "screenKey:x,y") */
const MESSAGES = {
  "0,0:3,5":  "⬅ Practice Park (earn BADGES to open new places!) • City Streets ➡",
  "0,0:9,3":  "🔧 THE WORKSHOP — Rita the Robo-Mechanic fixes and upgrades hero suits!",
  "0,0:5,7":  "🏠 HERO HOUSE — this is where you live! Your TROPHY CASE is inside. Walk into the door to go in!",
  "0,0:10,7": "🤖 ROBO-GARAGE — free suit RECHARGE, the HOVER-BIKE bay, and the PAINT SHOP for new suit colors!",
  "-1,0:13,5": "🎈 PRACTICE PARK — only the GLOWING stations are open right now: those are the badges you need next! Win a badge with 3 right answers. 🔒 Locked stations open later, after you beat bosses.",
  "1,0:6,3":  "🔢 MATH MART — everything for the counting hero! Come on in!",
  "mart:12,8": "🔢 The cashier says: \"We only sell MATH stuff here! For furniture, try COMFY CORNER on the next street ➡\"",
  "mart:13,8": "🔢 The cashier says: \"We only sell MATH stuff here! For furniture, try COMFY CORNER on the next street ➡\"",
  "0,0:14,2": "⬆ WISHING LAKE and the SKY ISLES! (Only heroes who can FLY 🕊️ can cross the lake.)",
  "0,-1:10,8": "🌊 WISHING LAKE — too deep to swim! A hero with FLIGHT 🕊️ can fly across to the SKY ISLES. (Rita sells FLIGHT.)",
  "0,-1:5,2": "☁️ ⬆ SKY ISLES — learn to read clocks at the Clock Tower TIME station!",
  "0,-2:11,8": "☁️ SKY ISLES — the 🕐 TIME station teaches clocks. The CLOCK TOWER is further north ⬆",
  "0,-3:3,8": "🕰️ THE CLOCK TOWER — it keeps time for all of Math City. Tick... tock...",
  "1,0:9,7":  "⚙️ GEAR GARAGE, BOLT BANK, TOY SHOP — every door in town opens now! Watch out for gremlins inside, and look for 🧩 PUZZLE DOORS!",
  "2,0:7,4":  "🍩 DONUT DEPOT — HELP! A Gear-Gremlin is inside stealing donuts!",
  "2,0:8,6":  "📚 CITY LIBRARY — shhh! Robots reading. Door's open!",
  "2,0:8,2":  "⬆ Robo-Caverns • Villain's Tower ⬇",
  "3,0:12,7": "➡ NUMBER RIDGE is east!  ⬆ Robo-Caverns  ⬇ Villain's Tower",
  "4,0:2,2":  "⛰️ NUMBER RIDGE — count by 10s all the way up! The Rockslide Ram waits at the top (east). ⬇ The Shape Factory is south.",
  "4,-1:2,2": "🌻 SECRET GARDENS — only TRUE heroes get in! Tricky adding and equations grow here. The Thistle Queen rules the far end (east).",
  "4,1:2,2":  "🏭 SHAPE FACTORY — halves, fourths, and mirrors! The Shape-Shifter is in the back (east).",
  "hero_house:2,2":  "Your bed! It's extra bouncy.",
  "hero_house:1,4": "Comic books about the Mighty Robo-Rangers. Cool!",
  "hero_house:1,5": "More comics! \"Robo-Rangers #10: The Ten-Ton Takeaway!\"",
  "workshop:5,5": "Shelves packed with wrenches, springs, and spare zap coils!",
  "workshop:10,5": "A trophy: 'RITA — BEST ROBO-MECHANIC IN MATH CITY, 5 YEARS RUNNING!'",
  "garage:13,7": "Robot joke: why did the robot go back to school? Its skills were getting RUSTY! 🤖",
  "garage:13,8": "Robot joke: what do robots eat for a snack? MICRO-chips! 🤖",
  "hero_house:6,4": "📺 The Robo-Rangers cartoon is on! \"MATH POWER, ACTIVATE!\"",
  "hero_house:7,4": "📺 A robot on TV is counting donuts. One... two... THREE donuts!",
  "hero_house:3,2": "Your bed is SO bouncy. Boing, boing, boing!",
  "mart:4,3":    "Shelves of number blocks, count-o-scopes, and calculator candy!",
  "library:8,2": "A book called 'Counting for Heroes.' Nice choice!",
  "depot:4,4":   "The donut case is EMPTY! That gremlin over there took them ALL!",
};

/* Text labels drawn on the canvas above buildings (keyed by screen) */
const LABELS = {
  "0,0":  [ { x: 7.5, y: 0.8, text: "WORKSHOP" },
            { x: 3.5, y: 6.8, text: "HERO HOUSE" },
            { x: 12.5,y: 6.8, text: "ROBO-GARAGE" } ],
  "-1,0": STATIONS.filter(st => !st.screen).map(st => ({ x: st.x + .5, y: st.y - .15, text: st.label }))
            .concat(STATIONS.filter(st => !st.screen).map(st => ({ x: st.x + .5, y: st.y + 1.38, text: "→ " + GATES[st.zone].short, small: true, color: GATES[st.zone].color })))
            .concat([{ x: 8, y: 4.75, text: "PRACTICE PARK" }]),
  "hero_house": [ { x: 7.5, y: .72, text: "TROPHY CASE" }, { x: 12.5, y: .72, text: "BOSS TROPHIES" } ],
  "garage": [ { x: 4, y: 3.72, text: "RECHARGE" }, { x: 8, y: 3.72, text: "HOVER-BIKE" }, { x: 12, y: 3.72, text: "PAINT SHOP" } ],
  "1,0":  [ { x: 4.5,  y: 1.8, text: "MATH MART" },
            { x: 11.5, y: 1.8, text: "BOLT BANK" },
            { x: 4.5,  y: 6.8, text: "TOY SHOP" },
            { x: 11.5, y: 6.8, text: "GEAR GARAGE" } ],
  "0,-2": STATIONS.filter(st => st.screen === "0,-2").map(st => ({ x: st.x + .5, y: st.y - .15, text: st.label })),
  "0,-3": [ { x: 11.5, y: 0.8, text: "CLOCK TOWER" } ],
  "furniture": [ { x: 7.5, y: 2.7, text: "PENNY'S COUNTER" } ],
  "2,0":  [ { x: 11.5, y: 0.8, text: "FURNITURE" },
            { x: 5.5,  y: 1.8, text: "DONUT DEPOT" },
            { x: 10.5, y: 5.8, text: "LIBRARY" } ],
  "3,0":  [ { x: 5,    y: 1.8, text: "ARCADE" },
            { x: 10.5, y: 2.8, text: "HOTEL" } ],
  "4,0":  [ { x: 12.5, y: 1.8, text: "RANGER CABIN" } ],
  "4,-1": [ { x: 11.5, y: 5.8, text: "GREENHOUSE" } ],
  "4,1":  [ { x: 11,   y: 1.8, text: "ASSEMBLY HALL" } ],
  "1,1":  [ { x: 11.5, y: 5.8, text: "GUARD ROOM" } ],
};
/* outdoor screens that get one puzzle-locked treasure chest */
const CHEST_SCREENS = ["2,0", "3,0", "1,-1", "2,-1", "5,0", "5,-1", "5,1", "2,1", "0,-2", "0,-3"];

