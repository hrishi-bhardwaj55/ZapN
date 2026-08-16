You are a senior full-stack engineer, game systems engineer, product designer, and QA engineer.

Your task is to build a complete browser-based cognitive assessment practice platform inspired by publicly reported **Optiver Zap-N-style games**.

This is a **practice simulator**, not an attempt to reproduce proprietary Optiver software or undisclosed scoring. Implement mechanics based only on public descriptions and configurable cognitive-task principles.

The platform must contain exactly these **9 games**:

1. Balloon
2. Skyscraper / Towers
3. Shapeshift
4. Code Compare
5. Pincode / Digit Memory
6. Number Box
7. Figure It Out
8. The Switch
9. Stock Master

Do NOT implement Barbecue / Grill Master.

The application must be production-quality, configurable, deterministic when seeded, instrumented with detailed telemetry, and designed so additional game variants can be added later.

---

# 1. PRIMARY OBJECTIVE

Build an application where a user can:

- Practice any game individually
- Take a complete 9-game simulation
- Take custom combinations of games
- Select difficulty
- Run timed or untimed practice
- Receive instructions before each game
- Complete tutorial rounds
- See performance statistics afterward
- Review accuracy, reaction time, consistency, mistakes, and progression
- Compare current results against their own previous attempts
- Train specific weaknesses

The platform must emphasize:

- very low input latency
- precise timing
- keyboard-first controls where appropriate
- deterministic game generation
- reliable scoring
- session persistence
- detailed event logging
- clear post-game analytics

---

# 2. IMPORTANT PRODUCT CONSTRAINT

Do NOT present any score as:

> "Your Optiver score"

or:

> "This is Optiver's pass cutoff."

Use terminology such as:

- Practice Score
- Simulator Score
- Accuracy
- Median Reaction Time
- Risk Calibration
- Efficiency
- Working Memory Span
- Planning Efficiency

All scoring formulas must be clearly documented and configurable.

If implementing approximate cognitive models, clearly mark them internally as simulator heuristics.

---

# 3. RECOMMENDED TECHNOLOGY STACK

Use:

## Frontend

- React
- TypeScript
- Vite
- Zustand for lightweight global state
- React Router
- HTML Canvas where animation/timing precision matters
- requestAnimationFrame for game loops
- Web Audio API only if audio feedback is eventually added
- CSS Modules, Tailwind, or equivalent
- Recharts for analytics

## Backend

Preferred:

- FastAPI
- Python 3.12+
- PostgreSQL
- SQLAlchemy
- Alembic

Alternative acceptable:

- Node.js
- NestJS
- PostgreSQL

## Testing

Frontend:

- Vitest
- React Testing Library
- Playwright

Backend:

- pytest

## Deployment

- Docker
- Docker Compose
- frontend and backend separately containerized
- PostgreSQL container locally
- production deployable to AWS, GCP, Azure, Fly.io, Render, Railway, etc.

---

# 4. REPOSITORY STRUCTURE

Use approximately:

```text
zapn-practice/
│
├── README.md
├── docker-compose.yml
├── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── games/
│   │   │   ├── balloon/
│   │   │   ├── skyscraper/
│   │   │   ├── shapeshift/
│   │   │   ├── code-compare/
│   │   │   ├── pincode/
│   │   │   ├── number-box/
│   │   │   ├── figure-it-out/
│   │   │   ├── switch/
│   │   │   └── stock-master/
│   │   ├── hooks/
│   │   ├── analytics/
│   │   ├── engine/
│   │   ├── store/
│   │   ├── types/
│   │   ├── utils/
│   │   └── pages/
│   └── tests/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── analytics/
│   │   ├── database/
│   │   └── main.py
│   └── tests/
│
├── shared/
│   ├── game-config/
│   └── schemas/
│
└── docs/
    ├── architecture.md
    ├── scoring.md
    ├── telemetry.md
    └── game-specifications/
```

Each game must be modular.

Do NOT put all games into one giant component.

---

# 5. SHARED GAME ENGINE

Build a shared framework used by all nine games.

Create abstractions similar to:

```ts
interface GameDefinition {
    id: string;
    name: string;
    description: string;

    initialize(config: GameConfig, seed: string): GameState;

    start(): void;

    handleInput(event: GameInputEvent): void;

    update(timestamp: number): void;

    finish(): GameResult;

    getTelemetry(): GameEvent[];
}
```

Every game must support:

- initialization
- countdown
- tutorial
- active gameplay
- paused state if appropriate
- finished state
- scoring
- telemetry
- seeded randomization

---

# 6. COMMON GAME STATES

