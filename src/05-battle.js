/* ============================ BATTLE ============================ */
const Battle = (() => {
  const $ = id => document.getElementById(id);
  let canvas, ctx;
  /* Picture Lenses are a supply that lasts the whole game (g.lenses):
     every new game starts with 2, and Rita sells more. */
  const B = {
    enemy: null, spr: null, zone: "city",
    enemyHp: 0, enemyMax: 0,
    phase: "intro",           /* intro | attack | block | won | lost */
    problem: null, input: "", sel: [], graphVals: [],
    lensUsed: false, hasPic: false,
    anim: { heroX: 0, enemyX: 0, heroFlash: 0, enemyFlash: 0, zap: 0, shield: 0,
            fallT: -1, pieces: [], stars: 0, windup: 0 },
    locked: true,
  };
  const later = [];   /* pending timeouts, cleared when a new battle starts */
  function wait(fn, ms) { later.push(setTimeout(fn, ms)); }

  function init() {
    canvas = $("battle-canvas");
    ctx = canvas.getContext("2d");
    buildNumpad();
    $("btn-run").onclick = runAway;
    $("btn-lens").onclick = useLens;
    $("btn-check").onclick = () => { if (!B.locked) { Sound.play("click"); submit(); } };
    /* keyboard typing works too (digits, + - =, Backspace, Enter) */
    window.addEventListener("keydown", e => {
      if (Main.currentScreen() !== "screen-battle" || B.locked) return;
      const mode = B.problem ? B.problem.input : "number";
      if (mode !== "number" && mode !== "equation") return;
      let k = null;
      if (/^[0-9]$/.test(e.key)) k = e.key;
      else if (e.key === "Backspace") k = "⌫";
      else if (e.key === "Enter") k = "OK";
      else if (mode === "equation" && e.key === "+") k = "+";
      else if (mode === "equation" && (e.key === "-" || e.key === "−")) k = "−";
      else if (mode === "equation" && e.key === "=") k = "=";
      if (k) { e.preventDefault(); padPress(k); }
    });
  }

  function buildNumpad() {
    const pad = $("numpad");
    pad.innerHTML = "";
    ["1","2","3","4","5","⌫","6","7","8","9","0","OK"].forEach(k => {
      const b = document.createElement("button");
      b.className = "pad-btn" + (k === "OK" ? " ok" : k === "⌫" ? " del" : "");
      b.textContent = k;
      b.onclick = () => padPress(k);
      pad.appendChild(b);
    });
    const ops = $("oppad");
    ops.innerHTML = "";
    ["+", "−", "="].forEach(k => {
      const b = document.createElement("button");
      b.className = "pad-btn op";
      b.textContent = k;
      b.onclick = () => padPress(k);
      ops.appendChild(b);
    });
  }
  function setPadEnabled(on) {
    document.querySelectorAll("#battle-panel .pad-btn, #battle-choices .choice-btn, #btn-check")
      .forEach(b => b.disabled = !on);
  }
  function fmtEq(s) { return s.replace(/([+−=])/g, " $1 "); }
  function showInput() {
    const eq = B.problem && B.problem.input === "equation";
    $("battle-answer").textContent = B.input ? (eq ? fmtEq(B.input) : B.input) : " ";
  }
  function padPress(k) {
    if (B.locked) return;
    Sound.play("click");
    const eq = B.problem && B.problem.input === "equation";
    if (k === "⌫") B.input = B.input.slice(0, -1);
    else if (k === "OK") { if (B.input !== "") submit(); return; }
    else if ("+−=".includes(k)) { if (eq && B.input.length < 12) B.input += k; }
    else if (eq ? B.input.length < 12 : B.input.length < 3) B.input += k;
    showInput();
  }

  /* ---------- flow ---------- */
  function start(enemy, fromScreenKey) {
    later.forEach(clearTimeout); later.length = 0;
    Overworld.releaseKeys();
    B.enemy = enemy;
    B.spr = ENEMY_SPRITES[enemy.type];
    Music.battle(!!enemy.boss || !!enemy.champion);
    B.name = enemy.name || ENEMY_SPRITES[enemy.type].name;
    B.zone = (fromScreenKey && Main.zoneOfScreen(fromScreenKey)) || "city";
    const [hpMin, hpMax] = B.spr.hp;
    if (enemy.boss) {
      B.enemyMax = B.enemyHp = hpMax;   /* bosses: full fixed HP, no cap */
    } else {
      B.enemyMax = B.enemyHp = Math.min(4,
        hpMin + Math.floor(Math.random() * (hpMax - hpMin + 1)) + (enemy.hpBonus || 0));
    }
    const g = Main.getGame();
    if (enemy.champion) {   /* golden Champion: shiny, tougher, trickier problems */
      B.spr = goldSprite(B.spr);
      B.enemyMax = B.enemyHp = 6 + 3 * ((g.upgrades && g.upgrades.zap) || 0);
    }
    B.powerUsed = { strength: false, flight: false, invis: false };
    B.team = Overworld.companionFollowing();   /* the rescued friend joins post-game battles */
    B.teamUsed = false;
    B.friend = g.rescue ? g.rescue.name : "your friend";
    B.strengthArmed = false; B.dodgeArmed = false;
    B.phase = "intro"; B.input = ""; B.problem = null;
    B.anim = { heroX: 0, enemyX: 0, heroFlash: 0, enemyFlash: 0, zap: 0, shield: 0,
               fallT: -1, pieces: [], stars: 0, windup: 0, celebrate: 0 };
    $("enemy-name").textContent = (enemy.champion ? "👑 " : "") + B.name;
    $("hero-name").textContent = g.name;
    clearProblemArea();
    $("btn-run").style.display = enemy.boss ? "none" : "";   /* no running from bosses! */
    updateBars();
    Main.show("screen-battle");
    Sound.play("encounter");
    let intro = B.enemy.boss ? `⚔️ BOSS BATTLE! The mighty ${B.name} blocks your path!`
              : B.enemy.guardsKey ? `😠 "HEY! That's MY key!" The KEY KEEPER won't let you take it without a fight!`
              : B.enemy.champion ? `👑 The golden ${B.name.toUpperCase()} appeared! Champions ask TRICKY problems. Win a GRAND PRIZE!`
              : `A wild ${B.name} appeared!`;
    if (B.team) intro += `  🤝 ${B.friend} is here to help!`;
    let delay = 1600;
    if (g.hints && !g.hints.lens) {   /* one-time explanation of the new rules */
      g.hints.lens = true;
      intro += `  NEW: Pictures are hidden now! You have ${g.lenses} 🔍 Picture Lenses for the WHOLE game ` +
               `(Rita sells more). Solve WITHOUT a lens to earn a 🧠 BRAIN BONUS 🔩!`;
      delay = 6000;
    }
    say(intro);
    B.locked = true; setPadEnabled(false);
    wait(askAttack, delay);
  }

  function say(text) { $("battle-msg").textContent = text; }

  function clearProblemArea() {
    $("battle-display").innerHTML = "";
    $("battle-visual").innerHTML = "";
    $("battle-equation").textContent = "";
    $("battle-equation").classList.remove("prompt");
    $("battle-choices").innerHTML = "";
    $("battle-answer").textContent = " ";
    $("battle-input-row").style.display = "";
    $("oppad").style.display = "none";
    $("battle-check-row").style.display = "none";
    $("btn-lens").style.display = "none";
  }

  function askAttack() {
    if (B.phase === "won" || B.phase === "lost") return;
    B.phase = "attack";
    const g = Main.getGame();
    const zc = ZONES[B.zone];
    const skills = (zc.skills || ["add","sub"]).concat(B.enemy.champion ? CHAMPION_EXTRA : []);
    B.problem = MathGen.gen(skills, B.enemy.champion ? 2 : (zc.tier || 1), g.name, B.name);
    showProblem("Solve to FIRE YOUR ZAP! ⚡");
  }
  function askBlock() {
    B.phase = "block";
    B.problem = MathGen.blockProblem(Main.getGame().name);
    B.anim.windup = 60;
    showProblem("");
    say(`${B.name} is charging up! Solve to BLOCK! 🛡️`);
  }

  function showProblem(prefix) {
    const p = B.problem;
    clearProblemArea();
    say((prefix ? prefix + "  " : "") + p.story);
    /* always-visible display: number lines, number boxes, bar graphs */
    $("battle-display").innerHTML = p.display || "";
    /* the equation line (or an instruction) */
    $("battle-equation").textContent = p.equation || "";
    $("battle-equation").classList.toggle("prompt", !!p.prompt);
    /* input mode */
    B.input = ""; B.sel = [];
    const mode = p.input || "number";
    $("battle-input-row").style.display = (mode === "number" || mode === "equation") ? "" : "none";
    $("oppad").style.display = mode === "equation" ? "" : "none";
    $("battle-check-row").style.display = (mode === "multi" || mode === "graph" || mode === "coins") ? "" : "none";
    if (mode === "choice" || mode === "multi") buildChoices(p, mode);
    if (mode === "coins") { B.coins = []; CoinPad.wire($("battle-display"), B.coins, () => B.locked); }
    if (mode === "graph") {
      B.graphVals = p.graph.cats.map(() => 0);
      wireGraph();
    }
    /* hidden picture: Picture Lens / Quick Look */
    B.lensUsed = false;
    B.hasPic = B.phase === "attack" && !!(p.picture || p.visual);
    refreshLens();
    showInput();
    B.locked = false; setPadEnabled(true);
    buildPowerButtons();
  }

  function pictureHTML() {
    const p = B.problem;
    return p.picture || (p.visual ? p.visual.replace(/</g, "&lt;") : "");
  }
  function useLens() {
    const g = Main.getGame();
    if (B.locked || !B.hasPic || B.lensUsed || !(g.lenses > 0)) return;
    g.lenses--; B.lensUsed = true;
    Main.refreshHud();
    Main.autoSave();
    Sound.play("lens");
    $("battle-visual").innerHTML = pictureHTML();
    refreshLens();
  }
  function refreshLens() {
    const btn = $("btn-lens");
    if (!B.hasPic || B.lensUsed || B.phase !== "attack") { btn.style.display = "none"; return; }
    btn.style.display = "";
    const left = Main.getGame().lenses || 0;
    btn.disabled = left <= 0;
    btn.textContent = left > 0 ? `🔍 Use a Picture Lens (${left} left)` : "🔍 No lenses left — use your brain! (Rita sells more)";
  }

  function buildChoices(p, mode) {
    const holder = $("battle-choices");
    holder.innerHTML = "";
    p.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.innerHTML = c.html;   /* generator-made markup only (numbers, emoji, <u>) */
      b.onclick = () => {
        if (B.locked) return;
        Sound.play("click");
        if (mode === "choice") { B.sel = [i]; submit(); return; }
        const at = B.sel.indexOf(i);
        if (at >= 0) B.sel.splice(at, 1); else B.sel.push(i);
        b.classList.toggle("selected", at < 0);
      };
      holder.appendChild(b);
    });
  }
  function wireGraph() {
    const p = B.problem;
    $("battle-display").querySelectorAll(".bg-cell").forEach(cell => {
      cell.onclick = () => {
        if (B.locked) return;
        const r = +cell.dataset.r, k = +cell.dataset.k;
        B.graphVals[r] = B.graphVals[r] === k ? k - 1 : k;   /* tap the end again to shrink */
        Sound.play("click");
        $("battle-display").querySelectorAll(`.bg-cell[data-r="${r}"]`).forEach(c2 => {
          c2.classList.toggle("fill", +c2.dataset.k <= B.graphVals[r]);
        });
      };
    });
  }

  function buildPowerButtons() {
    const holder = $("battle-powers");
    holder.innerHTML = "";
    if (B.phase !== "attack") return;
    const g = Main.getGame();
    const defs = [
      { key: "strength", label: "💪 Power Punch", act: () => {
          B.strengthArmed = true;
          say("💪 SUPER STRENGTH armed! Your next hit counts DOUBLE!  " + B.problem.story);
        } },
      { key: "flight", label: "🕊️ Sky Dodge", act: () => {
          B.dodgeArmed = true;
          say("🕊️ FLIGHT ready! You'll zoom above the next attack!  " + B.problem.story);
        } },
      { key: "invis", label: "👻 Vanish", act: () => {
          B.locked = true; setPadEnabled(false);
          $("battle-powers").innerHTML = "";
          clearProblemArea();
          say("👻 You turned INVISIBLE and slipped away!");
          wait(() => Main.returnToWorld(), 1200);
        } },
    ];
    if (B.team && !B.teamUsed) {
      const p0 = B.problem;
      const team = [
        { label: "🤝 Team Zap", ok: true, act: () => {
            const pz = Puzzles.gen(ZONES[B.zone] && ZONES[B.zone].tier >= 2 ? 2 : 1);
            B.problem = { ...pz, skill: "teamzap", input: "choice", equation: "",
                          story: `🤝 TEAM ZAP! ${B.friend} spotted a puzzle: ${pz.story}` };
            showProblem("");
          } },
        { label: "💗 Cheer", ok: g.hearts < g.maxHearts, act: () => {
            g.hearts = Math.min(g.maxHearts, g.hearts + 1);
            updateBars(); Main.refreshHud();
            say(`💗 ${B.friend} cheers: "You've GOT this, ${g.name}!" +1 heart!  ` + p0.story);
          } },
        { label: "💡 Hint", ok: true, act: () => {
            say(`💡 ${B.friend} whispers: "${p0.hint}"  ` + p0.story);
            if (B.hasPic && !B.lensUsed) {   /* free look at the picture (no Brain Bonus this time) */
              B.lensUsed = true;
              $("battle-visual").innerHTML = pictureHTML();
              refreshLens();
            }
          } },
      ];
      for (const tm of team) {
        const b = document.createElement("button");
        b.className = "big-btn small";
        b.style.background = "linear-gradient(180deg, #ff8fc7, #e05a9e)";
        b.style.boxShadow = "0 4px 0 #8e2a5c";
        b.textContent = tm.label;
        b.disabled = !tm.ok;
        b.onclick = () => {
          if (B.teamUsed || B.locked) return;
          B.teamUsed = true;
          Sound.play("victory");
          tm.act();
          buildPowerButtons();
        };
        holder.appendChild(b);
      }
    }
    for (const d of defs) {
      if (!g.powers || !g.powers[d.key] || B.powerUsed[d.key]) continue;
      const b = document.createElement("button");
      b.className = "big-btn small";
      b.style.background = "linear-gradient(180deg, var(--yellow), #d9a800)";
      b.style.boxShadow = "0 4px 0 #8a6d00";
      b.style.color = "#222";
      b.textContent = d.label;
      b.onclick = () => {
        if (B.powerUsed[d.key] || B.locked) return;
        B.powerUsed[d.key] = true;
        Sound.play("victory");
        d.act();
        buildPowerButtons();
      };
      holder.appendChild(b);
    }
  }

  function submit() {
    const p = B.problem;
    if (!p || B.locked) return;
    const mode = p.input || "number";
    let given;
    if (mode === "number") { if (B.input === "") return; given = B.input; }
    else if (mode === "equation") {
      if (!MathGen.parseEq(B.input)) {   /* not finished yet: no penalty, just a nudge */
        Sound.play("bump");
        say("Make a whole equation, like 7 − 4 = 3, then press OK!  " + p.story);
        return;
      }
      given = B.input;
    }
    else if (mode === "choice") given = B.sel[0];
    else if (mode === "multi") {
      if (B.sel.length !== 2) {
        Sound.play("bump");
        say("Pick exactly TWO equations, then press CHECK!  " + p.story);
        return;
      }
      given = B.sel.slice();
    }
    else if (mode === "graph") given = B.graphVals.slice();
    else if (mode === "coins") {
      if (!B.coins.length) { Sound.play("bump"); say("Tap some coins to put them in the purse first!  " + p.story); return; }
      given = B.coins.slice();
    }
    B.locked = true; setPadEnabled(false);
    if (MathGen.check(p, given)) {
      if (B.phase === "attack") heroHits();
      else blockSucceeds();
    } else {
      Sound.play("wrong");
      if (B.phase === "attack" && p.skill === "teamzap") {
        showCorrect();
        say(`The Team Zap fizzled! (The answer was ${p.reveal}.)  💡 ${p.hint}  Your turn again!`);
        wait(askAttack, 4200);
      } else if (B.phase === "attack") {
        showCorrect();
        if (B.dodgeArmed) {
          B.dodgeArmed = false;
          Sound.play("block");
          B.anim.shield = 40;
          say(`🕊️ WHOOSH! You flew right over the attack! (It was ${p.reveal}.) Here's a new one!`);
          wait(askAttack, 2600);
        } else {
          say(`Not quite! It was ${p.reveal}.  💡 ${p.hint}`);
          wait(askBlock, 4200);
        }
      } else {
        blockFails();
      }
    }
  }
  /* after a miss, show the right answer on screen so he can learn from it */
  function showCorrect() {
    const p = B.problem;
    if ((p.input === "graph" || p.input === "coins") && p.revealDisplay) $("battle-display").innerHTML = p.revealDisplay;
    if (p.input === "choice" || p.input === "multi") {
      const right = Array.isArray(p.answer) ? p.answer : [p.answer];
      $("battle-choices").querySelectorAll(".choice-btn").forEach((b, i) => {
        b.classList.remove("selected");
        if (right.includes(i)) b.classList.add("right");
      });
    }
    if (p.input === "number" || p.input === "equation") $("battle-answer").textContent = p.reveal;
    $("btn-lens").style.display = "none";
  }

  function heroHits() {
    const g = Main.getGame();
    const crit = Math.random() < 0.2;
    let dmg = 1 + ((g.upgrades && g.upgrades.zap) || 0);
    if (crit) dmg *= 2;
    if (B.strengthArmed) { dmg *= 2; B.strengthArmed = false; }
    const teamZap = B.problem && B.problem.skill === "teamzap";
    if (teamZap) dmg += 2;   /* you and your friend zap together! */
    /* BRAIN BONUS: solved a picture problem without the lens */
    let bonus = "";
    if (B.hasPic && !B.lensUsed) {
      g.parts += 1;
      bonus = "  🧠 BRAIN BONUS +1 🔩!";
      Main.refreshHud();
      wait(() => Sound.play("brain"), 250);
    }
    $("btn-lens").style.display = "none";
    Sound.play("zap");
    if (crit) wait(() => Sound.play("zap"), 120);
    B.anim.zap = crit ? 40 : 26;
    B.anim.enemyFlash = crit ? 32 : 20;
    B.enemyHp -= dmg;
    updateBars();
    if (B.enemyHp <= 0) {
      say((teamZap ? `🤝 TEAM ZAP! You and ${B.friend} out-smarted the ${B.name}!`
                   : crit ? `⚡ SUPER ZAP! ⚡ You out-smarted the ${B.name}!`
                : `DIRECT HIT! You out-smarted the ${B.name}!`) + bonus);
      wait(() => { clearProblemArea(); win(); }, 1300);
    } else {
      say((teamZap ? `🤝 TEAM ZAP! You and ${B.friend} zapped together! The ${B.name} reels!`
                   : crit ? `⚡ SUPER ZAP! Double damage! The ${B.name} spins around!`
                : `DIRECT HIT! The ${B.name} wobbles!`) + bonus);
      wait(askAttack, bonus ? 2000 : 1500);
    }
  }

  function blockSucceeds() {
    Sound.play("block");
    B.anim.shield = 40; B.anim.windup = 0;
    clearProblemArea();
    say(`SHIELD UP! 🛡️ You blocked the attack! Nice thinking!`);
    wait(askAttack, 1600);
  }

  function blockFails() {
    const gp = Main.getGame();
    const plating = (gp.upgrades && gp.upgrades.plating) || 0;
    if (plating > 0 && Math.random() < plating * 0.3) {
      Sound.play("block");
      B.anim.shield = 40; B.anim.windup = 0;
      clearProblemArea();
      say("🛡️ CLANG! Your tough plating bounced the bonk right off!");
      wait(askAttack, 1600);
      return;
    }
    Sound.play("hurt");
    B.anim.heroFlash = 22; B.anim.windup = 0;
    $("battle-wrap").classList.remove("shake");
    void $("battle-wrap").offsetWidth;
    $("battle-wrap").classList.add("shake");
    const g = Main.getGame();
    g.hearts--;
    Main.refreshHud();
    updateBars();
    clearProblemArea();
    if (g.hearts <= 0) {
      say("Your suit needs a recharge...");
      wait(lose, 1200);
    } else {
      say(`Bonk! The ${B.name} tagged you. Shake it off — your turn!`);
      wait(askAttack, 1700);
    }
  }

  function win() {
    B.phase = "won";
    B.anim.celebrate = 1;
    $("btn-run").style.display = "none";
    $("battle-powers").innerHTML = "";
    const g = Main.getGame();
    if (B.enemy.boss) return bossWin(g);
    let drop = 1 + Math.floor(Math.random() * 3) + (B.enemy.hpBonus ? 1 : 0);
    let prize = "";
    if (B.enemy.champion) {
      drop = 10 + Math.floor(Math.random() * 6);
      g.champs = g.champs || {}; g.champs[B.enemy.champKey] = true;
      const d = Main.giveDecor("champ");
      prize = `  👑 GRAND PRIZE: a ${d.icon} ${d.name.toUpperCase()} for Hero House!`;
    } else if (B.enemy.storeBully) {
      g.furnitureSaved = true;
      prize = "  😊 Penny Pillow peeks out from behind the counter!";
    } else if (g.progress && g.progress.baron && !B.enemy.guardsKey && Math.random() < DECOR_DROP_CHANCE) {
      const d = Main.giveDecor("drop");
      prize = `  🎁 It dropped a ${d.icon} ${d.name} for Hero House!`;
    }
    if (B.spr.kind === "robot") {
      Sound.play("clatter");
      /* fall apart into pieces */
      B.anim.fallT = 0;
      B.anim.pieces = Array.from({ length: 10 }, () => ({
        x: 0, y: 0, vx: (Math.random() - .5) * 5, vy: -Math.random() * 5 - 1,
        c: [B.spr.colors.A, B.spr.colors.B, B.spr.colors.K][Math.floor(Math.random() * 3)],
        s: 6 + Math.random() * 8,
      }));
      say(`The ${B.name} clattered into a tidy pile of parts! +${drop} 🔩` + prize);
    } else {
      Sound.play("victory");
      B.anim.stars = 1;   /* dizzy stars */
      say(`The ${B.name} sat down, saw dizzy stars, and trotted off happily! +${drop} 🔩` + prize);
    }
    g.parts += drop;
    B.enemy.defeated = true;
    Main.refreshHud();
    Main.autoSave();
    const champWin = B.enemy.champion, bullyWin = B.enemy.storeBully;
    wait(() => {
      Sound.play("victory"); Main.returnToWorld();
      if (B.enemy.guardsKey) Overworld.collectPickups();   /* now the key is yours! */
      if (bullyWin) Main.toast(`😊 Penny Pillow: "You chased off the Couch Crusher! Come to my counter, hero. I have a GIFT for you!"`, 6500);
      if (champWin) {
        const left = champsLeft(g);
        Main.banner(left ? `👑 CHAMPION BEATEN! ${left} LEFT!` : "👑 ALL CHAMPIONS BEATEN!");
        Main.toast(left ? "🛋️ Your prize is waiting! Go to Hero House and tap DECORATE to place it."
                        : "🏆 You beat EVERY golden Champion! You're the GRAND CHAMPION of Math City!", 6000);
      }
    }, prize ? 3800 : 2600);
  }

  function bossWin(g) {
    B.anim.celebrate = 1;
    const bossId = B.enemy.boss;
    const drops = Object.fromEntries(Object.entries(BOSSES).map(([k, v]) => [k, v.drop]));
    Sound.play("clatter");
    wait(() => Sound.play("victory"), 500);
    B.anim.fallT = 0;
    B.anim.pieces = Array.from({ length: 16 }, () => ({
      x: 0, y: 0, vx: (Math.random() - .5) * 6, vy: -Math.random() * 6 - 1,
      c: [B.spr.colors.A, B.spr.colors.B, B.spr.colors.W][Math.floor(Math.random() * 3)],
      s: 7 + Math.random() * 9,
    }));
    g.parts += drops[bossId];
    g.progress[bossId] = true;
    B.enemy.defeated = true;
    Overworld.unlockGates(g);
    Main.refreshHud();
    Main.autoSave();
    if (bossId === "baron") {
      say(`👑 The ROBO-BARON clattered into a pile of parts! The cage is OPENING!`);
      wait(() => Main.showRescue(), 2400);
    } else if (!BOSS_OPENS[bossId]) {   /* a post-game boss: glory and a trophy */
      say(`🎉 The ${BOSSES[bossId].name.toUpperCase()} is out-smarted! +${drops[bossId]} 🔩  ` +
          `Her ${BOSS_TROPHIES[bossId].icon} trophy is waiting in your BOSS TROPHY case at home!`);
      wait(() => { Main.banner("🏆 " + BOSSES[bossId].name.toUpperCase() + " BEATEN!"); Main.returnToWorld(); }, 3800);
    } else {
      const zone = BOSS_OPENS[bossId];
      const gate = GATES[zone];
      const who = `The ${BOSSES[bossId].name.toUpperCase()} is out-smarted`;
      const missing = missingBadges(g, zone);
      if (missing.length === 0) {
        say(`🎉 ${who}! +${drops[bossId]} 🔩 — ${gate.name.toUpperCase()} is OPEN!`);
        wait(() => { Main.banner("🔓 " + gate.name.toUpperCase() + " UNLOCKED!"); Main.returnToWorld(); }, 2800);
      } else {
        /* new Practice Park stations just unlocked: say so, loud and clear */
        say(`🎉 ${who}! +${drops[bossId]} 🔩  NEW in Practice Park: ${badgeList(missing)}! ` +
            `Earn ${missing.length > 1 ? "those badges" : "that badge"} to open ${gate.name.toUpperCase()}.`);
        wait(() => {
          Main.banner("🎈 NEW PRACTICE PARK " + plural(missing.length, "STATION") + "!");
          Main.returnToWorld();
          Main.flashGoal();
        }, 4800);
      }
    }
  }

  function lose() {
    B.phase = "lost";
    Sound.play("defeat");
    say(`${Main.getGame().name} zoomed home for a recharge! (You kept ALL your parts!)`);
    wait(() => Main.respawnAtBase(), 2200);
  }

  function runAway() {
    if (B.phase === "won" || B.phase === "lost" || B.locked) return;
    Sound.play("click");
    B.locked = true; setPadEnabled(false);
    clearProblemArea();
    if (Math.random() < 0.6) {
      say("You zoomed away safely!");
      $("btn-run").style.display = "none";
      wait(() => Main.returnToWorld(), 900);
    } else {
      say(`Oh no — the ${B.name} cut you off! It's charging up!`);
      wait(askBlock, 1300);   /* Vanish (Invisibility) never fails — that's its superpower! */
    }
  }

  function updateBars() {
    /* enemy HP as discrete segments so toughness is visible */
    const track = $("enemy-track");
    track.innerHTML = "";
    for (let i = 0; i < B.enemyMax; i++) {
      const seg = document.createElement("div");
      seg.className = "hp-seg" + (i < B.enemyHp ? " full" : "");
      track.appendChild(seg);
    }
    const g = Main.getGame();
    const ht = $("hero-track");
    ht.innerHTML = "";
    for (let i = 0; i < g.maxHearts; i++) {
      const seg = document.createElement("div");
      seg.className = "hp-seg hero" + (i < g.hearts ? " full" : "");
      ht.appendChild(seg);
    }
  }

  /* ---------- scene rendering ---------- */
  const HERO_POS = { x: 130, y: 168 }, ENEMY_POS = { x: 520, y: 60 };
  const HERO_SCALE = 9, ENEMY_SCALE = 11;

  /* every zone gets its own battle backdrop */
  function circ(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function scenery(zone, w, h) {
    const t = performance.now(), gy = h - 70;
    if (zone === "city" || zone === "interior") {
      const tops = [60, 30, 80, 45, 20, 70, 40, 90, 35, 55];
      tops.forEach((top, i) => {
        const bx = i * (w / tops.length), bw = w / tops.length - 6;
        ctx.fillStyle = i % 2 ? "#8ea4c4" : "#7d93b5"; ctx.fillRect(bx, top + 40, bw, gy - top - 40);
        ctx.fillStyle = "rgba(255,230,140,.7)";
        for (let wy = top + 52; wy < gy - 14; wy += 18) for (let wx = bx + 8; wx < bx + bw - 10; wx += 16) if ((wx * 7 + wy * 3) % 5 > 1) ctx.fillRect(wx, wy, 7, 9);
      });
    } else if (zone === "ridge") {
      const peaks = [[0, 170], [120, 60], [260, 140], [380, 40], [520, 130], [640, 70], [w, 160]];
      ctx.fillStyle = "#8a9ab8"; ctx.beginPath(); ctx.moveTo(0, gy);
      peaks.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(w, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4f8ff";
      for (const [x, y] of peaks.filter(p => p[1] < 100)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y + 26); ctx.lineTo(x - 26, y + 26); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 9; i++) { const x = 20 + i * 90, y = gy - 10; ctx.fillStyle = "#2f5e3e";
        ctx.beginPath(); ctx.moveTo(x, y - 60); ctx.lineTo(x + 20, y); ctx.lineTo(x - 20, y); ctx.closePath(); ctx.fill(); }
    } else if (zone === "cavern") {
      ctx.fillStyle = "#2a201a"; ctx.fillRect(0, 0, w, 40);
      for (let i = 0; i < 14; i++) { const x = i * 58 + 10, len = 30 + (i * 37) % 50;
        ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x + 14, 30 + len); ctx.lineTo(x + 28, 30); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 6; i++) { const x = 60 + i * 130, a = .5 + Math.sin(t / 300 + i) * .3;
        ctx.fillStyle = `rgba(124,255,107,${a})`; ctx.beginPath(); ctx.moveTo(x, gy - 40); ctx.lineTo(x + 10, gy - 10); ctx.lineTo(x - 10, gy - 10); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 12; i++) circ(w - 140 + (i % 4) * 14, gy - 6 - Math.floor(i / 4) * 9, 7, "#e8b830");   /* a pile of mined coins */
    } else if (zone === "gardens") {
      for (let i = 0; i < 7; i++) { ctx.fillStyle = "#2f6b2c"; ctx.fillRect(i * 120, gy - 70, 100, 70); circ(i * 120 + 50, gy - 70, 50, "#357a32"); }
      for (let i = 0; i < 10; i++) { const x = 30 + i * 80, y = gy - 20 + Math.sin(i) * 6;
        ctx.fillStyle = "#3f8f3a"; ctx.fillRect(x - 1, y, 3, 20);
        for (let k = 0; k < 5; k++) circ(x + Math.cos(k * 1.26) * 8, y + Math.sin(k * 1.26) * 8, 6, ["#ff8fc7", "#ffd32a", "#b48cff"][i % 3]);
        circ(x, y, 4, "#fff3a0"); }
    } else if (zone === "factory") {
      ctx.fillStyle = "#6a7588"; ctx.fillRect(0, 50, w, 16); ctx.fillRect(0, 110, w, 10);
      for (const [x, y, r, dir] of [[90, 120, 50, 1], [190, 70, 30, -1], [w - 120, 110, 56, -1], [w - 220, 60, 28, 1]]) {
        const a = t / 900 * dir;
        ctx.fillStyle = "#8a94a6";
        for (let k = 0; k < 10; k++) { const an = a + k * Math.PI / 5; ctx.fillRect(x + Math.cos(an) * r - 6, y + Math.sin(an) * r - 6, 12, 12); }
        circ(x, y, r - 4, "#8a94a6"); circ(x, y, r * .35, "#5a6478");
      }
    } else if (zone === "tower") {
      ctx.fillStyle = "#33334d"; ctx.fillRect(0, 0, w, gy);
      const lightning = (t % 7000) < 160;
      for (let i = 0; i < 5; i++) { const x = 60 + i * 160;
        ctx.fillStyle = lightning ? "#f0f4ff" : "#1a1a33";
        ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x, 70); ctx.arc(x + 30, 70, 30, Math.PI, 0); ctx.lineTo(x + 60, 140); ctx.fill();
        ctx.fillStyle = "#7a1e2e"; ctx.fillRect(x - 14, 40, 10, 140); ctx.fillRect(x + 64, 40, 10, 140); }
    } else if (zone === "sky") {
      ["#ff4757", "#ff9f1a", "#ffd32a", "#2ed573", "#29a0ff", "#a55eea"].forEach((c, k) => {
        ctx.strokeStyle = c; ctx.globalAlpha = .35; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(w / 2, gy + 60, 300 - k * 10, Math.PI, 0); ctx.stroke(); });
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { const x = ((i * 170 + t / 40) % (w + 160)) - 80, y = 40 + (i % 3) * 40;
        circ(x, y, 22, "#fff"); circ(x + 24, y + 6, 18, "#fff"); circ(x - 22, y + 8, 16, "#fff"); }
    } else {   /* home & park: green hills */
      circ(150, gy + 120, 200, "#6cbf4a"); circ(560, gy + 140, 240, "#5aa03c");
    }
  }
  function render() {
    const zc = ZONES[B.zone];
    const w = canvas.width, h = canvas.height;
    /* sky */
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, zc.sky[0]); sky.addColorStop(1, zc.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    scenery(B.zone, w, h);
    /* ground */
    ctx.fillStyle = B.zone === "sky" ? "#f4faff" : B.zone === "cavern" ? "#5a4a3e" : zc.floor;
    ctx.fillRect(0, h - 70, w, 70);
    /* platforms */
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.ellipse(ENEMY_POS.x + 66, ENEMY_POS.y + 150, 120, 26, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(HERO_POS.x + 54, HERO_POS.y + 152, 110, 26, 0, 0, 7); ctx.fill();

    const a = B.anim;
    /* windup warning above enemy */
    if (a.windup > 0) {
      a.windup--;
      if (a.windup % 20 < 12) {
        ctx.font = "bold 34px sans-serif";
        ctx.fillText("⚠️", ENEMY_POS.x + 50, ENEMY_POS.y - 12);
      }
    }

    /* enemy */
    if (a.fallT >= 0) {
      /* robot falling apart: pieces tumble to the platform */
      a.fallT++;
      for (const p of a.pieces) {
        p.vy += .25; p.x += p.vx; p.y += p.vy;
        const groundY = 150 - p.s;
        if (p.y > groundY) { p.y = groundY; p.vy = 0; p.vx *= .8; }
        ctx.fillStyle = p.c;
        ctx.fillRect(ENEMY_POS.x + 60 + p.x, ENEMY_POS.y + p.y + 40, p.s, p.s);
      }
    } else if (B.phase === "won" && B.spr.kind === "creature") {
      /* knocked-out creature: sitting with dizzy stars */
      drawGrid(ctx, B.spr.frames[0], B.spr.colors, ENEMY_POS.x, ENEMY_POS.y + 46, ENEMY_SCALE * 12 / B.spr.frames[0][0].length);
      const t = performance.now() / 300;
      for (let i = 0; i < 3; i++) {
        const ang = t + i * 2.1;
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("⭐", ENEMY_POS.x + 60 + Math.cos(ang) * 46, ENEMY_POS.y + 20 + Math.sin(ang) * 12);
      }
    } else {
      const frame = Math.floor(performance.now() / 400) % 2;
      const flash = a.enemyFlash > 0 && (a.enemyFlash-- % 6 < 3);
      if (!flash) {
        const bob = Math.sin(performance.now() / 500) * 4;
        drawGrid(ctx, B.spr.frames[frame], B.spr.colors, ENEMY_POS.x, ENEMY_POS.y + bob, ENEMY_SCALE * 12 / B.spr.frames[0][0].length);
      }
    }

    /* hero (back view = up-facing frames), flashes when hurt, bounces when winning */
    const hFlash = a.heroFlash > 0 && (a.heroFlash-- % 6 < 3);
    const t2 = performance.now();
    const bounce = a.celebrate ? -Math.abs(Math.sin(t2 / 160)) * 22 : 0;
    if (B.team) {   /* the rescued friend stands beside you */
      const gm = Main.getGame(), civ = gm.rescue && CIVILIANS[gm.rescue.sprite];
      if (civ) drawGrid(ctx, civ.grid, civ.colors, 18, 214 + bounce * .6, 6);
    }
    if (!hFlash) {
      drawHero(ctx, HERO_POS.x, HERO_POS.y + bounce, "up", 0, Main.suit(), HERO_SCALE, Main.getGame().powers);
    }
    if (a.celebrate) {   /* victory stars burst around the hero */
      ctx.font = "26px sans-serif"; ctx.textAlign = "center";
      for (let i = 0; i < 5; i++) {
        const ang = t2 / 350 + i * 1.26;
        ctx.fillText(i % 2 ? "⭐" : "🎉",
          HERO_POS.x + 54 + Math.cos(ang) * 78,
          HERO_POS.y + 60 + bounce + Math.sin(ang) * 34);
      }
      ctx.textAlign = "start";
    }

    /* zap beam */
    if (a.zap > 0) {
      a.zap--;
      const prog = 1 - a.zap / 26;
      const x1 = HERO_POS.x + 100, y1 = HERO_POS.y + 40;
      const x2 = ENEMY_POS.x + 60, y2 = ENEMY_POS.y + 80;
      ctx.strokeStyle = "rgba(255,211,42,.95)"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * prog, y1 + (y2 - y1) * prog); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * prog, y1 + (y2 - y1) * prog); ctx.stroke();
    }
    /* shield bubble */
    if (a.shield > 0) {
      a.shield--;
      ctx.strokeStyle = `rgba(41,217,255,${a.shield / 40})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(HERO_POS.x + 54, HERO_POS.y + 70, 92, 0, 7); ctx.stroke();
    }
  }

  /* test hook: inspect the current battle */
  function debugState() { return B; }
  function debugWin() { later.forEach(clearTimeout); later.length = 0; B.enemyHp = 0; updateBars(); win(); }
  return { init, start, render, debugState, debugWin };
})();

