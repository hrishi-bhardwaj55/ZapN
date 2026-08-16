# Game configuration

Every attempt records `zapn-simulator-v1.0`. Difficulty is selected independently from the developer configuration.

The editor at `/admin/game-config` controls:

- trial or guess count;
- response/display window in milliseconds where relevant;
- whether the game's adaptive rule is enabled.

Configuration can be exported or imported as JSON and is stored locally. Built-in Easy, Medium, and Hard profiles set visual complexity, sequence length, code length, disk count, gauge count, response windows, and target widths within each engine. Tutorial mode uses short, untimed blocks with immediate feedback. Simulation mode uses fixed settings, no strategy hints, and final results only.

Development debug mode (`?debug=true`) can reveal deterministic breakpoints, answers, hidden targets, optimal moves, and trajectories, but only outside production simulation mode.