Use:

```text
NOT_STARTED
INSTRUCTIONS
TUTORIAL
COUNTDOWN
ACTIVE
ROUND_COMPLETE
GAME_COMPLETE
RESULTS
```

Transitions must be explicit.

Avoid UI state implicitly controlling game logic.

---

# 7. TIMING ENGINE

Reaction-time measurement is critical.

Never measure reaction time using React render timing.

Use:

```ts
performance.now()
```

Record:

```text
stimulusShownAt
inputReceivedAt
reactionTimeMs
```

For animations use:

```ts
requestAnimationFrame
```

Do NOT rely on:

```ts
setInterval(...)
```

for precision-critical gameplay.

setTimeout may schedule events, but actual timing must be validated against `performance.now()`.

---

# 8. SEEDED RANDOMNESS

Every game must accept a seed.

Example:

```text
sessionSeed = "2026-08-16-user-123"
```

Use a deterministic PRNG such as:

- Mulberry32
- xoroshiro
- seedrandom

This lets developers reproduce bugs exactly.

Every generated level must record:

```json
{
  "seed": "...",
  "game": "...",
  "round": 7
}
```

---

# 9. COMMON TELEMETRY

Record all relevant actions.

Base event structure:

```json
{
  "sessionId": "uuid",
  "gameId": "code_compare",
  "round": 12,
  "eventType": "USER_RESPONSE",
  "timestamp": 123456.782,
  "payload": {}
}
```

Supported event types should include:

```text
GAME_STARTED
ROUND_STARTED
STIMULUS_SHOWN
USER_RESPONSE
CORRECT_RESPONSE
INCORRECT_RESPONSE
TIMEOUT
ROUND_COMPLETED
GAME_COMPLETED
LEVEL_CHANGED
DIFFICULTY_CHANGED
```

Individual games may add custom event types.

---

# 10. SESSION RESULT MODEL

Each game should return approximately:

```ts
interface GameResult {
    gameId: string;

    startedAt: string;
    completedAt: string;

    totalRounds: number;

    correct?: number;
    incorrect?: number;

    accuracy?: number;

    meanReactionTime?: number;
    medianReactionTime?: number;

    rawScore: number;

    metrics: Record<string, number>;

    telemetry: GameEvent[];
}
```

---

# 11. GAME 1: BALLOON

## Objective

Create a Balloon Analogue Risk Task-style game.

User repeatedly pumps a balloon.

Each pump:

- increases balloon size
- increases temporary monetary value
- risks explosion

User can either:

```text
PUMP
CASH OUT
```

If they cash out:

- temporary earnings are banked

If balloon explodes:

- temporary earnings are lost
- optional penalty may be applied depending on configuration

---

## Controls

Default:

```text
SPACE = pump
ENTER = cash out
```

Also support clickable controls.

Keyboard input should be preferred.

---

## Configuration

```ts
interface BalloonConfig {
    balloonCount: number;

    pumpReward: number;

    explosionPenaltyMultiplier: number;

    minBreakpoint: number;
    maxBreakpoint: number;

    breakpointDistribution:
        | "uniform"
        | "normal"
        | "custom";

    revealCurrentValue: boolean;

    colors?: BalloonTypeConfig[];
}
```

Support multiple balloon classes such as:

```json
{
  "blue": {
    "minBreakpoint": 1,
    "maxBreakpoint": 128
  },
  "yellow": {
    "minBreakpoint": 1,
    "maxBreakpoint": 32
  },
  "orange": {
    "minBreakpoint": 1,
    "maxBreakpoint": 8
  }
}
```

---

## Breakpoint

For each balloon generate a hidden explosion threshold.

Example:

```text
breakpoint = 47
```

If user attempts pump 47:

```text
balloon explodes
```

Do not reveal threshold.

---

## State

```ts
interface BalloonState {
    balloonIndex: number;

    pumpCount: number;

    currentBalloonValue: number;

    bankedValue: number;

    breakpoint: number;

    exploded: boolean;

    completed: boolean;
}
```

---

## Visual behavior

Balloon should grow continuously.

Do not allow it to overflow viewport.

Growth function may be nonlinear:

```text
scale = 1 + a × sqrt(pumpCount)
```

Avoid huge exponential growth.

---

## Explosion

On explosion:

- short visual burst
- disable inputs immediately
- display loss
- advance after ~500–1000 ms

Do not allow additional input during explosion animation.

---

## Scoring metrics

Calculate:

```text
banked money
average pumps
average adjusted pumps
explosion count
cash-out count
explosion percentage
pumps by balloon type
variance in pump thresholds
adaptation over time
```

