# Design notes

## Audience & goals
- **Player:** a 1st grader (about 6–7 years old) who reads a little, loves games, and plays in 20–30 minute sessions.
- **Goals:** fluent addition and subtraction within 20, place value and counting by 10s to 100, word problems,
  bar graphs, coins, halves and fourths, early ×/÷ as equal groups and fair shares, telling time,
  plus pattern and logic reasoning.
- **Non-goals:** no reading-comprehension questions, no timers or speed pressure, no losing progress,
  no violence, no ads or accounts.

## Core loop
1. **Learn** at a Practice Park station: a short animated lesson, then earn the badge by getting 3 right.
2. **Use it** in battles: every attack is a problem. A wrong answer brings an easier "block" problem
   instead of a game over.
3. **Earn bolts**, then buy suit upgrades, superpowers, the hover-bike and decorations.
4. **Beat the zone boss.** That plus the zone's badges opens the next gate. The yellow 🎯 goal bar always
   says what to do next.

## Progression
| Zone | Needs | Problems mostly |
|---|---|---|
| City Streets | Add & Take, Story Detective | +/− within 10, word problems |
| Number Ridge | City boss + Tens | counting by 10s, missing numbers, number lines |
| Robo-Caverns | Ridge boss + Bar Graphs + Coins | bar graphs, coins |
| Shape Factory | Caverns boss + Shapes + Equation Master | halves/fourths, symmetry, fact families |
| Villain's Tower | Factory boss + Groups + Sharing | mixed review, × and ÷ |
| Secret Gardens *(post-game)* | Robo-Baron beaten | three addends, missing numbers, building equations |
| Sky Isles *(bonus)* | Flight superpower | telling time |

## Learning-design choices
- **Pictures are a limited resource.** Kids at this age often count pictures instead of reasoning, so
  problems are shown as numbers. A *Picture Lens* (start with 2, buy or find more) reveals a picture when needed.
- **Wrong answers teach.** Every generator writes a hint and the worked answer. Distractors in
  multiple-choice questions are the mistakes kids really make, such as reading the minute hand's number
  as the minutes, or picking the wrong hour at half past.
- **Badges are always required.** Every new game starts from zero, so the lessons get revisited.
- **Puzzle doors and chests** add non-numeric reasoning: patterns, odd one out, matrices, balance scales, riddles.
- **Make-ten strategies** show up on purpose: many three-addend problems hide a pair that makes 10, and the hint points it out.

## Technical choices
- A single self-contained HTML file: no build tools needed to play, works offline, easy to share.
- Canvas for the map and battles, DOM for menus and problems, Web Audio for all sound effects and music.
- Seeded world generation (mulberry32) with connectivity checks, so every new game gets a fresh but always-solvable map.
- `localStorage` save, wrapped in try/catch.
- Art is defined as tiny character-grid sprites in code, so there are no asset files.
- The browser tests drive the real game through small debug hooks (`Overworld.debugGoTo`, `Battle.debugWin`, …).
