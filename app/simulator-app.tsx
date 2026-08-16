"use client";

import { useEffect, useMemo, useState } from "react";
import { BalloonGame } from "@/games/balloon/BalloonGame";
import { CodeCompareGame } from "@/games/code-compare/CodeCompareGame";
import { FigureItOutGame } from "@/games/figure-it-out/FigureItOutGame";
import { NumberBoxGame } from "@/games/number-box/NumberBoxGame";
import { PincodeGame } from "@/games/pincode/PincodeGame";
import { ShapeshiftGame } from "@/games/shapeshift/ShapeshiftGame";
import { SkyscraperGame } from "@/games/skyscraper/SkyscraperGame";
import { StockMasterGame } from "@/games/stock-master/StockMasterGame";
import { SwitchGame } from "@/games/switch/SwitchGame";
import { GAME_MAP, GAME_ORDER, GAMES } from "@/lib/catalog";
import { formatMs, mean, seededRandom, shuffle, uid } from "@/lib/engine";
import { primaryWeakness, resultInsight } from "@/lib/insights";
import { LEVELS, levelDefinition, levelNote } from "@/lib/levels";
import { clearHistory, exportCsv, exportJson, loadHistory, loadTheme, saveResult, saveTheme } from "@/lib/storage";
import type { Difficulty, GameId, GameLevel, GameMode, GameProps, GameResult } from "@/lib/types";

type View = "home" | "instructions" | "game" | "result" | "dashboard" | "custom" | "simulation-intro" | "transition" | "session-summary" | "config";

const GAME_COMPONENTS: Record<GameId, React.ComponentType<GameProps>> = {
  balloon: BalloonGame,
  skyscraper: SkyscraperGame,
  shapeshift: ShapeshiftGame,
  "code-compare": CodeCompareGame,
  pincode: PincodeGame,
  "number-box": NumberBoxGame,
  "figure-it-out": FigureItOutGame,
  switch: SwitchGame,
  "stock-master": StockMasterGame,
};

type ConfigState = Record<GameId, { trials: number; timeLimitMs: number; adaptive: boolean; presentationMode?: "mixed" | "simultaneous" | "sequential"; interDigitDelayMs?: number }>;

const DEFAULT_CONFIG: ConfigState = {
  balloon: { trials: 0, timeLimitMs: 0, adaptive: false },
  skyscraper: { trials: 0, timeLimitMs: 0, adaptive: false },
  shapeshift: { trials: 0, timeLimitMs: 0, adaptive: true },
  "code-compare": { trials: 0, timeLimitMs: 0, adaptive: true },
  pincode: { trials: 0, timeLimitMs: 0, adaptive: true, presentationMode: "sequential", interDigitDelayMs: 0 },
  "number-box": { trials: 0, timeLimitMs: 0, adaptive: false },
  "figure-it-out": { trials: 0, timeLimitMs: 0, adaptive: false },
  switch: { trials: 0, timeLimitMs: 0, adaptive: true },
  "stock-master": { trials: 0, timeLimitMs: 0, adaptive: true },
};

const CONFIG_STORAGE_KEY = "cortex-game-config-v3";
const LEVEL_STORAGE_KEY = "cortex-training-level";
const TIMED_GAMES = new Set<GameId>(["shapeshift", "code-compare", "pincode", "number-box", "switch", "stock-master"]);