Adjusted pumps:

```text
average pumps among balloons successfully cashed out
```

Also calculate rolling averages:

```text
first 10 balloons
middle 10
last 10
```

This lets users see whether they learned the distribution.

---

# 12. GAME 2: SKYSCRAPER / TOWERS

This is a planning puzzle similar to Tower of London / Tower of Hanoi.

---

## Objective

Display:

```text
CURRENT CONFIGURATION
TARGET CONFIGURATION
```

User must transform current state into target state in as few moves as possible.

---

## Components

Three vertical towers:

```text
A
B
C
```

Each tower has capacity.

Pieces may have:

- colors
- shapes
- sizes

Recommended:

```text
red sphere
blue sphere
green sphere
yellow sphere
```

---

## Move rules

Configurable.

Default:

- move one piece at a time
- only top piece can be moved
- destination tower must have free capacity

Optional Tower of Hanoi mode:

- smaller pieces cannot be placed beneath larger pieces

Do NOT enforce Hanoi size rules unless enabled.

---

## Level generation

Generate only solvable states.

Best method:

1. Generate target state.
2. Start from target.
3. Perform N legal random moves.
4. Use resulting state as initial state.

This guarantees solvability.

Store actual shortest solution separately.

---

## Optimal solution calculation

Implement BFS for small states.

For larger states:

- bidirectional BFS
- A*
- precomputed state graph

Calculate:

```text
minimumMoves
userMoves
moveEfficiency
```

Formula:

```text
efficiency = minimumMoves / userMoves
```

Maximum 1.

---

## Input

Click piece then destination tower.

Better:

click top piece → highlight legal towers → click destination.

Invalid moves:

- should not count
- should provide subtle feedback

---

## Metrics

Track:

```text
total completion time
time before first move
number of moves
minimum possible moves
extra moves
move efficiency
invalid moves
undo usage
average inter-move time
```

Important metric:

```text
planningTime = firstMoveTimestamp - puzzleStartTimestamp
```

---

## Difficulty

Increase:

- number of pieces
- tower capacities
- solution depth
- distractor complexity

Example:

```text
Level 1: optimal solution 2–3 moves
Level 2: 4–5
Level 3: 6–7
Level 4: 8+
```

---

# 13. GAME 3: SHAPESHIFT

## Objective

Measure stimulus-response mapping, reaction speed, and inhibition.

Display either:

```text
CIRCLE
SQUARE
```

User must press corresponding key.

Example:

```text
F = circle
J = square
```

Key mappings must be configurable.

---

## Important feature: misleading position

Stimulus can appear:

```text
left
center
right
```

The required response must depend ONLY on shape.

Position is irrelevant.

This creates interference.

---

## Trial sequence

Each trial:

1. fixation point
2. random delay
3. stimulus appears
4. response window starts
5. record key
6. immediate short feedback
7. next trial

---

## Timing configuration

```ts
{
  fixationMs: 300,
  preStimulusMinMs: 250,
  preStimulusMaxMs: 700,
  responseWindowMs: 1200,
  interTrialMs: 250
}
```

Difficulty may progressively reduce response window.

---

## Anti-anticipation

If user presses before stimulus:

record:

```text
anticipatory_response
```

and penalize.

---

## Metrics

Calculate:

```text
accuracy
mean RT
median RT
p10 RT
p90 RT
RT standard deviation
false presses
timeouts
wrong-key responses
```

Also calculate RT for:

```text
repeat shape
switch shape
congruent location
incongruent location
```

---

# 14. GAME 4: CODE COMPARE

## Objective

Display one reference code and several candidates.

User must identify exact match.

---

## Example

Reference:

```text
N7FK2P8
```

Choices:

```text
N7FK2B8
N7FK2P8
N7FX2P8
N7FKP28
```

Only one is exact.

---

## Code generation

Allowed characters:

```text
A-Z excluding visually ambiguous letters if desired
0-9
```

Config option:

```ts
excludeAmbiguousCharacters: boolean
```

Potentially exclude:

```text
O
0
I
1
L
```

Difficulty may later include them.

---

## Distractor generation

Distractors must be deliberately similar.

Mutation types:

```text
single-character substitution
two-character substitution
character swap
missing character
extra character
adjacent transposition
same prefix different suffix
same suffix different prefix
```

Never accidentally generate two exact matches.

---

## Difficulty

Parameters:

```text
code length
number of choices
similarity between choices
time limit
font size
character spacing
```

Example:

```text
Easy:
5 chars
3 choices
2500 ms

Hard:
9 chars
6 choices
800 ms
```

