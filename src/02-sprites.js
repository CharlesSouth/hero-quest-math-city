/* ============================ SPRITES ============================ */
/* Pixel-art hero drawn from a 12x16 grid. Palette-swappable.
   Legend: . none | S skin | P primary | Q secondary | V visor | K dark | W white */
const HERO_FRAMES = {
  down: [
    [ // frame 0
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPPK..",
      "..KPVVVVPK..",
      "..KPVSSVPK..",
      "...KPPPPK...",
      "..QQPPPPQQ..",
      ".QPPPPPPPPQ.",
      ".QPPQPPQPPQ.",
      ".SPPPPPPPPS.",
      "..KPPPPPPK..",
      "...QPPPPQ...",
      "...QP..PQ...",
      "...KP..PK...",
      "...KK..KK...",
      "..KK....KK..",
    ],
    [ // frame 1 (walk)
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPPK..",
      "..KPVVVVPK..",
      "..KPVSSVPK..",
      "...KPPPPK...",
      "..QQPPPPQQ..",
      ".QPPPPPPPPQ.",
      ".QPPQPPQPPQ.",
      ".SPPPPPPPPS.",
      "..KPPPPPPK..",
      "...QPPPPQ...",
      "...QP..PQ...",
      "..KP....PK..",
      "..K......K..",
      ".KK......KK.",
    ],
  ],
  up: [
    [
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPPK..",
      "..KPPPPPPK..",
      "..KPQQQQPK..",
      "...KPPPPK...",
      "..QQPPPPQQ..",
      ".QPPQQQQPPQ.",
      ".QPPQQQQPPQ.",
      ".SPPPPPPPPS.",
      "..KPPPPPPK..",
      "...QPPPPQ...",
      "...QP..PQ...",
      "...KP..PK...",
      "...KK..KK...",
      "..KK....KK..",
    ],
    [
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPPK..",
      "..KPPPPPPK..",
      "..KPQQQQPK..",
      "...KPPPPK...",
      "..QQPPPPQQ..",
      ".QPPQQQQPPQ.",
      ".QPPQQQQPPQ.",
      ".SPPPPPPPPS.",
      "..KPPPPPPK..",
      "...QPPPPQ...",
      "...QP..PQ...",
      "..KP....PK..",
      "..K......K..",
      ".KK......KK.",
    ],
  ],
  left: [
    [
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPK...",
      "..KVVVPPK...",
      "..KVSVPPK...",
      "...KPPPK....",
      "..QQPPPQQ...",
      "..QPPPPPQ...",
      "..QPQPPPQ...",
      "..SPPPPPS...",
      "...KPPPK....",
      "...QPPPQ....",
      "...QPPQ.....",
      "...KP.PK....",
      "...KK.KK....",
      "..KK...KK...",
    ],
    [
      "....KKKK....",
      "...KPPPPK...",
      "..KPPPPPK...",
      "..KVVVPPK...",
      "..KVSVPPK...",
      "...KPPPK....",
      "..QQPPPQQ...",
      "..QPPPPPQ...",
      "..QPQPPPQ...",
      "..SPPPPPS...",
      "...KPPPK....",
      "...QPPPQ....",
      "..QP...PQ...",
      "..K.....K...",
      ".KK.....KK..",
      "............",
    ],
  ],
};
/* right = mirrored left, generated below */
HERO_FRAMES.right = HERO_FRAMES.left.map(frame =>
  frame.map(row => row.split("").reverse().join(""))
);

function drawGrid(ctx, grid, colors, px, py, cell) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = colors[ch] || "#f0f";
      ctx.fillRect(px + x * cell, py + y * cell, cell, cell);
    }
  }
}