function ScoreRing({ score }: { score: number }) {
  const rounded = Math.round(score);
  return <div className="score-ring" style={{ "--score": `${rounded * 3.6}deg` } as React.CSSProperties}><span><strong>{rounded}</strong><small>Practice score</small></span></div>;
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function LevelPicker({ level, onChange, gameId }: { level: GameLevel; onChange?: (level: GameLevel) => void; gameId?: GameId }) {
  const definition = levelDefinition(level);
  return (
    <div className="level-picker">
      <div className="level-picker-head"><small>TRAINING LEVEL</small><strong>L{level} · {definition.name}</strong></div>
      <div className="level-tabs" role="group" aria-label="Training level">
        {LEVELS.map((item) => <button type="button" key={item.id} className={level === item.id ? "active" : ""} aria-pressed={level === item.id} disabled={!onChange} onClick={() => onChange?.(item.id)}>L{item.id}</button>)}
      </div>
      <p>{gameId ? levelNote(gameId, level) : definition.summary}</p>
    </div>
  );
}

function primaryResultMetric(result: GameResult) {
  if (result.gameId === "balloon") return {
    label: "ADJUSTED AVG PUMPS",
    value: (result.metrics.adjustedAveragePumps || 0).toFixed(1),
    detail: `$${Math.round(result.metrics.bankedMoney || 0)} banked · ${Math.round(result.metrics.explosions || 0)} bursts`,
  };
  if (result.gameId === "skyscraper") return {
    label: "PLANNING EFFICIENCY",
    value: `${Math.round(result.metrics.planningEfficiency || 0)}%`,
    detail: `${result.metrics.actualMoves} actual · ${result.metrics.optimalMoves} optimal · ${result.metrics.invalidMoves} invalid`,
  };
  if (result.gameId === "figure-it-out") return {
    label: "DEDUCTION",
    value: result.metrics.solved ? "Solved" : "Unsolved",
    detail: `${Math.round(result.metrics.guessesRequired || 0)} guesses · ${(result.metrics.averageInformationGain || 0).toFixed(2)} bits/guess`,
  };
  if (result.gameId === "pincode") return {
    label: "REPEAT · REVERSE · SORT",
    value: `${Math.round(result.metrics.repeatAccuracy || 0)}% · ${Math.round(result.metrics.reverseAccuracy || 0)}% · ${Math.round(result.metrics.sortAccuracy || 0)}%`,
    detail: `Max spans ${Math.round(result.metrics.forwardMaxSpan || 0)} · ${Math.round(result.metrics.reverseMaxSpan || 0)} · ${Math.round(result.metrics.sortedMaxSpan || 0)}`,
  };
  if (result.gameId === "stock-master") return {
    label: "TARGET HITS",
    value: `${Math.round(result.accuracy)}%`,
    detail: `${Math.round(result.metrics.successfulHits || 0)} hits · best streak ${Math.round(result.metrics.bestStreak || 0)}`,
  };
  return {
    label: "ACCURACY",
    value: `${Math.round(result.accuracy)}%`,
    detail: `${result.correct} / ${result.totalRounds} correct`,
  };
}

export function SimulatorApp({ initialView = "home" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [selectedGame, setSelectedGame] = useState<GameId>("balloon");
  const [mode, setMode] = useState<GameMode>("practice");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [level, setLevel] = useState<GameLevel>(3);
  const [timed, setTimed] = useState(true);
  const [paused, setPaused] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [history, setHistory] = useState<GameResult[]>([]);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [sessionQueue, setSessionQueue] = useState<GameId[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState<GameResult[]>([]);
  const [customGames, setCustomGames] = useState<GameId[]>(["balloon", "shapeshift", "code-compare"]);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [sessionId, setSessionId] = useState(() => uid());
  const [seed, setSeed] = useState(() => new Date().toISOString().slice(0, 10));
  const [replaySeed, setReplaySeed] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [configText, setConfigText] = useState("");

  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "true" && process.env.NODE_ENV !== "production";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory(loadHistory());
      const storedTheme = loadTheme();
      setTheme(storedTheme);
      document.documentElement.dataset.theme = storedTheme;
      try {
        const storedLevel = Number(localStorage.getItem(LEVEL_STORAGE_KEY));
        if ([1, 2, 3, 4, 5].includes(storedLevel)) setLevel(storedLevel as GameLevel);
        const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (saved) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      } catch {
        /* Ignore malformed local configuration and retain reference defaults. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onPopState = () => setView("home");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const bestByGame = useMemo(() => {
    const best = new Map<GameId, number>();
    history.filter((result) => (result.level ?? 3) === level).forEach((result) => best.set(result.gameId, Math.max(best.get(result.gameId) ?? 0, result.rawScore)));
    return best;
  }, [history, level]);

  const selectLevel = (nextLevel: GameLevel) => {
    setLevel(nextLevel);
    localStorage.setItem(LEVEL_STORAGE_KEY, String(nextLevel));
  };

  const openInstructions = (gameId: GameId, nextMode: GameMode) => {
    setSelectedGame(gameId);
    setMode(nextMode);
    setSessionQueue([]);
    setSessionResults([]);
    setReplaySeed(null);
    setView("instructions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const beginSeries = (games: GameId[], nextMode: GameMode) => {
    const ordered = randomizeOrder ? shuffle(games, seededRandom(`${seed}:game-order`)) : games;
    setSessionId(uid("series"));
    setSessionQueue(ordered);
    setSessionResults([]);
    setSessionIndex(0);
    setReplaySeed(null);
    setSelectedGame(ordered[0]);
    setMode(nextMode);
    setView("instructions");
  };

  const startCurrent = (nextMode = mode) => {
    setMode(nextMode);
    if (!sessionQueue.length) setSessionId(uid());
    setPaused(false);
    setView("game");
    window.scrollTo({ top: 0 });
  };

  const onGameFinish = (result: GameResult) => {
    if (result.mode !== "tutorial") {
      const nextHistory = saveResult(result);
      setHistory(nextHistory);
    }
    setLastResult(result);
    if (sessionQueue.length) {
      const nextResults = [...sessionResults, result];
      setSessionResults(nextResults);
      setView(sessionIndex + 1 < sessionQueue.length ? "transition" : "session-summary");
    } else {
      setView("result");
    }
    window.scrollTo({ top: 0 });
  };

  const advanceSeries = () => {
    const nextIndex = sessionIndex + 1;
    setSessionIndex(nextIndex);
    setSelectedGame(sessionQueue[nextIndex]);
    setView("instructions");
    window.scrollTo({ top: 0 });
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const goHome = () => {
    setView("home");
    setSessionQueue([]);
    setSessionResults([]);
    window.history.pushState({}, "", "/");
  };

  const game = GAME_MAP[selectedGame];
  const instructionIsTimed = timed && (TIMED_GAMES.has(selectedGame) || (selectedGame === "balloon" && mode === "simulation"));
  const ActiveGame = GAME_COMPONENTS[selectedGame];
  const previousForLast = lastResult ? history.find((result) => result.gameId === lastResult.gameId && result.id !== lastResult.id && result.difficulty === lastResult.difficulty && (result.level ?? 3) === (lastResult.level ?? 3) && result.configVersion === lastResult.configVersion) : null;
  const resultPrimary = lastResult ? primaryResultMetric(lastResult) : null;

  return (
    <div className="app-shell">
      {view !== "game" && (
        <header className="site-header">
          <button className="brand" onClick={goHome} aria-label="Cortex Practice home"><BrandMark /><span>CORTEX</span><small>practice lab</small></button>
          <nav aria-label="Primary navigation">
            <button onClick={() => setView("home")} className={view === "home" ? "active" : ""}>Games</button>
            <button onClick={() => setView("dashboard")} className={view === "dashboard" ? "active" : ""}>Performance</button>
            <button onClick={() => setView("custom")} className={view === "custom" ? "active" : ""}>Custom session</button>
          </nav>
          <div className="header-actions"><span className="local-pill">LOCAL PROFILE</span><button className="icon-button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? "◐" : "◑"}</button></div>
        </header>
      )}

      {view === "home" && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><i className="live-dot" /> COGNITIVE PRACTICE PLATFORM</span>
              <h1>Train the decisions<br />between <em>signal</em> and noise.</h1>
              <p>Nine focused cognitive tasks. Reproducible sessions. Clear feedback on speed, accuracy, planning, memory, and risk.</p>
              <div className="hero-actions"><button className="btn primary" onClick={() => setView("simulation-intro")}>Start full simulation <span>→</span></button><button className="btn secondary" onClick={() => setView("dashboard")}>View performance</button></div>
              <p className="disclaimer">Independent practice simulator based on public task descriptions. No proprietary scores or pass cutoffs.</p>
            </div>
            <div className="hero-panel">
              <div className="session-card">
                <div className="session-card-head"><span>NEXT SESSION</span><strong>Full circuit</strong></div>
                <div className="session-orbit"><BrandMark /><span>9</span><small>games</small></div>
                <div className="session-stats"><span><small>EST. TIME</small><strong>30 min</strong></span><span><small>DIFFICULTY</small><strong>{difficulty}</strong></span></div>
                <div className="difficulty-tabs" aria-label="Difficulty">{(["easy", "medium", "hard"] as Difficulty[]).map((level) => <button key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>{level}</button>)}</div>
                <LevelPicker level={level} onChange={selectLevel} />
              </div>
              <div className="precision-lines" aria-hidden="true"><i /><i /><i /><i /></div>
            </div>
          </section>

          <section className="game-library">
            <div className="section-heading"><div><span className="eyebrow">PRACTICE LIBRARY</span><h2>Nine skills. One integrated system.</h2></div><div className="practice-controls"><label><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} /> Timed where supported</label><span>Seed <code>{seed}</code></span></div></div>
            <div className="game-grid">
              {GAMES.map((item, index) => (
                <article className="game-card" key={item.id} style={{ "--accent": item.accent } as React.CSSProperties}>
                  <div className="card-top"><span className="game-index">0{index + 1}</span><span className="game-glyph">{item.glyph}</span><span className="best-score">{bestByGame.has(item.id) ? `L${level} BEST ${Math.round(bestByGame.get(item.id)!)} ` : `L${level} NOT TRAINED`}</span></div>
                  <span className="card-kicker">{item.kicker}</span><h3>{item.name}</h3><p>{item.description}</p>
                  <div className="card-actions"><button onClick={() => openInstructions(item.id, "practice")}>Practice <span>→</span></button><button onClick={() => openInstructions(item.id, "tutorial")}>Tutorial</button></div>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === "instructions" && (
        <main className="contained-page instructions-page">
          <button className="back-link" onClick={sessionQueue.length ? () => setView("simulation-intro") : goHome}>← Back</button>
          {sessionQueue.length > 0 && <div className="series-progress"><span>SESSION PROGRESS</span><div>{sessionQueue.map((id, index) => <i key={id} className={index < sessionIndex ? "done" : index === sessionIndex ? "active" : ""} />)}</div><strong>{sessionIndex + 1} / {sessionQueue.length}</strong></div>}
          <section className="instruction-layout" style={{ "--accent": game.accent } as React.CSSProperties}>
            <div className="instruction-main">
              <span className="game-number">{String(GAME_ORDER.indexOf(game.id) + 1).padStart(2, "0")} / 09</span><span className="card-kicker">{game.kicker}</span><h1>{game.name}</h1><p className="instruction-lead">{game.description}</p>
              <LevelPicker level={level} onChange={mode === "simulation" ? undefined : selectLevel} gameId={game.id} />
              <div className="instruction-sections"><div><small>OBJECTIVE</small><p>{game.skill}.</p></div><div><small>CONTROLS</small><p>{game.controls}</p></div><div><small>SCORING</small><p>{game.scoring}</p></div><div><small>WHAT CAUSES FAILURE</small><p>{game.failure}</p></div><div><small>EXAMPLE</small><p>{game.example}</p></div></div>
              <div className="instruction-actions">{mode !== "simulation" && <button className="btn secondary" onClick={() => startCurrent("tutorial")}>Run tutorial</button>}<button className="btn primary" onClick={() => startCurrent(mode === "tutorial" ? "practice" : mode)}>{mode === "simulation" ? "Begin assessment" : "Start practice"} <span>→</span></button></div>
            </div>
            <div className="instruction-visual"><span className="visual-glyph">{game.glyph}</span><div><small>LEVEL</small><strong>L{level} · {levelDefinition(level).name}</strong></div><div><small>DIFFICULTY</small><strong>{difficulty}</strong></div><div><small>TIMING</small><strong>{instructionIsTimed ? "Timed" : "Untimed"}</strong></div><div><small>SEED</small><code>{replaySeed ?? seed}</code></div></div>
          </section>
        </main>
      )}

      {view === "game" && (
        <main className="game-page">
          <div className="game-topline"><button onClick={() => setView("instructions")}>← Exit attempt</button><span><BrandMark /> CORTEX</span><span>{mode !== "simulation" && <button className="pause-link" onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>} {mode.toUpperCase()} · L{level} · {difficulty.toUpperCase()}</span></div>
          <div className={paused ? "paused-game" : ""}>
            <ActiveGame key={`${sessionId}-${selectedGame}-${mode}-${level}`} seed={replaySeed ?? `${seed}:${selectedGame}`} difficulty={difficulty} level={level} mode={mode} timed={timed} paused={paused} config={config[selectedGame]} sessionId={sessionId} debug={debug} onFinish={onGameFinish} />
            {paused && <div className="pause-overlay" role="dialog" aria-label="Game paused"><span>PAUSED</span><h2>Take a breath.</h2><p>Timing and controls resume when you are ready.</p><button className="btn primary" onClick={() => setPaused(false)}>Resume attempt</button></div>}
          </div>
        </main>
      )}

      {view === "transition" && (
        <main className="contained-page transition-page">
          <span className="eyebrow">GAME {sessionIndex + 1} COMPLETE</span>{mode === "simulation" ? <div className="complete-mark" aria-label="Game logged">✓</div> : <ScoreRing score={sessionResults.at(-1)?.rawScore ?? 0} />}<h1>{GAME_MAP[sessionQueue[sessionIndex]].name} logged.</h1><p>Your detailed feedback is held until the end of this session.</p>
          <div className="next-game-card"><small>UP NEXT</small><strong>{GAME_MAP[sessionQueue[sessionIndex + 1]].name}</strong><span>{GAME_MAP[sessionQueue[sessionIndex + 1]].skill}</span></div><button className="btn primary" onClick={advanceSeries}>Continue <span>→</span></button>
        </main>
      )}

      {view === "result" && lastResult && (
        <main className="contained-page results-page">
          <button className="back-link" onClick={goHome}>← Practice library</button>
          <section className="result-hero"><div><span className="eyebrow">ATTEMPT COMPLETE</span><h1>{GAME_MAP[lastResult.gameId].name}</h1><p>{new Date(lastResult.completedAt).toLocaleString()} · L{lastResult.level ?? 3} {levelDefinition(lastResult.level ?? 3).name} · {lastResult.difficulty} · seeded run</p></div><ScoreRing score={lastResult.rawScore} /></section>
          <section className="metric-grid"><div><small>{resultPrimary!.label}</small><strong>{resultPrimary!.value}</strong><span>{resultPrimary!.detail}</span></div><div><small>MEDIAN RESPONSE</small><strong>{formatMs(lastResult.medianReactionTime)}</strong><span>Mean {formatMs(lastResult.meanReactionTime)}</span></div><div><small>CONSISTENCY</small><strong>{lastResult.metrics.consistencyMs ? `${Math.round(lastResult.metrics.consistencyMs)} ms` : "Stable"}</strong><span>Lower variation is better</span></div><div><small>VS PREVIOUS</small><strong>{previousForLast ? `${lastResult.rawScore >= previousForLast.rawScore ? "+" : ""}${Math.round(lastResult.rawScore - previousForLast.rawScore)}` : "First run"}</strong><span>Comparable simulator version</span></div></section>
          <section className="analysis-card"><div><span className="eyebrow">TRAINING INSIGHT</span><h2>{primaryWeakness(lastResult)}</h2><p>{resultInsight(lastResult)}</p></div><div className="rt-bars">{lastResult.rounds.slice(0, 12).map((round) => <i key={round.round} className={round.correct ? "correct" : "incorrect"} style={{ height: `${Math.max(16, Math.min(100, round.reactionTimeMs / 25))}%` }} title={`Round ${round.round}: ${Math.round(round.reactionTimeMs)} ms`} />)}</div></section>
          <div className="result-actions"><button className="btn primary" onClick={() => { setDifficulty(lastResult.difficulty); selectLevel(lastResult.level ?? 3); openInstructions(lastResult.gameId, "practice"); }}>New attempt</button><button className="btn secondary" onClick={() => { setSelectedGame(lastResult.gameId); setDifficulty(lastResult.difficulty); selectLevel(lastResult.level ?? 3); setMode("practice"); setSessionQueue([]); setSessionResults([]); setReplaySeed(lastResult.seed); setView("instructions"); }}>Replay seed</button><button className="btn ghost" onClick={() => setView("dashboard")}>View history</button></div>
        </main>
      )}

      {view === "simulation-intro" && (
        <main className="contained-page simulation-page">
          <button className="back-link" onClick={goHome}>← Practice library</button>
          <section className="simulation-intro"><div><span className="eyebrow">FULL CIRCUIT</span><h1>Nine games.<br />One continuous session.</h1><p>Instructions appear before each game. Strategy hints and immediate analytics stay hidden until the full circuit is complete.</p><LevelPicker level={level} onChange={selectLevel} /><div className="simulation-options"><label><input type="checkbox" checked={randomizeOrder} onChange={(event) => setRandomizeOrder(event.target.checked)} /> Randomize game order</label><label><span>Session seed</span><input value={seed} onChange={(event) => setSeed(event.target.value)} /></label></div><button className="btn primary" onClick={() => beginSeries(GAME_ORDER, "simulation")}>Begin L{level} simulation <span>→</span></button></div><ol className="circuit-list">{GAMES.map((item, index) => <li key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><small>{item.skill}</small></div><i style={{ background: item.accent }} /></li>)}</ol></section>
        </main>
      )}

      {view === "custom" && (
        <main className="contained-page custom-page">
          <div className="page-heading"><span className="eyebrow">CUSTOM SESSION</span><h1>Build a focused training block.</h1><p>Select at least one game. Your chosen order is preserved unless randomization is enabled.</p><LevelPicker level={level} onChange={selectLevel} /></div>
          <div className="custom-grid">{GAMES.map((item, index) => { const checked = customGames.includes(item.id); return <label key={item.id} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} onChange={() => setCustomGames((games) => checked ? games.filter((id) => id !== item.id) : [...games, item.id])} /><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.name}</strong><small>{item.kicker}</small></div><i>{checked ? "✓" : "+"}</i></label>; })}</div>
          <div className="custom-footer"><label><input type="checkbox" checked={randomizeOrder} onChange={(event) => setRandomizeOrder(event.target.checked)} /> Randomize order</label><span>{customGames.length} games · approx. {customGames.length * 3} min</span><button className="btn primary" disabled={!customGames.length} onClick={() => beginSeries(customGames, "practice")}>Start custom session <span>→</span></button></div>
        </main>
      )}

      {view === "session-summary" && (
        <main className="contained-page results-page session-results">
          <section className="result-hero"><div><span className="eyebrow">SESSION COMPLETE</span><h1>{sessionQueue.length === 9 ? "Full circuit" : "Custom block"}</h1><p>{sessionResults.length} games completed without a page reload.</p></div><ScoreRing score={mean(sessionResults.map((result) => result.rawScore))} /></section>
          <div className="summary-table"><div className="summary-row header"><span>Game</span><span>Score</span><span>Accuracy</span><span>Median RT</span><span>Primary focus</span></div>{sessionResults.map((result) => <div className="summary-row" key={result.id}><strong>{GAME_MAP[result.gameId].name}</strong><span>{Math.round(result.rawScore)}</span><span>{Math.round(result.accuracy)}%</span><span>{formatMs(result.medianReactionTime)}</span><span>{primaryWeakness(result)}</span></div>)}</div>
          <div className="result-actions"><button className="btn primary" onClick={goHome}>Return to library</button><button className="btn secondary" onClick={() => setView("dashboard")}>Open dashboard</button></div>
        </main>
      )}

      {view === "dashboard" && (
        <main className="contained-page dashboard-page">
          <div className="page-heading split"><div><span className="eyebrow">PERFORMANCE</span><h1>Your local training record.</h1><p>Attempts remain on this device. Simulator scores are practice heuristics, not employer scores.</p></div><div className="export-actions"><button onClick={() => exportCsv(history)}>Export CSV</button><button onClick={() => exportJson(history)}>Export JSON</button></div></div>
          {history.length ? <div className="summary-table dashboard-table"><div className="summary-row header"><span>Game</span><span>Score</span><span>Accuracy</span><span>Median RT</span><span>Primary weakness</span></div>{history.slice(0, 30).map((result) => <button className="summary-row" key={result.id} onClick={() => { setLastResult(result); setSelectedGame(result.gameId); setView("result"); }}><strong>{GAME_MAP[result.gameId].name}<small>L{result.level ?? 3} · {new Date(result.completedAt).toLocaleDateString()}</small></strong><span>{Math.round(result.rawScore)}</span><span>{Math.round(result.accuracy)}%</span><span>{formatMs(result.medianReactionTime)}</span><span>{primaryWeakness(result)}</span></button>)}</div> : <div className="empty-state"><BrandMark /><h2>No attempts yet.</h2><p>Complete a tutorial or practice game to start your training record.</p><button className="btn primary" onClick={goHome}>Choose a game</button></div>}
          {history.length > 0 && <button className="danger-link" onClick={() => { if (window.confirm("Delete all local attempt history?")) { clearHistory(); setHistory([]); } }}>Clear local history</button>}
        </main>
      )}

      {view === "config" && (
        <main className="contained-page config-page">
          <div className="page-heading"><span className="eyebrow">DEVELOPER TOOLS</span><h1>Game configuration</h1><p>Local configuration editor · versioned as zapn-public-guide-v3.0 · zero uses the selected level profile.</p></div>
          <div className="config-table"><div className="config-row header"><span>Game</span><span>Trial override</span><span>Window override</span><span>Adaptive</span></div>{GAMES.map((item) => <div className="config-row" key={item.id}><strong>{item.name}</strong><input type="number" min="0" max="90" value={config[item.id].trials} onChange={(event) => setConfig({ ...config, [item.id]: { ...config[item.id], trials: Number(event.target.value) } })} /><label><input type="number" min="0" max="120000" step="50" value={config[item.id].timeLimitMs} onChange={(event) => setConfig({ ...config, [item.id]: { ...config[item.id], timeLimitMs: Number(event.target.value) } })} /> ms</label><input type="checkbox" checked={config[item.id].adaptive} onChange={(event) => setConfig({ ...config, [item.id]: { ...config[item.id], adaptive: event.target.checked } })} /></div>)}</div>
          <div className="config-special"><span>Digit presentation</span><select value={config.pincode.presentationMode} onChange={(event) => setConfig({ ...config, pincode: { ...config.pincode, presentationMode: event.target.value as "mixed" | "simultaneous" | "sequential" } })}><option value="sequential">Sequential (reference)</option><option value="mixed">Mixed practice extension</option><option value="simultaneous">Simultaneous practice extension</option></select><label>Inter-digit override <input type="number" min="0" max="2000" step="50" value={config.pincode.interDigitDelayMs} onChange={(event) => setConfig({ ...config, pincode: { ...config.pincode, interDigitDelayMs: Number(event.target.value) } })} /> ms</label></div>
          <div className="config-actions"><button className="btn primary" onClick={() => { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config)); setConfigText("Configuration saved locally."); }}>Save configuration</button><button className="btn secondary" onClick={() => setConfigText(JSON.stringify(config, null, 2))}>Export JSON</button><button className="btn ghost" onClick={() => { setConfig(DEFAULT_CONFIG); localStorage.removeItem(CONFIG_STORAGE_KEY); }}>Reset defaults</button></div>
          <label className="config-json"><span>Import / export buffer</span><textarea value={configText} onChange={(event) => setConfigText(event.target.value)} placeholder="Paste configuration JSON here" /><button onClick={() => { try { setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(configText) }); setConfigText("Configuration imported. Save to keep it."); } catch { setConfigText("Invalid JSON. No changes applied."); } }}>Import JSON</button></label>
        </main>
      )}

      {view !== "game" && <footer><span><BrandMark /> CORTEX</span><p>Practice metrics only · Mechanics aligned to the <a href="https://quantcareerhub.com/blog/optiver-zap-n-test-guide" target="_blank" rel="noreferrer">public Zap-N guide</a> · Audio off by default</p><button onClick={() => setView("config")}>Developer config</button></footer>}
    </div>
  );
}