---

## Controls

Map choices:

```text
1
2
3
4
5
6
```

Avoid forcing mouse use.

---

## Metrics

Track:

```text
accuracy
RT
timeouts
error by mutation type
accuracy by code length
accuracy by position of mismatch
```

Useful diagnostic:

```text
Which character positions generate the most errors?
```

---

# 15. GAME 5: PINCODE / DIGIT MEMORY

Implement three separate modes.

---

# MODE A: FORWARD RECALL

Display sequence:

```text
8 2 5 7 1
```

After delay hide sequence.

User enters:

```text
82571
```

---

# MODE B: REVERSE RECALL

Shown:

```text
8 2 5 7
```

Correct:

```text
7528
```

---

# MODE C: SORTED RECALL

Shown:

```text
8 2 5 7
```

Correct:

```text
2578
```

Duplicates must work.

Example:

```text
8 2 2 5
```

Sorted answer:

```text
2258
```

---

## Presentation modes

Support:

### simultaneous

Entire sequence visible together.

### sequential

One digit shown at a time.

Configuration:

```ts
presentationMode
digitDisplayMs
interDigitDelayMs
```

---

## Adaptive difficulty

Start span:

```text
4 digits
```

When user achieves configurable success threshold:

increase span.

Example:

```text
2 correct at span 5 → span 6
```

After configurable failures:

decrease or terminate.

---

## Inputs

Use physical number keys.

Also display numeric keypad for mobile.

---

## Metrics

Track:

```text
maximum forward span
maximum reverse span
maximum sorted span
accuracy by span
response time
transposition errors
missing digit errors
extra digit errors
```

---

## Error analysis

Compare expected and actual answer.

Use edit-distance style diagnostics.

Classify:

```text
order error
missing digit
incorrect digit
duplicate-count error
extra digit
```

---

# 16. GAME 6: NUMBER BOX

## Objective

Given:

```text
4 source numbers
target number
```

Create an arithmetic expression that equals target.

Example:

```text
Numbers:
2 3 4 6

Target:
24
```

Potential:

```text
6 × 4 × (3 - 2)
```

---

## Allowed operations

Default:

```text
+
-
×
÷
```

Optional advanced:

```text
^
```

Do NOT enable exponentiation by default.

---

## Constraints

Default rules:

- each number must be used exactly once
- no concatenation
- parentheses allowed
- fractional intermediate values allowed
- final answer must equal target within numerical tolerance

---

## Expression builder

Prefer visual interaction.

Show number buttons:

```text
2
3
4
6
```

Clicking a number consumes it.

Operators:

```text
+
-
×
÷
(
)
```

Also support keyboard entry.

---

## Expression parser

Never use JavaScript eval.

Implement safe parser.

Use:

- AST
- shunting-yard
- parser library

Validate that:

```text
all source numbers used exactly once
only legal operators used
expression syntactically valid
result == target
```

---

## Puzzle generator

Do NOT generate arbitrary impossible puzzles.

Generate solvable puzzles by:

1. Select four source numbers.
2. Enumerate legal expressions.
3. Calculate possible target values.
4. Select target satisfying difficulty requirements.

---

## Solver

Implement exhaustive solver for four numbers.

Recursive algorithm:

1. choose two numbers
2. combine using all valid operations
3. recursively solve remaining set

Track canonical expressions to avoid duplicates.

---

## Difficulty

Easy:

- integer intermediate values
- obvious factorization
- simple multiplication

Medium:

- mixed operations
- parentheses required

Hard:

- fractional intermediates
- unintuitive pairing
- multiple layers

---

## Metrics

```text
correct puzzles
incorrect submissions
skips
average solve time
median solve time
operation frequency
difficulty solved
```

---

# 17. GAME 7: FIGURE IT OUT

Create a deduction game inspired by Mastermind and attribute-based hypothesis testing.

---

## Hidden object attributes

Configurable dimensions:

```text
shape
color
fill
border
orientation
size
```

Example:

```text
Shape:
circle
square
triangle

Color:
red
blue
green
yellow

Fill:
solid
striped
empty

Border:
thin
thick

Orientation:
0°
45°
90°

Size:
small
large
```

Each level selects subset of dimensions.

---

## Hidden target

Randomly generate:

```json
{
  "shape": "triangle",
  "color": "green",
  "fill": "striped"
}
```

User submits guesses.

---

## Feedback modes

Support configurable modes:

### Exact attribute feedback

Example:

```text
Shape ✓
Color ✗
Fill ✓
```

### Mastermind-style count

Example:

```text
2 attributes correct
```

### Correct-position versus incorrect-position mode

