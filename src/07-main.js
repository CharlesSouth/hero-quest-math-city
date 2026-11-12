/* ============================ MAIN ============================ */
const Main = (() => {
  const $ = id => document.getElementById(id);
  let game = {
    name: "", suitIndex: 0,
    hearts: 3, maxHearts: 3, parts: 0,
    pos: null,
  };
  let activeScreen = "screen-title";
  let bannerTimer = null, toastTimer = null, savedTimer = null;

  function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
    activeScreen = id;
  }
  function currentScreen() { return activeScreen; }
  function suit() { return { ...(ALL_SUITS[game.suitIndex] || SUITS[0]), decal: game.decal || null }; }

  /* ---- HUD helpers ---- */
  function banner(text) {
    const b = $("zone-banner");
    b.textContent = text; b.style.opacity = 1;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.style.opacity = 0, 2200);
  }
  function toast(text, ms = 3400) {
    const t = $("toast");
    t.textContent = text; t.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.style.opacity = 0, ms);
  }
  function flashGoal() {
    const b = $("goal-bar");
    b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  }
  function setZoneChip(text) { $("hud-zone").textContent = text.replace(/^[^ ]+ /, ""); }
  function refreshHud() {
    $("hud-hearts").textContent = "❤".repeat(game.hearts) + "🖤".repeat(Math.max(0, game.maxHearts - game.hearts));
    $("hud-parts").textContent = "🔩 " + game.parts + (game.hasKey ? "  🗝️" : "");
    $("hud-lens").textContent = "🔍 " + (game.lenses ?? 0);
    $("hud-badges").textContent = "🏅 " + STATIONS.filter(st => hasBadge(game, st.id)).length + "/" + STATIONS.length;
    const inPark = Overworld.getSave().key === "-1,0";
    let goal = nextGoal(game);
    if (inPark) goal = goal.replace("Go to PRACTICE PARK (far west ⬅) and earn", "Earn the glowing stations here:").replace("Earn the glowing stations here: the", "Earn the glowing stations here:");
    $("goal-bar").textContent = "🎯 " + goal;
    $("btn-ride").style.display = (game.bike || 0) >= BIKE_STAGES.length ? "" : "none";
    const rescued = !!(game.progress && game.progress.baron);
    $("btn-friend").style.display = rescued ? "" : "none";
    $("btn-decor").style.display = Overworld.getSave().key === "hero_house" ? "" : "none";
    if (rescued) $("btn-friend").textContent = "🤝 " + (game.rescue ? game.rescue.name : "Friend");
  }

  /* ---- saving ---- */
  function snapshot() {
    return { ...game, pos: Overworld.getSave(), v: 2 };
  }
  function autoSave() { SaveLoad.save(snapshot()); }
  function manualSave() {
    if (SaveLoad.save(snapshot())) {
      Sound.play("save");
      const f = $("saved-flash");
      f.style.opacity = 1;
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => f.style.opacity = 0, 1600);
    } else {
      toast("Hmm, saving isn't available in this browser — the game still works!");
    }
  }

  /* ---- name & suit screen ---- */
  function buildSuitPicker() {
    const row = $("color-row");
    row.innerHTML = "";
    SUITS.forEach((s, i) => {
      const opt = document.createElement("div");
      opt.className = "suit-option" + (i === game.suitIndex ? " selected" : "");
      const c = document.createElement("canvas");
      c.width = 60; c.height = 80;
      opt.appendChild(c);
      const label = document.createElement("div");
      label.textContent = s.name;
      label.style.cssText = "font-size:.8rem;font-weight:bold;color:#cde;margin-top:4px;";
      opt.appendChild(label);
      drawHero(c.getContext("2d"), 6, 0, "down", 0, s, 4);
      opt.onclick = () => {
        game.suitIndex = i;
        row.querySelectorAll(".suit-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        drawPreview();
        Sound.play("click");
      };
      row.appendChild(opt);
    });
    drawPreview();
  }
  function buildRescuePicker() {
    const row = $("rescue-row");
    row.innerHTML = "";
    Object.entries(CIVILIANS).forEach(([key, c]) => {
      const opt = document.createElement("div");
      opt.className = "suit-option" + (key === game.rescue.sprite ? " selected" : "");
      const cv = document.createElement("canvas");
      cv.width = 60; cv.height = 80;
      opt.appendChild(cv);
      const label = document.createElement("div");
      label.textContent = c.label;
      label.style.cssText = "font-size:.8rem;font-weight:bold;color:#cde;margin-top:4px;";
      opt.appendChild(label);
      drawGrid(cv.getContext("2d"), c.grid, c.colors, 6, 4, 4);
      opt.onclick = () => {
        game.rescue.sprite = key;
        row.querySelectorAll(".suit-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        Sound.play("click");
      };
      row.appendChild(opt);
    });
  }
  function drawPreview() {
    const c = $("hero-preview"), ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    drawHero(ctx, 12, 0, "down", 0, suit(), 6);
  }
  function validateName() {
    $("btn-begin").disabled =
      $("name-input").value.trim().length === 0 ||
      $("rescue-input").value.trim().length === 0;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- story intro ---- */
  function showStory() {
    game.name = $("name-input").value.trim();
    game.rescue.name = $("rescue-input").value.trim();
    /* art: hero + captured friend behind bars */
    const art = $("story-art");
    art.innerHTML = "";
    const cv = document.createElement("canvas");
    cv.width = 300; cv.height = 110; cv.style.imageRendering = "pixelated";
    art.appendChild(cv);
    const c2 = cv.getContext("2d");
    drawHero(c2, 20, 8, "right", 0, suit(), 6);
    const civ = CIVILIANS[game.rescue.sprite];
    drawGrid(c2, civ.grid, civ.colors, 200, 8, 6);
    /* cage bars over the friend */
    c2.fillStyle = "#33334d";
    for (let i = 0; i < 5; i++) c2.fillRect(192 + i * 20, 0, 6, 110);
    c2.fillRect(188, 0, 92, 6); c2.fillRect(188, 104, 92, 6);
    $("story-text").innerHTML =
      `One sunny day, the sneaky <b style="color:var(--green)">Gear-Gremlins</b> swooped into Math City!<br>
       They stole every single <b style="color:var(--yellow)">donut</b> in town...<br>
       and their boss, the <b style="color:var(--purple)">Robo-Baron</b>, captured
       <b style="color:var(--cyan)">${esc(game.rescue.name)}</b>! He's holding them in his tower!<br><br>
       <i>"Only a hero who knows MATH can stop me!"</i> he laughed.<br><br>
       Suit up, <b style="color:var(--yellow)">${esc(game.name)}</b>. It's adventure time!`;
    show("screen-story");
    Sound.play("banner");
  }

  /* ---- flow ---- */
  function startNewGame() {
    game = { name: "", suitIndex: 0, hearts: 3, maxHearts: 3, parts: 0, pos: null,
             rescue: { name: "", sprite: "boy" }, hints: {},
             upgrades: { zap: 0, plating: 0 }, lenses: 2, badges: {}, opened: {}, puzzles: 0,
             bike: 0, ownedSuits: [], decals: [], decal: null, companion: null,
             decor: { owned: {}, placed: {} }, champs: {}, chestsRefilled: false, furnitureSaved: false, furnitureGift: false,
             powers: { strength: false, flight: false, invis: false },
             progress: { city: false, ridge: false, cavern: false, gardens: false, factory: false, baron: false }, hasKey: false,
             seed: (Math.random() * 2147483647) | 0 };
    Overworld.resetWorldState(game.seed);   /* every adventure gets a fresh world! */
    Overworld.applyDecor(game);
    buildSuitPicker();
    buildRescuePicker();
    $("name-input").value = "";
    $("rescue-input").value = "";
    validateName();
    show("screen-name");
    setTimeout(() => $("name-input").focus(), 100);
  }
  function beginAdventure() {
    Overworld.resetToBase();
    show("screen-world");
    refreshHud();
    Overworld.onEnterScreen();
    setTimeout(() => { toast("Welcome, " + game.name + "! Your next goal is always in the yellow 🎯 box under the map. First stop: PRACTICE PARK (go WEST ⬅)!", 9000); flashGoal(); }, 600);
    autoSave();
  }
  function continueGame() {
    const saved = SaveLoad.load();
    if (!saved) return;
    game = { name: saved.name, suitIndex: saved.suitIndex || 0,
             hearts: saved.hearts ?? 3, maxHearts: saved.maxHearts ?? 3,
             parts: saved.parts ?? 0, pos: saved.pos,
             rescue: saved.rescue || { name: "your friend", sprite: "man" },
             hints: saved.hints || {},
             upgrades: { zap: 0, plating: 0, ...(saved.upgrades || {}) },
             lenses: saved.lenses ?? 2, badges: saved.badges || {},
             opened: saved.opened || {}, puzzles: saved.puzzles || 0,
             bike: saved.bike || 0, ownedSuits: saved.ownedSuits || [], decals: saved.decals || [],
             decal: saved.decal || null,
             decor: { owned: {}, placed: {}, ...(saved.decor || {}) }, champs: saved.champs || {},
             chestsRefilled: !!saved.chestsRefilled,
             furnitureSaved: !!saved.furnitureSaved, furnitureGift: !!saved.furnitureGift,
             companion: saved.companion || ((saved.progress || {}).baron ? { mode: "follow" } : null),
             powers: saved.powers || { strength: false, flight: false, invis: false },
             progress: { city: false, ridge: false, cavern: false, gardens: false, factory: false, baron: false, ...(saved.progress || {}) },
             hasKey: !!saved.hasKey,
             seed: saved.seed || 1 };
    Overworld.resetWorldState(game.seed);
    Overworld.unlockGates(game);
    Overworld.applyProgress(game.progress, game.hasKey);
    Overworld.applyOpened(game.opened);
    Overworld.applyDecor(game);
    Overworld.applyStoreState(game);
    Overworld.spawnChampions(game);
    show("screen-world");
    refreshHud();
    Overworld.loadSave(saved.pos);
    setTimeout(() => toast("Welcome back, " + game.name + "!"), 400);
  }

  function returnToWorld() {
    closeFriendPopup();
    Music.back();
    show("screen-world");
    refreshHud();
  }
  function respawnAtBase() {
    game.hearts = game.maxHearts;
    Overworld.resetToBase();
    show("screen-world");
    refreshHud();
    Overworld.onEnterScreen();
    toast("Fully recharged! All your parts are safe. Back to the adventure!", 5000);
    autoSave();
  }
  function zoneOfScreen(key) { return Overworld.zoneOf(key); }
  function openShop() { Shop.open(); }
  /* hand out a decoration from a pool, preferring ones he doesn't have yet */
  function giveDecor(pool) {
    game.decor = game.decor || { owned: {}, placed: {} };
    const ids = Object.keys(DECOR).filter(id => DECOR[id].src === pool);
    const fresh = ids.filter(id => !game.decor.owned[id]);
    const from = fresh.length ? fresh : ids;
    const id = from[Math.floor(Math.random() * from.length)];
    game.decor.owned[id] = (game.decor.owned[id] || 0) + 1;
    return DECOR[id];
  }
  /* ---- the rescued friend: stay home / come along (a choice, never an accidental bump) ---- */
  let popup = false;
  function popupOpen() { return popup; }
  function closeFriendPopup() { popup = false; $("friend-pop").style.display = "none"; }
  function openFriendPopup() {
    if (!(game.progress && game.progress.baron)) return;
    const friend = esc(game.rescue ? game.rescue.name : "your friend");
    const home = game.companion && game.companion.mode === "home";
    popup = true;
    const art = $("friend-pop-art"); art.innerHTML = "";
    const cv = document.createElement("canvas"); cv.width = 48; cv.height = 64;
    drawGrid(cv.getContext("2d"), CIVILIANS[game.rescue.sprite].grid, CIVILIANS[game.rescue.sprite].colors, 0, 0, 4);
    art.appendChild(cv);
    $("friend-pop-text").innerHTML = home
      ? `${friend} is resting at Hero House. 💤<br>Want ${friend} to come along?`
      : `${friend} is adventuring with you! 🤝<br>What should ${friend} do?`;
    const btns = $("friend-pop-btns"); btns.innerHTML = "";
    const add = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "big-btn small" + (cls ? " " + cls : ""); b.textContent = label;
      b.onclick = () => { Sound.play("click"); closeFriendPopup(); fn && fn(); };
      btns.appendChild(b);
    };
    if (home) {
      add(`🤝 Come with me!`, "green", () => {
        game.companion = { mode: "follow" };
        Overworld.placeCompanion();
        Sound.play("victory");
        toast(`🤝 ${game.rescue.name}: "Let's go on an adventure together, ${game.name}!"`, 4500);
        refreshHud(); autoSave();
      });
      add("💤 Stay home", "", null);
    } else {
      add("🤝 Keep following me", "green", null);
      add("🛏️ Rest at home", "", () => {
        game.companion = { mode: "home" };
        Sound.play("banner");
        toast(`🛏️ ${game.rescue.name}: "I'll rest at Hero House! Tap 🤝 any time to call me back."`, 6000);
        refreshHud(); autoSave();
      });
    }
    $("friend-pop").style.display = "";
    Sound.play("banner");
  }
  function openTrophies() {
    const grid = $("trophy-grid");
    grid.innerHTML = "";
    let won = 0;
    for (const st of STATIONS) {
      const t = TROPHIES[st.id], has = hasBadge(game, st.id);
      if (has) won++;
      const card = document.createElement("div");
      card.className = "trophy-card" + (has ? " won" : "");
      card.innerHTML = `<div class="trophy-icon">${t.icon}</div>` +
        (has ? `<div class="trophy-name">${t.name}</div><div class="trophy-desc">${t.desc}</div>`
             : `<div class="trophy-name">???</div><div class="trophy-desc">Earn the ${st.icon} ${st.name} badge in Practice Park to win this one!</div>`);
      grid.appendChild(card);
    }
    const bg = $("boss-grid");
    bg.innerHTML = "";
    for (const [id, t] of Object.entries(BOSS_TROPHIES)) {
      const has = !!(game.progress && game.progress[id]);
      const card = document.createElement("div");
      card.className = "trophy-card" + (has ? " won" : "");
      card.innerHTML = `<div class="trophy-icon">${t.icon}</div>` +
        (has ? `<div class="trophy-name">${t.name}</div><div class="trophy-desc">${t.desc}</div>`
             : `<div class="trophy-name">???</div><div class="trophy-desc">Out-smart the ${BOSSES[id].name.toUpperCase()} to win this one!</div>`);
      bg.appendChild(card);
    }
    $("trophy-count").textContent = won === STATIONS.length
      ? `ALL ${won} TROPHIES! You're a Practice Park CHAMPION! 🎉`
      : `${won} of ${STATIONS.length} trophies. Earn Practice Park badges to fill your case!`;
    show("screen-trophies");
    Sound.play(won ? "victory" : "banner");
  }

  let powerupState = null;
  function showPowerup(id, name) {
    powerupState = { id, t0: performance.now() };
    $("powerup-title").textContent = "SUIT UPGRADE!";
    const lines = {
      strength: "Rita bolts on the GOLDEN GAUNTLETS! 💪<br>Crush boulders on the map, and unleash one double-power hit in every battle!",
      flight:   "Rita installs the WING THRUSTERS! 🕊️<br>Fly over water to reach lost treasure, and dodge one attack in every battle!",
      invis:    "Rita activates the GHOST SHIMMER! 👻<br>Enemies can't sneak up on you, and you can vanish from any battle — even bosses!",
    };
    $("powerup-text").innerHTML = `<b style="color:var(--yellow)">${name}</b> installed!<br>` + (lines[id] || "");
    show("screen-powerup");
    Sound.play("victory");
    setTimeout(() => Sound.play("victory"), 500);
  }
  function renderPowerup() {
    if (!powerupState) return;
    const cv = $("powerup-canvas"), c = cv.getContext("2d");
    const t = performance.now() - powerupState.t0;
    c.clearRect(0, 0, cv.width, cv.height);
    /* charging rings */
    for (let i = 0; i < 3; i++) {
      const r = ((t / 12) + i * 40) % 130;
      c.strokeStyle = `rgba(255,211,42,${1 - r / 130})`;
      c.lineWidth = 5;
      c.beginPath(); c.arc(180, 130, r, 0, 7); c.stroke();
    }
    /* the hero, new power visibly attached, gently rising */
    const rise = Math.sin(t / 400) * 8;
    const pw = {};
    pw[powerupState.id] = true;
    drawHero(c, 180 - 42, 70 + rise, "down", 0, suit(), 7, { ...game.powers, ...pw });
    /* sparkles */
    c.font = "22px sans-serif"; c.textAlign = "center";
    for (let i = 0; i < 6; i++) {
      const ang = t / 400 + i * 1.05;
      c.fillText("✨", 180 + Math.cos(ang) * 105, 130 + Math.sin(ang) * 75);
    }
    c.textAlign = "start";
    const icon = { strength: "💪", flight: "🕊️", invis: "👻" }[powerupState.id];
    c.font = "38px sans-serif";
    c.fillText(icon, 162, 40 + Math.sin(t / 250) * 6);
  }
  function showRescue() {
    const art = $("rescue-art");
    art.innerHTML = "";
    const cv = document.createElement("canvas");
    cv.width = 300; cv.height = 110; cv.style.imageRendering = "pixelated";
    art.appendChild(cv);
    const c2 = cv.getContext("2d");
    drawHero(c2, 40, 8, "right", 0, suit(), 6, game.powers);
    const civ = CIVILIANS[game.rescue.sprite];
    drawGrid(c2, civ.grid, civ.colors, 180, 8, 6);
    $("rescue-text").innerHTML =
      `<b style="color:var(--cyan)">${esc(game.rescue.name)}</b> is FREE! 🎉<br>
       "You saved me, <b style="color:var(--yellow)">${esc(game.name)}</b>! You out-smarted the
       Robo-Baron with MATH!"<br><br>
       The donuts are back at the Donut Depot, the Gear-Gremlins have scattered,
       and Math City is safe — all thanks to its favorite hero.<br><br>
       <b style="color:var(--green)">⭐ QUEST COMPLETE! ⭐</b><br><br>
       🤝 <b style="color:var(--cyan)">${esc(game.rescue.name)}</b> will follow you everywhere now and help in battles
       with <b>TEAM MOVES</b>!<br>
       <span style="font-size:.95rem; color:#9db;">(Want them to rest at Hero House? Tap the 🤝 button at the top any time.)</span><br><br>
       <b style="color:var(--yellow)">✨ NEW ADVENTURES!</b> The 🌻 <b>SECRET GARDENS</b> have opened (east end of the Robo-Caverns),
       golden 👑 <b>CHAMPIONS</b> have appeared around Math City, and every 📦 treasure chest is full of bolts again!`;
    game.companion = { mode: "follow" };
    Overworld.refillChests(game);
    Overworld.spawnChampions(game);
    autoSave();
    show("screen-rescue");
    Sound.play("victory");
    setTimeout(() => Sound.play("victory"), 700);
  }

  function init() {
    /* twinkling stars */
    for (let i = 0; i < 30; i++) {
      const s = document.createElement("div");
      s.className = "star";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = Math.random() * 100 + "vh";
      s.style.animationDelay = Math.random() * 3 + "s";
      document.body.appendChild(s);
    }
    /* title hero preview */
    const th = document.createElement("canvas");
    th.width = 84; th.height = 100; th.style.imageRendering = "pixelated";
    $("title-hero").appendChild(th);
    drawHero(th.getContext("2d"), 6, 2, "down", 0, SUITS[0], 6);

    if (SaveLoad.load()) $("btn-continue").style.display = "";

    $("btn-new").onclick = () => { Sound.play("click"); startNewGame(); };
    $("btn-continue").onclick = () => { Sound.play("click"); continueGame(); };
    $("btn-begin").onclick = () => { Sound.play("click"); showStory(); };
    $("btn-story-go").onclick = () => { Sound.play("click"); beginAdventure(); };
    $("btn-save").onclick = manualSave;
    $("name-input").addEventListener("input", validateName);
    $("rescue-input").addEventListener("input", validateName);
    $("rescue-input").addEventListener("keydown", e => {
      if (e.key === "Enter" && !$("btn-begin").disabled) showStory();
    });
    $("name-input").addEventListener("keydown", e => {
      if (e.key === "Enter") $("rescue-input").focus();
    });

    $("btn-powerup-done").onclick = () => {
      Sound.play("click");
      Shop.open();   /* back to Rita for more shopping */
    };
    $("btn-trophy-exit").onclick = () => { Sound.play("click"); returnToWorld(); };
    $("btn-rescue-done").onclick = () => {
      Sound.play("click");
      returnToWorld();
      Overworld.placeCompanion();
      toast("🎉 Math City celebrates you, " + game.name + "! " + game.rescue.name + " is right behind you! 🤝", 6000);
    };

    Overworld.init();
    Battle.init();
    Shop.init();
    Tutorial.init();
    Puzzle.init();
    Garage.init();
    $("btn-ride").onclick = () => { Sound.play("click"); Garage.open("travel"); };
    const musicBtn = () => { $("btn-music").textContent = Music.isOn() ? "🎵" : "🔇"; $("btn-music").classList.toggle("off", !Music.isOn()); };
    musicBtn();
    $("btn-music").onclick = () => { Music.toggle(); musicBtn(); };
    $("btn-friend").onclick = () => { if (!popup) openFriendPopup(); };
    Decorate.init();
    $("btn-decor").onclick = () => { Sound.play("click"); Decorate.open(); };
  }

  return { init, banner, toast, flashGoal, setZoneChip, openFriendPopup, popupOpen, giveDecor, suit, currentScreen, autoSave, show,
           refreshHud, returnToWorld, respawnAtBase, zoneOfScreen, openShop, openTrophies, showRescue,
           showPowerup, renderPowerup,
           getGame: () => game };
})();

Main.init();
</script>
</body>
</html>
