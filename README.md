# Cortex Practice Lab

Cortex is a desktop-first web practice simulator for nine cognitive games described in the public [Quant Career Hub Zap-N guide](https://quantcareerhub.com/blog/optiver-zap-n-test-guide). It is an independent training project built from public task descriptions—not proprietary assessment software.

**Live website:** [cortex-practice-lab.hrishikesh-bhardwaj5.chatgpt.site](https://cortex-practice-lab.hrishikesh-bhardwaj5.chatgpt.site/)

## What is included

- Balloon
- Skyscraper
- Shapeshift
- Code Compare
- Digit
- Number Box
- Figure It Out
- The Switch
- Stock Master

Every game includes five deterministic training levels, from **L1 Foundation** to **L5 Extreme**. Higher levels increase the game’s core load—such as memory span, stimulus density, timing pressure, rule switching, or divided attention—instead of only adding more rounds.

Other features include seeded replay, tutorials, timed and untimed practice, pause/resume, local attempt history, JSON/CSV export, a nine-game simulation route, and per-level results. `Practice Score` is a simulator heuristic, not an Optiver score, percentile, or pass cutoff.

## Run locally

### Node.js

Requirements:

- Node.js 22.13 or newer
- npm

```bash
git clone https://github.com/hrishi-bhardwaj55/ZapN.git
cd ZapN
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The browser app works without the optional API; attempt history is stored in the current browser.

### Docker

With Docker Desktop running:

```bash
git clone https://github.com/hrishi-bhardwaj55/ZapN.git
cd ZapN
docker compose up --build
```

Then open:

- Web app: [http://localhost:3000](http://localhost:3000)
- Optional API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- PostgreSQL: `localhost:5432`

Stop the stack with `docker compose down`.

## Optional API development

The React web app is fully usable without the API. To run the FastAPI service separately on Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `.env.example` to `.env` when using the API or Docker services that require environment configuration.

## Useful routes

- `/` — game library and individual practice
- `/simulation` — full nine-game session
- `/admin/game-config` — local developer configuration editor
- `/?debug=true` — seeded diagnostic hints during local development

Debug hints are never shown in production simulation mode.

## Quality checks

```bash
npm run test:unit
npm run test:e2e
npm run lint
npx tsc --noEmit
npm test
```

The repository includes deterministic engine tests for every game and browser tests for tutorials, L1/L5 progression, clicks and keyboard input, pause guards, result persistence, console errors, and desktop layout at 1440×900 and 1024×768.

## Project structure

```text
app/                 Application shell, routes, dashboard, and responsive UI
games/<game>/        Independent React UI and deterministic engine per game
lib/                 Catalog, levels, seeded RNG, scoring, telemetry, storage
tests/unit/          Engine and edge-case tests for all nine games
tests/e2e/           Full browser flows and per-game level QA
backend/             Optional FastAPI/PostgreSQL persistence service
docs/                Architecture, scoring, telemetry, and configuration
```

Further documentation:

- [Architecture](docs/architecture.md)
- [Scoring](docs/scoring.md)
- [Telemetry](docs/telemetry.md)
- [Game configuration](docs/game-configuration.md)

## Product boundary

This project does not reproduce undisclosed test content, employer scoring, pass thresholds, or selection outcomes. Cognitive labels and combined scores are training heuristics based on public descriptions. Do not interpret results as employer percentiles or hiring predictions.