Optional for future variants.

---

## User interface

Display attribute controls.

Example:

```text
Shape:
○ □ △

Color:
red blue green yellow

Fill:
solid striped empty
```

User constructs candidate figure.

---

## Metrics

```text
guesses required
minimum theoretical guesses
time
repeated guesses
information efficiency
attribute changes per guess
```

---

## Information analysis

For each possible guess calculate candidate reduction.

Maintain internally:

```text
candidateStateCountBefore
candidateStateCountAfter
```

Information gain:

```text
log2(before / after)
```

Calculate average information gain per guess.

Do not reveal hidden target candidates during normal play.

Allow detailed explanation in post-game analysis.

---

## Difficulty

Increase:

- number of dimensions
- options per dimension
- ambiguity of feedback

Example:

```text
Level 1:
2 dimensions

Level 2:
3

Level 3:
4

Level 4:
5+
```

---

# 18. GAME 8: THE SWITCH

This is a task-switching game.

Two tasks appear on screen simultaneously.

The player must determine which task is active and respond YES/NO.

---

# TASK A: NUMBER / ARITHMETIC

Example:

```text
13 + 8 = 21
```

Prompt might ask:

```text
IS THE RESULT ODD?
```

Correct:

```text
YES
```

Other configurable questions:

```text
Is result even?
Is result greater than 20?
```

Start with parity only.

---

# TASK B: ARROW COMPARISON

Show:

```text
↑ ← ↓ →

↑ ← ↓ →
```

Question:

```text
ARE THEY THE SAME?
```

User responds:

```text
YES
```

Generate both matching and one-element-different arrays.

---

## Active task cue

Critical requirement:

Only one task should be active.

Use clear cue such as:

```text
NUMBER
```

or:

```text
ARROWS
```

or visual highlight around relevant task.

Difficulty can shorten cue duration.

---

## Controls

```text
F = NO
J = YES
```

Configurable.

---

## Trial generation

Control task sequence.

Track:

```text
task repetitions
task switches
```

Example:

```text
NUMBER
NUMBER
ARROWS
NUMBER
ARROWS
ARROWS
```

Target near 50% switches.

---

## Switch cost

Calculate:

```text
mean RT after repeated task
mean RT after task switch
```

Then:

```text
switchCost =
meanSwitchRT - meanRepeatRT
```

Also calculate accuracy difference.

---

## Difficulty

Increase:

```text
shorter response window
more complex arithmetic
longer arrow sequences
more subtle arrow mismatches
less prominent task cue
```

---

## Metrics

```text
overall accuracy
mean RT
switch accuracy
repeat accuracy
switch RT
repeat RT
switch cost
timeouts
false responses
```

---

# 19. GAME 9: STOCK MASTER

This game measures divided attention, timing, prediction, and reaction precision.

---

## Basic interface

Display multiple circular gauges.

Each gauge contains:

```text
needle
target zone
current angle
angular velocity
```

Needle rotates.

Player must activate gauge when needle enters target area.

---

## Layout

Example:

```text
2 × 2 grid
```

Harder:

```text
3 × 3
```

Each gauge moves independently.

---

## Gauge state

```ts
interface GaugeState {
    id: string;

    angle: number;

    angularVelocity: number;

    targetStartAngle: number;
    targetEndAngle: number;

    active: boolean;

    clicked: boolean;
}
```

---

## Controls

Option A:

click gauge.

Option B:

keyboard mapping:

```text
1 2 3
4 5 6
7 8 9
```

Keyboard mode strongly recommended.

---

## Target event

Success occurs when needle angle is inside:

```text
[targetStart, targetEnd]
```

Handle angular wraparound.

Example target:

```text
350°–15°
```

must work correctly.

---

## Scoring precision

Calculate distance from center of target.

Example:

```text
target center = 90°
needle = 93°
error = 3°
```

Normalize:

```text
precision =
1 - error / halfTargetWidth
```

Clamp to:

```text
0–1
```

---

## Early click

Click before target:

```text
EARLY
```

Late:

```text
LATE
```

No click:

```text
MISS
```

---

## Gauge scheduling

Do NOT create impossible situations unless difficulty explicitly allows them.

Control event spacing.

Easy:

```text
minimum 600 ms between target entries
```

Hard:

```text
multiple gauges may enter target within 100–250 ms
```

---

## Dynamic gauges

Later levels may:

- spawn gauges
- remove gauges
- change speed
- reverse direction
- shrink target zones

Do not introduce all mechanics immediately.

---

## Metrics

