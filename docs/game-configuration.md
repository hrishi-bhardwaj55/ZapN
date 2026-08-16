# Game configuration

Every new attempt records `zapn-public-guide-v3.0`, its Easy/Medium/Hard difficulty, and a training level from 1–5. Older attempts remain readable but are treated as level 3 for display.

The five levels are Foundation, Focused, Advanced, Expert, and Extreme. Level progression is game-specific: it changes risk-distribution overlap, puzzle depth, response windows, stimulus length, candidate count, memory span, solution rarity, candidate-space size, switch pressure, or gauge density as appropriate. Tutorials keep stable introductory settings.

The editor at `/admin/game-config` controls:

- trial or guess override (`0` uses the selected level profile);
- response/display-window override (`0` uses the selected level profile);
- whether the game's adaptive rule is enabled.

Configuration can be exported or imported as JSON and is stored locally. Easy/Medium/Hard still sets the broad environment, while the five-level ladder supplies within-game progression. Tutorial mode uses short, untimed blocks with immediate feedback. Simulation mode locks the chosen level across all nine games, uses no strategy hints, and withholds analytics until the end.

Development debug mode (`?debug=true`) can reveal deterministic breakpoints, answers, hidden targets, optimal moves, and trajectories, but only outside production simulation mode.
