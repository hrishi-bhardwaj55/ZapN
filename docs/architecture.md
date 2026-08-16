# Architecture

Cortex separates deterministic game logic from visual components. `lib/engine.ts` owns seeded randomness, telemetry creation, timing-independent analytics, and normalized result construction. Every `games/<id>/engine.ts` module is pure and directly testable. React components handle input and presentation, measure stimuli and responses with `performance.now()`, and never use render duration as reaction time.

The application state machine is explicit at the product level:

`HOME → INSTRUCTIONS → ACTIVE → RESULT`

Series add `TRANSITION` between games and finish at `SESSION_SUMMARY`. Tutorials and practice may pause; simulation mode removes pause and hides strategy/debug information.

Device-local history fulfills account-free mode. Each result stores its seed and `configVersion`, making exact replay and comparison auditable. The optional FastAPI/PostgreSQL service mirrors session, game attempt, round, and behavioral-event entities for future signed-in synchronization. Telemetry is submitted per round or in batches; animation frames are never transmitted.

Stock Master keeps gauge state in refs and uses one `requestAnimationFrame` canvas loop, avoiding React rerenders per frame. Other games use React for discrete stimulus/response transitions.