```text
successful hits
misses
early clicks
late clicks
precision
reaction time
angular error
performance by gauge count
performance under overlapping events
```

Also compute:

```text
meanTimeToTargetAtClick
```

where negative means early and positive means late.

---

# 20. DIFFICULTY SYSTEM

Every game needs:

```text
Easy
Medium
Hard
Custom
```

Never hard-code difficulty into components.

Example:

```ts
interface DifficultyProfile {
    id: string;
    parameters: Record<string, number | boolean | string>;
}
```

---

# 21. ADAPTIVE MODE

Add optional adaptive training.

Examples:

Code Compare:

```text
accuracy > 90% → shorten response window
accuracy < 70% → increase response window
```

Shapeshift:

```text
median RT < 350ms AND accuracy > 95%
→ reduce stimulus duration
```

Digit Memory:

```text
2 consecutive correct
→ span +1
```

Stock Master:

```text
high precision
→ shrink target zone
```

Adaptive mode must be separate from fixed benchmark mode.

---

# 22. FULL 9-GAME SIMULATION

Create route:

```text
/simulation
```

Flow:

```text
Simulation intro

Game 1 instructions
Game 1
short transition

Game 2
...

Game 9

Final results
```

Default ordering may be configurable.

Provide option:

```text
randomizeOrder = true/false
```

Do not randomize unless user chooses it.

---

# 23. PRACTICE MODES

Each game should offer:

### Tutorial

- untimed
- explanations
- feedback after every move

### Practice

- scores shown
- optionally unlimited retries

### Simulation

- no strategy hints
- limited feedback
- fixed difficulty
- final results only

### Custom

Allow user to configure variables.

---

# 24. RESULTS DASHBOARD

Create a dashboard showing:

```text
Game
Score
Accuracy
Median RT
Consistency
Primary weakness
Improvement vs previous attempt
```

---

## Example

```text
Code Compare

Accuracy: 94%
Median RT: 612 ms
Errors: 3
Most common error:
character mismatch near end of string

Previous median:
690 ms

Improvement:
11.3%
```

---

# 25. GAME-SPECIFIC VISUALIZATIONS

Balloon:

```text
pump threshold over time
explosions vs cash-outs
threshold by color
```

Skyscraper:

```text
optimal moves vs actual moves
```

Shapeshift:

```text
RT distribution
accuracy over time
```

Code Compare:

```text
accuracy by code length
RT by difficulty
```

Pincode:

```text
span progression
accuracy by sequence length
```

Number Box:

```text
solve time by difficulty
```

Figure It Out:

```text
guesses per puzzle
information gain
```

Switch:

```text
switch RT vs repeat RT
```

Stock Master:

```text
timing error distribution
```

---

# 26. DATABASE MODEL

Use entities approximately:

```text
User
PracticeSession
GameAttempt
RoundAttempt
Event
GameConfiguration
```

---

## PracticeSession

```text
id
user_id
mode
started_at
completed_at
seed
```

---

## GameAttempt

```text
id
session_id
game_id
difficulty
started_at
completed_at
raw_score
metrics_json
```

---

## RoundAttempt

```text
id
game_attempt_id
round_number
stimulus_json
response_json
correct
reaction_time_ms
score
```

---

## Event

```text
id
game_attempt_id
round_number
event_type
timestamp_ms
payload_json
```

---

# 27. API

Suggested endpoints:

```text
POST /api/sessions
GET /api/sessions/{id}

POST /api/sessions/{id}/games/start

POST /api/game-attempts/{id}/rounds

POST /api/game-attempts/{id}/events

POST /api/game-attempts/{id}/complete

GET /api/users/{id}/analytics
GET /api/users/{id}/history
```

Do NOT send every millisecond animation update to backend.

Store important behavioral events only.

---

# 28. CLIENT-SIDE BUFFERING

Telemetry should initially accumulate locally.

Batch upload:

```text
every 10–25 events
```

or:

```text
after each round
```

Prevent network latency from affecting gameplay.

---

# 29. SCORING NORMALIZATION

Do NOT create fake Optiver percentiles.

Create internal practice normalization.

Possible model:

```text
accuracy component
speed component
consistency component
game-specific component
```

Example:

```text
PracticeScore = 0–100
```

But display raw metrics prominently.

Never make the combined score more important than:

```text
accuracy
reaction time
planning efficiency
memory span
risk behavior
```

---

# 30. PERFORMANCE REQUIREMENTS

For reaction-based games:

Input-handling overhead should be minimal.

Aim for:

```text
60 FPS minimum
```

Do not trigger unnecessary React rerenders every animation frame.

For Stock Master especially:

use:

