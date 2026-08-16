# Cortex Practice Lab

Cortex is an independent, desktop-first browser cognitive assessment practice simulator aligned to the public [Quant Career Hub Zap-N guide](https://quantcareerhub.com/blog/optiver-zap-n-test-guide) and the non-proprietary practice references it links. It contains exactly nine playable games: Balloon, Skyscraper, Shapeshift, Code Compare, Digit, Number Box, Figure It Out, The Switch, and Stock Master. Every game has five deterministic training levels, from Foundation to Extreme, which increase its core cognitive load rather than merely repeating more rounds.

The product never presents a score as an Optiver score or pass cutoff. `Practice Score` is a configurable simulator heuristic; raw accuracy, reaction time, planning efficiency, memory span, information gain, and timing precision remain primary.

## Quick start with Docker

```bash
git clone <repository-url>
cd ZapN
docker compose up --build
```

Open `http://localhost:3000`. The optional FastAPI service is at `http://localhost:8000/docs` and PostgreSQL is exposed locally on port `5432`.

## Local development

Requires Node.js 22.13+.

```bash
npm install
npm run dev
```

To run the API separately:

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `.env.example` to `.env` when using the API. The browser product is local-first and requires no account; attempt history is stored on the current device. JSON and CSV exports are available from Performance.

## Quality checks

```bash
npm run test:unit
npm run build
npm test
```

The unit suite covers seeded generation and core edge cases for all nine games. The application also exposes:

- `/simulation` — full nine-game session entry
- `/admin/game-config` — local developer configuration editor
- `?debug=true` in development — reproducible hidden-state diagnostics; never shown in production simulation mode

## Architecture

- `app/` — shell, routes, responsive design, history, dashboard, sessions
- `games/<game>/` — independent UI and pure engine for every game
- `lib/` — seeded RNG, analytics, results, telemetry, catalog, persistence
- `tests/unit/` — deterministic engine tests for every game
- `backend/` — optional FastAPI/PostgreSQL session and event persistence
- `docs/` — architecture, scoring, telemetry, and configuration reference

See [Architecture](docs/architecture.md), [Scoring](docs/scoring.md), [Telemetry](docs/telemetry.md), and [Game configuration](docs/game-configuration.md).

## Product boundaries

This is practice software, not a reproduction of proprietary assessment software or undisclosed scoring. Cognitive labels and combined scores are simulator heuristics. Do not infer employer percentiles, selection outcomes, or pass thresholds from results.
