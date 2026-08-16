"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { allCandidates, COLORS, FIGURES, figureFeedback, generateTarget, PATTERNS, reduceCandidates, sameGuess, type FigureGuess } from "./engine";

const symbols: Record<FigureGuess["figure"], Record<FigureGuess["pattern"], string>> = {
  circle: { solid: "●", striped: "◉", outline: "○" },
  triangle: { solid: "▲", striped: "◭", outline: "△" },
  square: { solid: "■", striped: "▦", outline: "□" },
  diamond: { solid: "◆", striped: "◈", outline: "◇" },
};

function figureLabel(figure: FigureGuess) {
  return `${figure.color} ${figure.figure} with ${figure.pattern} pattern`;
}

export function FigureItOutGame(props: GameProps) {
  const maxGuesses = props.mode === "tutorial" ? 7 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 8, medium: 7, hard: 6 });
  const target = useMemo(() => generateTarget(props.seed), [props.seed]);
  const telemetry = useGameTelemetry(props.sessionId, "figure-it-out");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const candidatesRef = useRef(allCandidates());
  const gainsRef = useRef<number[]>([]);
  const finished = useRef(false);
  const [guess, setGuess] = useState<FigureGuess>({ color: "navy", figure: "circle", pattern: "solid" });
  const [guesses, setGuesses] = useState<Array<{ guess: FigureGuess; right: number; wrong: number; gain: number }>>([]);
  const [feedback, setFeedback] = useState("Each clue reports aggregate right and wrong attributes.");
  const [outcome, setOutcome] = useState<{ solved: boolean } | null>(null);

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const submit = () => {
    if (props.paused || finished.current) return;
    const repeated = guesses.some((item) => sameGuess(item.guess, guess));
    const result = figureFeedback(guess, target);
    const before = candidatesRef.current.length;
    const nextCandidates = reduceCandidates(candidatesRef.current, guess, result.right);
    candidatesRef.current = nextCandidates;
    const gain = Math.log2(before / Math.max(1, nextCandidates.length));
    gainsRef.current.push(gain);
    const reactionTimeMs = performance.now() - shownAt.current;
    shownAt.current = performance.now();
    const record: RoundRecord = {
      round: guesses.length + 1,
      stimulus: `candidate-space:${before}`,
      response: `${guess.color}-${guess.figure}-${guess.pattern}`,
      correct: result.right === 3,
      reactionTimeMs,
      score: result.right,
    };
    const records = [...roundsRef.current, record];
    roundsRef.current = records;
    const nextGuesses = [...guesses, { guess: { ...guess }, right: result.right, wrong: result.wrong, gain }];
    setGuesses(nextGuesses);
    telemetry.record("USER_RESPONSE", guesses.length, { guess, before, after: nextCandidates.length, informationGain: gain });
    telemetry.record(result.right === 3 ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", guesses.length, { right: result.right, wrong: result.wrong });
    if (result.right === 3) setFeedback("Solved · all three attributes are right.");
    else if (repeated) setFeedback(`${result.right} right · ${result.wrong} wrong · repeated guess added no new information.`);
    else setFeedback(`${result.right} right · ${result.wrong} wrong · ${nextCandidates.length} possibilities remain internally.`);
    if (result.right !== 3 && nextGuesses.length < maxGuesses) return;
    finished.current = true;
    const solved = result.right === 3;
    setOutcome({ solved });
    telemetry.record("GAME_COMPLETED", nextGuesses.length, { solved });
    window.setTimeout(
      () =>
        props.onFinish(
          buildResult({
            sessionId: props.sessionId,
            gameId: "figure-it-out",
            mode: props.mode,
            difficulty: props.difficulty,
            seed: props.seed,
            startedAt: startedAt.current,
            rounds: records,
            telemetry: telemetry.events,
            score: solved ? Math.round(((maxGuesses - nextGuesses.length + 1) / maxGuesses) * 100) : 0,
            metrics: {
              guessesRequired: nextGuesses.length,
              guessesRemaining: Math.max(0, maxGuesses - nextGuesses.length),
              solved: solved ? 1 : 0,
              repeatedGuesses: nextGuesses.filter((entry, index, array) => array.slice(0, index).some((prior) => sameGuess(prior.guess, entry.guess))).length,
              averageInformationGain: mean(gainsRef.current),
              remainingCandidates: nextCandidates.length,
            },
          }),
        ),
      1200,
    );
  };

  return (
    <GameShell
      title="Figure It Out"
      eyebrow="Hypothesis testing"
      round={guesses.length}
      total={maxGuesses}
      score={`${Math.max(0, maxGuesses - guesses.length)} guesses left`}
      aside={<div><span className="aside-label">CLUE KEY</span><strong>Aggregate feedback</strong><p>Color, shape, and pattern are evaluated independently. Clues never identify which attribute is right.</p>{props.debug && props.mode !== "simulation" && <code>debug · {figureLabel(target)}</code>}</div>}
    >
      <div className="figure-builder">
        <div className={`figure-preview ${guess.color}`} aria-label={figureLabel(guess)}>
          <span>{symbols[guess.figure][guess.pattern]}</span>
        </div>
        <div className="attribute-controls">
          <label><span>Color</span><select disabled={props.paused || outcome !== null} value={guess.color} onChange={(event) => setGuess({ ...guess, color: event.target.value as FigureGuess["color"] })}>{COLORS.map((color) => <option key={color}>{color}</option>)}</select></label>
          <label><span>Shape</span><select disabled={props.paused || outcome !== null} value={guess.figure} onChange={(event) => setGuess({ ...guess, figure: event.target.value as FigureGuess["figure"] })}>{FIGURES.map((figure) => <option key={figure}>{figure}</option>)}</select></label>
          <label><span>Pattern</span><select disabled={props.paused || outcome !== null} value={guess.pattern} onChange={(event) => setGuess({ ...guess, pattern: event.target.value as FigureGuess["pattern"] })}>{PATTERNS.map((pattern) => <option key={pattern}>{pattern}</option>)}</select></label>
        </div>
        <button className="btn primary wide" disabled={props.paused || outcome !== null} onClick={submit}>Submit guess</button>
      </div>
      <Feedback tone={outcome?.solved ? "good" : "neutral"}>{feedback}</Feedback>
      {outcome && (
        <div className="reference-code" role="status">
          <small>{outcome.solved ? "HIDDEN FIGURE SOLVED" : "HIDDEN FIGURE REVEALED"}</small>
          <strong className={target.color}>{symbols[target.figure][target.pattern]} · {figureLabel(target)}</strong>
        </div>
      )}
      {guesses.length > 0 && (
        <div className="guess-log" aria-label="Complete guess history">
          {guesses.map((entry, index) => (
            <div key={`${entry.guess.color}-${entry.guess.figure}-${entry.guess.pattern}-${index}`}>
              <span className={entry.guess.color} aria-label={figureLabel(entry.guess)}>{symbols[entry.guess.figure][entry.guess.pattern]}</span>
              <strong>{entry.right} right · {entry.wrong} wrong</strong>
              <small>Guess {index + 1} · +{entry.gain.toFixed(2)} bits</small>
            </div>
          ))}
        </div>
      )}
    </GameShell>
  );
}