```text
Canvas + requestAnimationFrame
```

instead of rerendering all gauges through React every frame.

---

# 31. RESPONSIVENESS

Desktop is primary.

Minimum recommended:

```text
1280×720
```

Support smaller sizes gracefully.

Reaction games should warn if viewport is too small rather than radically rearranging positions during active gameplay.

---

# 32. ACCESSIBILITY

Before gameplay:

- clearly explain controls
- support keyboard navigation
- provide non-color-only distinctions where possible

However, because some tasks intentionally use visual discrimination, accessibility adaptations must not silently change test difficulty.

Allow accessibility mode separately.

---

# 33. AUDIO

Default:

```text
OFF
```

Optional sounds:

```text
correct
incorrect
explosion
round start
```

Reaction-time games should not depend on audio.

---

# 34. PAUSING

Practice mode:

pause allowed.

Simulation mode:

pause disabled during active rounds.

Allow pause between games.

---

# 35. FOCUS DETECTION

Track:

```text
window blur
tab visibility changes
```

If simulation loses browser focus:

record:

```text
FOCUS_LOST
```

Do not automatically accuse user of cheating.

Simply annotate attempt.

---

# 36. TESTING REQUIREMENTS

Every game must have unit tests for:

```text
state transitions
scoring
random generation
difficulty
edge cases
```

---

## Balloon

Test:

```text
explosion at exact breakpoint
cash out
penalty calculation
seed reproducibility
```

---

## Skyscraper

Test:

```text
legal move detection
illegal move rejection
BFS optimal move calculation
solvable puzzle generation
```

---

## Shapeshift

Test:

```text
correct mapping
wrong key
timeout
anticipatory response
```

---

## Code Compare

Test:

```text
only one exact match
all distractors differ
code length
mutation generation
```

---

## Pincode

Test:

```text
forward comparison
reverse transformation
sorting with duplicates
adaptive span
```

---

## Number Box

Test:

```text
expression parsing
use each number once
division
fractions
invalid expressions
solver correctness
```

---

## Figure It Out

Test:

```text
feedback computation
candidate-space reduction
attribute combinations
```

---

## Switch

Test:

```text
parity
arrow comparison
task switching
switch-cost calculation
```

---

## Stock Master

Test:

```text
angle normalization
wraparound target
early/late classification
precision calculation
```

---

# 37. PLAYWRIGHT END-TO-END TESTING

Automate:

```text
home page
select game
view instructions
start tutorial
complete game
results screen
new attempt
history
```

At least one complete E2E test for every game.

---

# 38. DEBUG MODE

Add development-only debug tools.

URL example:

```text
?debug=true
```

Allow:

```text
show hidden balloon breakpoint
show tower optimal solution
show Code Compare correct answer
show Figure It Out hidden target
show Stock Master target trajectory
```

Never expose debug information in production simulation mode.

---

# 39. CONFIGURATION EDITOR

Create internal developer page:

```text
/admin/game-config
```

Allow editing values like:

```text
trial counts
time limits
difficulty
reward values
response windows
number of gauges
sequence lengths
```

Allow exporting/importing JSON.

---

# 40. CONFIG VERSIONING

Each attempt stores:

```text
configVersion
```

Example:

```text
zapn-simulator-v1.2
```

This prevents comparing results generated under different rules without knowing it.

---

# 41. ANALYTICS ENGINE

Build reusable functions:

```ts
mean()
median()
percentile()
standardDeviation()
accuracy()
movingAverage()
```

Reaction time should generally emphasize:

```text
median
```

rather than mean because extreme values skew averages.

Show both.

---

# 42. TRAINING INSIGHTS

Generate basic deterministic insights.

Examples:

### Code Compare

```text
Accuracy is high, but responses become significantly slower for 8+ character sequences.
```

### Switch

```text
Your median response after a task switch is 142 ms slower than after repeated tasks.
```

### Balloon

```text
Your pump threshold decreased sharply after explosions, suggesting high trial-to-trial sensitivity.
```

### Pincode

```text
Forward span is strong, but reverse recall drops by two digits.
```

No LLM required initially.

Rules-based insights are enough.

---

# 43. DATA EXPORT

Allow user to export:

```text
CSV
JSON
```

For every attempt include:

```text
timestamp
game
round
stimulus
response
correctness
reaction time
score
```

---

# 44. LOCAL MODE

The app should work without account creation.

Use:

```text
localStorage
```

or IndexedDB.

If user signs in later:

sync history to backend.

---

# 45. UI DESIGN

Visual style:

- minimal
- professional
- high contrast
- no distracting animations
- dark and light mode
- large centered game area
- clear typography