function drawHero(ctx, px, py, dir, frame, suit, scale, powers) {
  const colors = { S: "#f2c49a", P: suit.primary, Q: suit.secondary, V: suit.visor, K: "#1a1a22", W: "#ffffff" };
  if (powers && powers.invis) {   /* ghostly aura shimmer */
    const a = .12 + (Math.sin(performance.now() / 300) + 1) / 2 * .12;
    ctx.fillStyle = `rgba(41,217,255,${a})`;
    ctx.beginPath(); ctx.arc(px + scale * 6, py + scale * 8, scale * 9.5, 0, 7); ctx.fill();
  }
  if (powers && powers.flight) {   /* wing thrusters! */
    ctx.fillStyle = "#29d9ff";
    ctx.fillRect(px - scale * 1.5, py + scale * 6, scale * 2, scale * 4);
    ctx.fillRect(px + scale * 11.5, py + scale * 6, scale * 2, scale * 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - scale, py + scale * 7, scale, scale * 2);
    ctx.fillRect(px + scale * 12, py + scale * 7, scale, scale * 2);
  }
  drawGrid(ctx, HERO_FRAMES[dir][frame], colors, px, py, scale);
  if (suit.decal && DECALS[suit.decal]) {   /* paint-shop decal on the chest (or back) */
    const ox = dir === "left" ? 3 : dir === "right" ? 6 : 4.5;
    drawGrid(ctx, DECALS[suit.decal].grid, DECAL_COLORS, px + ox * scale, py + 7 * scale, scale);
  }
  if (powers && powers.strength) {   /* golden power gauntlets */
    ctx.fillStyle = "#ffd32a";
    ctx.fillRect(px, py + scale * 8.5, scale * 1.6, scale * 2);
    ctx.fillRect(px + scale * 10.4, py + scale * 8.5, scale * 1.6, scale * 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(px + scale * .3, py + scale * 9, scale * .8, scale);
    ctx.fillRect(px + scale * 10.9, py + scale * 9, scale * .8, scale);
  }
}

/* ---- Civilian sprites (the person to rescue), 12x16, one frame ----
   Legend: H hair/hat, S skin, C top, D bottom, K shoes/dark */
const CIVILIANS = {
  man: {
    label: "Man",
    colors: { H: "#5a3a1e", S: "#f2c49a", C: "#2c6de8", D: "#33415c", K: "#1a1a22" },
    grid: [
      "....HHHH....",
      "...HHHHHH...",
      "...SSSSSS...",
      "...SKSSKS...",
      "...SSSSSS...",
      "....SSSS....",
      "..CCCCCCCC..",
      ".CCCCCCCCCC.",
      ".SCCCCCCCCS.",
      ".SCCCCCCCCS.",
      "..CCCCCCCC..",
      "...DDDDDD...",
      "...DD..DD...",
      "...DD..DD...",
      "...KK..KK...",
      "..KK....KK..",
    ],
  },
  woman: {
    label: "Woman",
    colors: { H: "#7a4a1e", S: "#f2c49a", C: "#ff6b81", D: "#e84a60", K: "#1a1a22" },
    grid: [
      "....HHHH....",
      "...HHHHHH...",
      "..HHSSSSHH..",
      "..HSKSSKSH..",
      "..HSSSSSSH..",
      "..HHSSSSHH..",
      "..HCCCCCCH..",
      "..CCCCCCCC..",
      ".SCCCCCCCCS.",
      ".SCCCCCCCCS.",
      "..CCCCCCCC..",
      ".CCCCCCCCCC.",
      ".CCCCCCCCCC.",
      "...SS..SS...",
      "...KK..KK...",
      "............",
    ],
  },
  boy: {
    label: "Little Boy",
    colors: { H: "#2ed573", S: "#f2c49a", C: "#ffd32a", D: "#33415c", K: "#1a1a22" },
    grid: [
      "............",
      "....HHHH....",
      "...HHHHHH...",
      "...SSSSSS...",
      "...SKSSKS...",
      "...SSSSSS...",
      "....SSSS....",
      "...CCCCCC...",
      "..SCCCCCCS..",
      "..SCCCCCCS..",
      "...CCCCCC...",
      "...DDDDDD...",
      "...DD..DD...",
      "...KK..KK...",
      "............",
      "............",
    ],
  },
  girl: {
    label: "Little Girl",
    colors: { H: "#5a3a1e", S: "#f2c49a", C: "#a55eea", D: "#8e44e8", K: "#1a1a22" },
    grid: [
      "............",
      "..HH.HH.HH..",
      "..HHHHHHHH..",
      "..HHSSSSHH..",
      "..HSKSSKSH..",
      "..HSSSSSSH..",
      "..HH.SS.HH..",
      "...CCCCCC...",
      "..SCCCCCCS..",
      "..CCCCCCCC..",
      ".CCCCCCCCCC.",
      ".CCCCCCCCCC.",
      "...SS..SS...",
      "...KK..KK...",
      "............",
      "............",
    ],
  },
};

/* ---- Friendly critters ---- */
const CRITTER_SPRITES = {
  dog: {   /* Bear: a black dog */
    emoji: "🐕", sound: "Woof woof! *happy tail wags*",
    colors: { A: "#26262e", B: "#111116", E: "#c9722a", K: "#111116", C: "#ff4757", T: "#e88fa8" },
    frames: [
      [
        ".KK......KK.",
        ".KAK....KAK.",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAAAKKAAAK.",
        "..KAATAAAKB.",
        ".KAAAAAAAKB.",
        ".KACAAAACK..",
        ".KAK.KK.KAK.",
        ".KK.......K.",
      ],
      [
        ".KK......KK.",
        ".KAK....KAK.",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAAAKKAAAK.",
        ".BKAATAAAK..",
        ".BKAAAAAAAK.",
        "..KCAAAACAK.",
        ".KAK.KK.KAK.",
        ".K......KK..",
      ],
    ],
  },
  cat: {   /* Mimi: an orange tabby */
    emoji: "🐈", sound: "Meow~ *purrs and rubs against your leg*",
    colors: { A: "#e8933a", B: "#c9722a", E: "#2ed573", K: "#8a4b23", W: "#fff", T: "#e88fa8" },
    frames: [
      [
        ".KK......KK.",
        ".KAK....KAK.",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KABAABAABK.",
        ".KAAATTAAAK.",
        "..KAAAAAAK.B",
        ".KABAABAAKB.",
        ".KAK.KK.KAKB",
        ".KK......KK.",
      ],
      [
        ".KK......KK.",
        ".KAK....KAK.",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KABAABAABK.",
        ".KAAATTAAAK.",
        ".BKAAAAAAK..",
        ".BKABAABAAK.",
        "BKAK.KK.KAK.",
        ".KK......KK.",
      ],
    ],
  },
  rita: {   /* Rita the Robo-Mechanic */
    emoji: "🔧", sound: "",
    colors: { A: "#29b0c9", B: "#ffd32a", E: "#ffffff", K: "#14424d", H: "#ff6b81", W: "#fff" },
    frames: [
      [
        "...HHHHHH...",
        "..HHHHHHHH..",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KAAAAAAAAK.",
        ".KAABBBBAAK.",
        "..KAAAAAAK..",
        ".KBAAAAAABK.",
        "KABAAAAAABAK",
        "KWBAAAAAABAK",
        ".KAAAAAAAAK.",
        "..KAAAAAAK..",
        "..KAK..KAK..",
        "..KAK..KAK..",
        "..KK....KK..",
        "............",
      ],
      [
        "...HHHHHH...",
        "..HHHHHHHH..",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KAAAAAAAAK.",
        ".KAABBBBAAK.",
        "..KAAAAAAK..",
        ".KBAAAAAABK.",
        "KABAAAAAABAK",
        "KABAAAAAABWK",
        ".KAAAAAAAAK.",
        "..KAAAAAAK..",
        "..KAK..KAK..",
        "..KAK..KAK..",
        "..KK....KK..",
        "............",
      ],
    ],
  },
};

/* ---- Enemy sprites (12x12 grids, 2 frames each) ----
   Legend: A body, B accent, E eye, K dark, W white */
const ENEMY_SPRITES = {
  scrapbot: {
    name: "Scrap-Bot", kind: "robot", hp: [1, 3],
    colors: { A: "#9aa0ad", B: "#ff4757", E: "#ffd32a", K: "#2b2f38", W: "#fff", R: "#b8894a", C: "#29d9ff" },
    frames: [
      [
        ".....CK.....",
        "....KKKK....",
        "..KKAAAAKK..",
        ".KAEAARRECK.",
        ".KAAAAAARAK.",
        ".KAWWWWWWAK.",
        "..KAAAARAK..",
        ".KKBBBBBBKK.",
        "KRAKAAAAKARK",
        "KBAKARRAKABK",
        "..KAK..KAK..",
        "..KK....KK..",
      ],
      [
        ".....KC.....",
        "....KKKK....",
        "..KKAAAAKK..",
        ".KAEAARRECK.",
        ".KAAAAAARAK.",
        ".KAWWWWWWAK.",
        "..KAAAARAK..",
        ".KKBBBBBBKK.",
        "KRAKAAAAKARK",
        "KBAKARRAKABK",
        ".KAK....KAK.",
        ".KK......KK.",
      ],
    ],
  },
  gremlin: {
    name: "Gear-Gremlin", kind: "creature", hp: [1, 4],
    colors: { A: "#5fbf60", B: "#2e8b3a", E: "#ffffff", K: "#1e3d22", W: "#fff", G: "#b8894a", P: "#ff8fa3" },
    frames: [
      [
        ".BK......KB.",
        ".KBK....KBK.",
        "..KAAAAAAK..",
        ".KAEKAAKEAK.",
        ".KAEKAAKEAK.",
        ".KAAAPPAAAK.",
        ".KAWKAAKWAK.",
        "..KAAGGAAK..",
        ".KAAGGGGAAKB",
        "KAAKAGGAKAKB",
        "..KAK..KAKB.",
        "..KK....KK..",
      ],
      [
        ".BK......KB.",
        ".KBK....KBK.",
        "..KAAAAAAK..",
        ".KAEKAAKEAK.",
        ".KAEKAAKEAK.",
        ".KAAAPPAAAK.",
        ".KAWKAAKWAK.",
        "..KAAGGAAK..",
        ".KAAGGGGAAK.",
        "KAAKAGGAKAKB",
        ".KAK....KAKB",
        ".KK......KK.",
      ],
    ],
  },
  gremlinking: {
    name: "Gremlin King", kind: "creature", hp: [6, 6],
    colors: { A: "#5fbf60", B: "#2e8b3a", E: "#ffffff", K: "#1e3d22", W: "#ffd32a" },
    frames: [
      [
        ".W..W..W.W..",
        ".WWWWWWWWW..",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KAEAAAAEAK.",
        ".KAAAKKAAAK.",
        ".KAAAAAAAAK.",
        "..KAAAAAAK..",
        ".KAAAAAAAAK.",
        "KAAKAAAAKAAK",
        "..KAK..KAK..",
        "..KK....KK..",
      ],
      [
        ".W..W..W.W..",
        ".WWWWWWWWW..",
        "..KAAAAAAK..",
        ".KAEAAAAEAK.",
        ".KAEAAAAEAK.",
        ".KAAAKKAAAK.",
        ".KAAAAAAAAK.",
        "..KAAAAAAK..",
        ".KAAAAAAAAK.",
        "KAAKAAAAKAAK",
        ".KAK....KAK.",
        ".KK......KK.",
      ],
    ],
  },
  drillmaster: {
    name: "Drillmaster", kind: "robot", hp: [8, 8],
    colors: { A: "#b8894a", B: "#6e4a26", E: "#ff4757", K: "#2b2f38", W: "#cfd4dd" },
    frames: [
      [
        ".....WW.....",
        "....WWWW....",
        "...WWWWWW...",
        "..KKKKKKKK..",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAABBBBAAK.",
        "KBAKAAAAKABK",
        "KBAKAAAAKABK",
        "..KAAAAAAK..",
        "..KAK..KAK..",
        "..KK....KK..",
      ],
      [
        "....WW......",
        "...WWWW.....",
        "...WWWWWW...",
        "..KKKKKKKK..",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAABBBBAAK.",
        "KBAKAAAAKABK",
        "KBAKAAAAKABK",
        "..KAAAAAAK..",
        "..KAK..KAK..",
        ".KK......KK.",
      ],
    ],
  },
  robobaron: {
    name: "Robo-Baron", kind: "robot", hp: [10, 10],
    colors: { A: "#4a4a66", B: "#a55eea", E: "#ff4757", K: "#1a1a26", W: "#ffd32a" },
    frames: [
      [
        ".W.W.WW.W.W.",
        ".WWWWWWWWWW.",
        ".KKKKKKKKKK.",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAAAAAAAAK.",
        ".KABBBBBBAK.",
        "BKAKAAAAKAKB",
        "BKAKAAAAKAKB",
        ".BKAAAAAAKB.",
        "..KAK..KAK..",
        "..KK....KK..",
      ],
      [
        ".W.W.WW.W.W.",
        ".WWWWWWWWWW.",
        ".KKKKKKKKKK.",
        ".KAAAAAAAAK.",
        ".KAEAAAAEAK.",
        ".KAAAAAAAAK.",
        ".KABBBBBBAK.",
        "BKAKAAAAKAKB",
        "BKAKAAAAKAKB",
        ".BKAAAAAAKB.",
        ".KAK....KAK.",
        ".KK......KK.",
      ],
    ],
  },
};

/* ---- Version 2 Phase 3: new zone enemies & bosses (reuse frames, new colors) ---- */
/* ---- every zone has its OWN two bad guys (12x12, 2 frames). A/B are the body colors,
   so golden Champions recolor nicely. alt: "bob" floats up and down, or {row: newRow} ---- */
function zoneFoe(name, kind, colors, rows, alt) {
  const f2 = alt === "bob" ? ["............"].concat(rows.slice(0, 11)) : rows.map((r, i) => (alt && alt[i]) || r);
  return { name, kind, hp: kind === "robot" ? [1, 3] : [1, 4], colors, frames: [rows, f2] };
}
/* Number Ridge */
ENEMY_SPRITES.rockroller = zoneFoe("Rock-Roller", "creature",
  { A: "#a39684", B: "#7a6d5c", E: "#ffffff", K: "#3a332b" }, [
  "....KKKK....",
  "..KKAAAAKK..",
  ".KAABAAAABK.",
  ".KAAAAAAAAK.",
  "KAAEKAAEKAAK",
  "KABAAAAAABAK",
  "KAAAKKKKAAAK",
  "KAAAAAAAAABK",
  ".KABAAAABAK.",
  "..KKAAAAKK..",
  "...KK..KK...",
  "...KK..KK...",
], { 10: "..KK....KK..", 11: "..KK....KK.." });
ENEMY_SPRITES.billybot = zoneFoe("Billy-Bot", "robot",
  { A: "#b8c2cc", B: "#e0a050", E: "#29d9ff", K: "#2b2f38", W: "#ffffff" }, [
  ".BB......BB.",
  "..BB....BB..",
  "...KKKKKK...",
  "..KAAAAAAK..",
  ".KAEKAAEKAK.",
  "..KAAAAAAK..",
  "...KAWWAK...",
  "..KKKAAKKK..",
  ".KAAAAAAAAK.",
  ".KABBAABBAK.",
  ".K.K....K.K.",
  ".K.K....K.K.",
], { 10: "..K.K..K.K..", 11: "..K.K..K.K.." });
/* Robo-Caverns */
ENEMY_SPRITES.molebot = zoneFoe("Mole-Bot", "creature",
  { A: "#8a6a52", B: "#6b5242", C: "#29d9ff", Y: "#c0c8d0", K: "#2a1c12", W: "#ffd9b0" }, [
  "....KKKK....",
  "..KKAAAAKK..",
  ".KAAAAAAAAK.",
  ".KCCKAAKCCK.",
  ".KAAAAAAAAK.",
  "..KAAYYAAK..",
  "...KAYYAK...",
  "..KBBBYBBBK.",
  "WKBBBBBBBBKW",
  "WKBBBBBBBBKW",
  "..KBK..KBK..",
  "..KK....KK..",
], { 8: ".WKBBBBBBKW.", 9: "WKBBBBBBBBKW", 10: ".KBK....KBK.", 11: ".KK......KK." });
ENEMY_SPRITES.glowbat = zoneFoe("Glow-Bat", "creature",
  { A: "#5a3d8a", B: "#7d5cc0", E: "#7cff6b", K: "#1a0f2e", W: "#ffffff" }, [
  "............",
  "K..........K",
  "KB...KK...BK",
  "KBB.KAAK.BBK",
  "KBBKAAAAKBBK",
  "KBBKEAAEKBBK",
  ".KBKAAAAKBK.",
  "..KKAWWAKK..",
  "....KAAK....",
  ".....KK.....",
  "............",
  "............",
], "bob");
/* Secret Gardens */
ENEMY_SPRITES.bramblebug = zoneFoe("Bramble-Bug", "creature",
  { A: "#ff6b81", B: "#3f8f3a", G: "#2a5a1e", E: "#ffd32a", K: "#173315" }, [
  "...K....K...",
  "....K..K....",
  "...KKKKKK...",
  "..KEKAAKEK..",
  "..KKKKKKKK..",
  "GKBBBKKBBBKG",
  ".KBABBKBBABK",
  ".KBBABKBABBK",
  "GKBBBBKBBBBG",
  "..KBBBKBBBK.",
  ".K.K.KK.K.K.",
  "K.K......K.K",
], { 10: "K.K.KK.K.K..", 11: ".K.K....K.K." });
ENEMY_SPRITES.buzzbee = zoneFoe("Buzz-Bee", "creature",
  { A: "#ffb020", B: "#3a2a10", W: "#e8f6ff", E: "#ffffff", K: "#1a1205" }, [
  "..WW....WW..",
  ".WWWW..WWWW.",
  ".WWWWKKWWWW.",
  "..WWKAAKWW..",
  "...KEAAEK...",
  "..KAAAAAAK..",
  "..KBBBBBBK..",
  "..KAAAAAAK..",
  "...KBBBBK...",
  "....KAAK....",
  ".....KK.....",
  "............",
], "bob");
/* Shape Factory */
ENEMY_SPRITES.gizmobot = zoneFoe("Gizmo-Bot", "robot",
  { A: "#f0a020", B: "#5a6478", C: "#9ff0c8", E: "#1a1a22", W: "#ffffff", Y: "#ff4757", K: "#22262e" }, [
  ".....KY.....",
  ".....K......",
  "..KKKKKKKK..",
  "..KCCCCCCK..",
  "..KCEKKECK..",
  "..KCCWWCCK..",
  "..KKKKKKKK..",
  ".KAAABBAAAK.",
  "KAKABBBBAKAK",
  "...KAAAAK...",
  "...KKBBKK...",
  "....KKKK....",
], { 0: "......YK....", 1: "......K.....", 8: ".AKABBBBAKA." });
ENEMY_SPRITES.sprocket = zoneFoe("Sprocket Spider", "robot",
  { A: "#8a94a6", B: "#ff4757", E: "#ffd32a", K: "#22262e" }, [
  ".....KK.....",
  "..K.KAAK.K..",
  "...KAAAAK...",
  ".KKAEAAEAKK.",
  "..KAABBAAK..",
  ".KKAABBAAKK.",
  "..KAAAAAAK..",
  "...KAKKAK...",
  "..K.KAAK.K..",
  ".K..K..K..K.",
  "K..K....K..K",
  "............",
], { 9: "..K.K..K.K..", 10: ".K..K..K..K." });
/* Villain's Tower */
ENEMY_SPRITES.knightbot = zoneFoe("Knight-Bot", "robot",
  { A: "#b0b8c8", B: "#7a1e2e", R: "#ff4757", E: "#ff4757", S: "#4b3a8a", W: "#ffffff", K: "#1a1a2a" }, [
  ".....RR.....",
  "....RRR.....",
  "...KKKKKK...",
  "..KAAAAAAK..",
  "..KKEKKEKK..",
  "..KAAAAAAK..",
  "...KABBAK...",
  "SSKAAAAAAK..",
  "SSSKAAAAKAW.",
  "SSKAAAAAAKW.",
  "..KAK..KAK..",
  "..KK....KK..",
], { 7: "SSKAAAAAAKW.", 8: "SSSKAAAAKAW.", 9: "SSKAAAAAAK..", 10: ".KAK....KAK.", 11: ".KK......KK." });
ENEMY_SPRITES.sparkghost = zoneFoe("Spark Ghost", "creature",
  { A: "#e8e0ff", B: "#7d5cc0", E: "#2a1050", Y: "#ffd32a", K: "#5a4a8a" }, [
  "....KKKK....",
  "..KKAAAAKK..",
  "YKAAAAAAAAKY",
  ".KAEEAAEEAK.",
  ".KAEEAAEEAK.",
  ".KAAAAAAAAK.",
  ".KAAABBAAAK.",
  ".KAAAAAAAAK.",
  ".KAAAAAAAAK.",
  ".KAAKAAKAAK.",
  ".K.KK..KK.K.",
  "............",
], "bob");
/* Sky Isles */
ENEMY_SPRITES.puffcloud = zoneFoe("Puff-Cloud", "creature",
  { A: "#ffffff", B: "#29a0ff", E: "#2b3a55", K: "#8aa0c0" }, [
  "............",
  "....KKK.....",
  "..KKAAAKKK..",
  ".KAAAAAAAAK.",
  "KAAEKAAEKAAK",
  "KAAAAAAAAAAK",
  "KAAAABBAAAAK",
  ".KAAAAAAAAK.",
  "..KKAKKAKK..",
  "...B..B..B..",
  "............",
  "............",
], "bob");
ENEMY_SPRITES.ticktock = zoneFoe("Tick-Tock Bot", "robot",
  { A: "#c0392b", B: "#ffd32a", W: "#fffdf0", E: "#29d9ff", K: "#2b1a10" }, [
  "..KK....KK..",
  ".KBBK..KBBK.",
  "..KKKKKKKK..",
  ".KWWWWKWWWK.",
  "KWWWWWKWWWWK",
  "KWEWWWKWWEWK",
  "KWWWWWKKKWWK",
  "KWWWWWWWWWWK",
  ".KWWWWWWWWK.",
  "..KAAAAAAK..",
  "..KAK..KAK..",
  "..KK....KK..",
], { 3: ".KWWWWKWWWK.", 6: "KWWWWWKWWWWK", 7: "KWWWWKWWWWWK", 10: ".KAK....KAK.", 11: ".KK......KK." });
ENEMY_SPRITES.ridgeram = { name: "Rockslide Ram", kind: "creature", hp: [7, 7], frames: ENEMY_SPRITES.gremlinking.frames,
  colors: { A: "#d8d2c4", B: "#8a7a62", E: "#3a2e22", K: "#3a2e22", W: "#8a5a2b" } };
ENEMY_SPRITES.thistlequeen = { name: "Thistle Queen", kind: "creature", hp: [8, 8], frames: ENEMY_SPRITES.gremlinking.frames,
  colors: { A: "#a55eea", B: "#3f9c42", E: "#ffffff", K: "#3a1f5a", W: "#ff8fc7" } };
ENEMY_SPRITES.shapeshifter = { name: "Shape-Shifter", kind: "robot", hp: [9, 9], frames: ENEMY_SPRITES.drillmaster.frames,
  colors: { A: "#29b0c9", B: "#f0a020", E: "#ffd32a", K: "#1f2a3a", W: "#ff6b81" } };


/* ---- Distinct 16x16 boss sprites (replace the shared 12x12 boss frames) ---- */
const BOSS_ART = {
  gremlinking: { kind: "creature", hp: [6, 6],
    colors: { A: "#5fbf60", a: "#2e8b3a", Y: "#ffd32a", E: "#ffffff", K: "#1e3d22", R: "#e84a60", P: "#ff8fa3", B: "#e84a60", W: "#ffd32a" },
    grid: [
      "....Y..YY..Y....",
      "....YYYYYYYY....",
      "aa..YRYYYYRY..aa",
      "aAa.AAAAAAAA.aAa",
      ".aAAAEKAAKEAAAa.",
      "..aAAEKAAKEAAa..",
      "...AAAAPPAAAA...",
      "...AAEAAAAEAA...",
      "..RRAAAAAAAARR..",
      ".RRRAAYYYYAARRR.",
      "RRRAAAAAAAAAARRR",
      "RRAAaAAAAAAaAARR",
      ".R.AAAAAAAAAA.R.",
      "...AAA....AAA...",
      "...aaa....aaa...",
      "..KKKK....KKKK..",
    ] },
  ridgeram: { kind: "creature", hp: [7, 7],
    colors: { W: "#f2ead8", w: "#cfc2a2", H: "#b07a3e", h: "#6e4a26", F: "#5a4636", E: "#ffffff", K: "#1a1a1a", N: "#e8a0a0", L: "#3a2e22", A: "#f2ead8", B: "#b07a3e" },
    grid: [
      "..HHH......HHH..",
      ".HhhhH....HhhhH.",
      "Hh..hH.WW.Hh..hH",
      "Hh.HhWWWWWWhH.hH",
      ".HhhWFFFFFFWhhH.",
      "..HWFEKFFKEFWH..",
      "...WFFFFFFFFW...",
      "..WWWFFNNFFWWW..",
      ".WWwWWFFFFWWwWW.",
      "WWwWWWWWWWWWWwWW",
      "WwWWwWWWWWwWWWwW",
      "WWWWWWWWWWWWWWWW",
      ".WwWWWwWWwWWWwW.",
      "..LL.LL..LL.LL..",
      "..LL.LL..LL.LL..",
      "..KK.KK..KK.KK..",
    ] },
  drillmaster: { kind: "robot", hp: [8, 8],
    colors: { W: "#cfd4dd", w: "#8a909d", A: "#b8894a", B: "#6e4a26", E: "#ff4757", K: "#2b2f38", Y: "#ffd32a" },
    grid: [
      ".......WW.......",
      "......WwWW......",
      "......WWwW......",
      ".....WwWWwW.....",
      ".....WWwWWW.....",
      "....KKKKKKKK....",
      "...KAAAAAAAAK...",
      "...KAEEAAEEAK...",
      "...KAAAAAAAAK...",
      "...KAABYYBAAK...",
      ".WWKAAAAAAAAKWW.",
      "WwWKBAAAAAABKWwW",
      ".WWKAAAAAAAAKWW.",
      "...KKKKKKKKKK...",
      "..KBKBKBKBKBKB..",
      "..KKKKKKKKKKKK..",
    ] },
  thistlequeen: { kind: "creature", hp: [8, 8],
    colors: { f: "#f6d4ff", Y: "#ffd32a", P: "#c77dff", p: "#7d3fc9", G: "#3f9c42", g: "#7ed36a", E: "#ffffff", K: "#1f3a1f", M: "#ff8fc7", A: "#c77dff", B: "#3f9c42", W: "#ffd32a" },
    grid: [
      ".....Y.YY.Y.....",
      ".....YYYYYY.....",
      "...P.P.PP.P.P...",
      "..PpPpPppPpPpP..",
      ".PpPpPpPPpPpPpP.",
      "..GGGGGGGGGGGG..",
      "..GfEKffffKEfG..",
      "..GffffMMffffG..",
      "...GffffffffG...",
      "G...GGGGGGGG...G",
      "gG...GggggG...Gg",
      ".gGG.GggggG.GGg.",
      "...ggGGGGGGgg...",
      "......GggG......",
      ".....GG..GG.....",
      "....KK....KK....",
    ] },
  shapeshifter: { kind: "robot", hp: [9, 9],
    colors: { Y: "#ffd32a", E: "#ffffff", K: "#1f2a3a", R: "#ff4757", T: "#29b0c9", t: "#167a8c", O: "#f0a020", B: "#2c6de8", A: "#29b0c9", W: "#ff4757" },
    grid: [
      ".......YY.......",
      "......YYYY......",
      ".....YEYYEY.....",
      "....YYKYYKYY....",
      "...YYYYRRYYYY...",
      "..YYYYYYYYYYYY..",
      "......KKKK......",
      "RR.TTTTTTTTTT.RR",
      "RRKTttTTTTttTKRR",
      ".KKTtOOTTBBtTKK.",
      "...TtOOTTBBtT...",
      "...TTTTTTTTTT...",
      "....KK....KK....",
      "...BBB....BBB...",
      "..BBBB....BBBB..",
      "..KKKK....KKKK..",
    ] },
  robobaron: { kind: "robot", hp: [10, 10],
    colors: { K: "#1a1a26", A: "#4a4a66", B: "#a55eea", E: "#ff4757", Y: "#ffd32a", M: "#c8ccd4", W: "#ffd32a" },
    grid: [
      ".....KKKKKK.....",
      ".....KKKKKK.....",
      ".....KBBBBK.....",
      "...KKKKKKKKKK...",
      "....KAAAAAAK....",
      "....KAEAAEYK....",
      "....KAAAAAAK....",
      "....KMMMMMMK....",
      ".....KAAAAK.....",
      ".BBBKYAAAAYKBBB.",
      "BBBKAAAYYAAAKBBB",
      "BBBKAAAAAAAAKBBB",
      "BBB.KAAAAAAK.BBB",
      "BB...KA..AK...BB",
      ".....KA..AK.....",
      "....KKK..KKK....",
    ] },
};
for (const [id, art] of Object.entries(BOSS_ART)) {
  const old = ENEMY_SPRITES[id] || {};
  ENEMY_SPRITES[id] = { name: old.name, kind: art.kind, hp: art.hp, colors: art.colors, frames: [art.grid, art.grid] };
}

/* walking: a second "stride" frame for each rescued friend (legs apart, like the hero) */
const CIV_STRIDE = {
  man:   { 13: "..DD....DD..", 14: "..KK....KK..", 15: ".KK......KK." },
  woman: { 13: "..SS....SS..", 14: "..KK....KK.." },
  boy:   { 12: "..DD....DD..", 13: "..KK....KK.." },
  girl:  { 12: "..SS....SS..", 13: "..KK....KK.." },
};
function civGrid(kind, stride) {
  const civ = CIVILIANS[kind];
  if (!stride || !CIV_STRIDE[kind]) return civ.grid;
  return civ.grid.map((row, i) => CIV_STRIDE[kind][i] || row);
}

/* golden Champion look: same enemy, shiny gold body */
function goldSprite(spr) {
  return { ...spr, colors: { ...spr.colors, A: "#ffd32a", B: "#e09a00" } };
}
