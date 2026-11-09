# ISSEN

*Don't cut red.*

A 20-second mouse-slashing game made for the 20 Second Game Jam 2026.
Click and you dash just past your cursor, cutting everything in your path.
Cut many enemies in one line, keep the chain going, and never cut the red one.

## Play locally

```
python -m http.server 8772
```

Then open http://127.0.0.1:8772/arena/

Or play online: https://jaepaly.github.io/issen/

## Rules in one line

Score per slash = (enemies cut in that slash)² × chain bonus (cut again within 0.8 s to grow it, up to ×6; a miss breaks it). Cutting a red soldier ends the run.
Click past a wall and you stop at the wall. Level up to get faster and see more; from LV3 a sword wave bounces off the wall.
Killing the general unleashes a screen-wide cut.
Best score with live pace at 5/10/15 s, DAILY (same seed per day) or RANDOM (T), R/Space restart, C copies your result with the link.
The game shows a photosensitivity warning: full-screen white flashes.

## Folders

- `arena/`: the game (vanilla JS + Canvas 2D). `game.js` holds the rules and `main.js` handles rendering, input and audio.
- `tests/arena-sim.js`: rule tests and bot checks. Run them with `node tests/arena-sim.js`.
- `tools/`: art prep, the SFX build, the release zip (`python tools/build.py`) and capture scripts.
- `art/`: source images.
- `itch/`: the itch page draft.
- `slash/`, `game/`: earlier discarded prototypes.
- `portfolio.md`: design log, in Korean.

## Credits and AI disclosure

- Design, direction, selection and playtesting: human (the author).
- Code: written with AI assistance.
- Art: generated with Codex CLI image generation, directed and selected by a human.
- Sound effects: Kenney "RPG Audio" and "Impact Sounds" (CC0), trimmed, layered and edited.