Do NOT make it look like a casino.

Avoid:

- excessive gradients
- unnecessary sound
- particles
- decorative clutter

Games should feel like cognitive assessment tools.

---

# 46. HOME SCREEN

Display nine cards:

```text
Balloon
Skyscraper
Shapeshift
Code Compare
Pincode
Number Box
Figure It Out
The Switch
Stock Master
```

Each shows:

```text
Primary skill
Best previous result
Practice
Tutorial
```

Also include:

```text
Start Full Simulation
Custom Session
Performance Dashboard
```

---

# 47. INSTRUCTION SCREEN

Every game instruction screen must explain:

```text
Objective
Controls
Scoring
Example
What causes failure
Tutorial button
Start button
```

Avoid explaining strategy in simulation mode.

---

# 48. FIRST DEVELOPMENT MILESTONE

Implement foundational infrastructure:

- frontend shell
- routing
- shared game engine
- timing utilities
- seed system
- telemetry
- results model
- local persistence

Then implement only:

```text
Balloon
Shapeshift
Code Compare
```

These validate:

- decision game
- reaction game
- timed discrimination game

Write tests.

Do not continue until architecture is clean.

---

# 49. SECOND MILESTONE

Implement:

```text
Pincode
Number Box
The Switch
```

Add:

```text
adaptive difficulty
analytics dashboard
```

---

# 50. THIRD MILESTONE

Implement:

```text
Skyscraper
Figure It Out
Stock Master
```

These require more sophisticated algorithms/game loops.

---

# 51. FOURTH MILESTONE

Implement:

```text
full simulation
history
comparison
CSV export
config editor
```

---

# 52. FINAL QUALITY PASS

Verify all of the following:

- no memory leaks
- no duplicate keyboard listeners
- no double submission
- no accidental input after round completion
- no timing based on render cycles
- no invalid generated puzzles
- no impossible Number Box questions
- no unsolvable Towers levels
- no duplicate Code Compare correct choices
- no leaked Balloon breakpoint
- no hidden target revealed in Figure It Out
- no angle wraparound bugs in Stock Master
- no incorrectly calculated task switch metrics

---

# 53. EXPECTED DELIVERABLES

Produce:

```text
1. Complete repository
2. README
3. Architecture documentation
4. Setup instructions
5. Docker configuration
6. Database migrations
7. Seeded test fixtures
8. Unit tests
9. Integration tests
10. E2E tests
11. Game configuration documentation
12. Scoring documentation
13. Telemetry documentation
```

README must include:

```bash
git clone ...
cd zapn-practice
docker compose up
```

and local-development alternatives.

---

# 54. IMPLEMENTATION RULES FOR THE AGENT

Do NOT merely create placeholder screens.

Every game must be genuinely playable.

Do NOT leave comments such as:

```text
TODO: implement solver
TODO: calculate score
TODO: generate puzzle
```

for core functionality.

Implement underlying algorithms completely.

Do not duplicate shared logic.

Do not use random values directly throughout components.

Randomness must flow through the seeded RNG abstraction.

Do not create giant React components.

Aim for:

```text
game logic
UI
scoring
generation
analytics
```

as separate modules.

---

# 55. REQUIRED GAME MODULE STRUCTURE

Each game should approximately contain:

```text
game-name/
│
├── Game.tsx
├── engine.ts
├── generator.ts
├── scoring.ts
├── analytics.ts
├── config.ts
├── types.ts
├── instructions.tsx
├── Results.tsx
└── __tests__/
```

For example:

```text
games/balloon/
├── BalloonGame.tsx
├── balloonEngine.ts
├── balloonGenerator.ts
├── balloonScoring.ts
├── balloonAnalytics.ts
├── balloonConfig.ts
├── balloonTypes.ts
└── __tests__/
```

---

# 56. FINAL ACCEPTANCE CRITERIA

The project is complete only when a user can:

1. Open the website.
2. Select any of the nine games.
3. Read instructions.
4. Complete a tutorial.
5. Play a complete timed attempt.
6. Receive correct scoring.
7. See detailed analytics.
8. Replay with the same seed.
9. Compare the attempt with previous results.
10. Run the entire nine-game simulation without reloading the page.

All nine games must work:

```text
✓ Balloon
✓ Skyscraper
✓ Shapeshift
✓ Code Compare
✓ Pincode
✓ Number Box
✓ Figure It Out
✓ The Switch
✓ Stock Master
```

Barbecue / Grill Master must NOT be implemented.

The final product should behave like a serious cognitive-assessment training application, not nine unrelated mini-games.