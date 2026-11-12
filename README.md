# 🦸 Hero Quest: Math City

**A free, browser-based math adventure game for early elementary kids (built for a 1st-grade boy).**
Explore a pixel-art city, battle silly robots by solving math problems, rescue a friend from the Robo-Baron,
and decorate your Hero House. No ads, no accounts, no internet needed. It's one HTML file you open in a browser.

> **▶ Play now:** https://charlessouth.github.io/hero-quest-math-city/ (works on any computer or tablet, nothing to install)

---

## Why I made it

My 1st grader likes video games much more than worksheets. The goal was a game where **the math is the gameplay,
not a quiz between levels**: every attack is a math problem, every door is a logic puzzle, and his progress
shows up as trophies, suit upgrades and a house he decorates.

Design principles:

- **Practice, not punishment.** A wrong answer means the robot winds up for a hit and you get an easier "block"
  problem. You never lose progress, and tips appear after mistakes.
- **Understanding over counting.** Problems show numbers, not pictures to count. A limited **Picture Lens** item
  shows a picture when he's truly stuck, and he has to earn or buy more.
- **Short sessions.** It auto-saves constantly and has a Continue button, so it works for a 20 to 30 minute play window.
- **Violence-free.** Robots fall into a tidy pile of parts. Creatures get dizzy and trot off happily.

## What it practices

Each area of the city unlocks after you earn badges at the **Practice Park**, where short animated lessons teach each skill first.

| Practice Park station | Skills |
|---|---|
| ➕➖ Add & Take Away | Addition and subtraction within 10 and 20 |
| 📖 Story Detective | Word problems: missing parts, adding to, taking from, comparing |
| 🔟 Tens & Number Lines | Counting by 10s, missing numbers from 0 to 100, number lines |
| 📊 Bar Graphs | Reading bar graphs and building a graph from sentences |
| 🪙 Coin Counter | Pennies, nickels and dimes |
| 🔷 Shape Splitter | Halves and fourths, mirror symmetry |
| 🔧 Equation Master | Building equations, fact families, choosing the right operation |
| ✖️ Equal Groups | Early multiplication (equal groups) |
| ➗ Fair Shares | Early division (sharing equally) |
| 🕐 Clock Tower Time *(bonus)* | Telling time with the hour and minute hands |

It also mixes in **reasoning and critical-thinking puzzles** (IQ-test style, no reading-level barrier) on puzzle
doors and treasure chests: what comes next, growing patterns, number patterns, odd one out, 3×3 matrix puzzles,
balance scales and riddles.

## The adventure

- **City Streets → Number Ridge → Robo-Caverns → Shape Factory → Villain's Tower.** Each area has its own enemies,
  music, scenery, battle backdrop and boss.
- **Explorable buildings** with extra enemies, **puzzle doors** and glowing **treasure chests**.
- **Robot Workshop:** spend bolts on suit upgrades and superpowers (Flight, Invisibility, Super Strength).
- **Robo-Garage:** build a hover-bike for fast travel and paint your suit.
- **Rescue a friend**, who then follows you around and joins battles with team moves.
- **After the game:** the Secret Gardens (harder adding and equations), the flight-only **Sky Isles** (telling time),
  golden Champion enemies, boss trophies, and a furniture store for decorating Hero House.

## Project structure

```
index.html            ← the built game (open this to play)
build.py              ← joins src/ into index.html
src/
  00-shell-config-sound.html   HTML/CSS, all screens, game config (zones, gates, stations, decor), sound + music
  01-mathgen-puzzles.js        math problem generators, answer checking, logic puzzles
  02-sprites.js                code-drawn pixel art (hero, enemies, bosses, people)
  03-world.js                  seeded world generation, buildings, dungeons, doors, signs
  04-overworld.js              movement, collisions, zone themes/weather, drawing the map
  05-battle.js                 battles, team moves, bosses, rewards
  06-screens.js                Practice Park lessons, puzzle screen, garage/store, shop, saving
  07-main.js                   game state, HUD, new game / continue, trophies, decorating
tests/                         Playwright browser tests (400+ checks)
docs/DESIGN.md                 design notes
```

Everything (art, sound and music) is generated in code. There are **no image or audio files**.

## Build & test

```bash
python build.py                 # rebuild index.html after editing anything in src/

pip install playwright          # one-time test setup
python -m playwright install chromium
python tests/run_all.py         # runs every test file (takes a few minutes)
```

The tests play the game in a real browser. They check that 100,000+ generated problems have valid answers,
that 300 random worlds are fully connected, and that the whole progression, every zone, the puzzles, saving
and the post-game all work. Set `CHROME_PATH` to use an installed Chrome instead of Playwright's Chromium.

## How it was made

I designed it from my son's playtesting feedback ("the bosses look the same", "I want to decorate my house",
"the bed toggle is too sensitive"...) and built it with **Claude** (Anthropic) one phase at a time,
with automated tests after every phase.

## License

MIT. See [LICENSE](LICENSE). Feel free to fork it and adapt the problems for your own kids or classroom.
