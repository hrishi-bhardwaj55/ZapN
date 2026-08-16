"use client";

import { useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { allCandidates, COLORS, COUNTS, FIGURES, figureFeedback, generateTarget, reduceCandidates, sameGuess, type FigureGuess } from "./engine";

const symbols = { circle: "●", triangle: "▲", square: "■", diamond: "◆" };

export function FigureItOutGame(props: GameProps) {
  const maxGuesses = props.mode === "tutorial" ? 7 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 8, medium: 7, hard: 6 });
  const target = useMemo(() => generateTarget(props.seed), [props.seed]);
  const telemetry = useGameTelemetry(props.sessionId, "figure-it-out");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(performance.now());
  const roundsRef = useRef<RoundRecord[]>([]);
  const candidatesRef = useRef(allCandidates());
  const gainsRef = useRef<number[]>([]);
  const finished = useRef(false);
  const [guess, setGuess] = useState<FigureGuess>({ color: "navy", figure: "circle", count: 1 });
  const [guesses, setGuesses] = useState<Array<{ guess: FigureGuess; exact: number; gain: number }>>([]);
  const [feedback, setFeedback] = useState("Each clue reports how many attributes are exactly right.");

  const submit = () => {
    if (props.paused || finished.current) return;
    const repeated = guesses.some((item) => sameGuess(item.guess, guess));
    const result = figureFeedback(guess, target);
    const before = candidatesRef.current.length;
    const nextCandidates = reduceCandidates(candidatesRef.current, guess, result.exact);
    candidatesRef.current = nextCandidates;
    const gain = Math.log2(before / Math.max(1, nextCandidates.length));
    gainsRef.current.push(gain);
    const reactionTimeMs = performance.now() - shownAt.current;
    shownAt.current = performance.now();
    const record: RoundRecord = {
      round: guesses.length + 1,
      stimulus: `candidate-space:${before}`,
      response: `${guess.color}-${guess.figure}-${guess.count}`,
      correct: result.exact === 3,
      reactionTimeMs,
      score: result.exact,
    };
    const records = [...roundsRef.current, record];
    roundsRef.current = records;
    const nextGuesses = [...guesses, { guess: { ...guess }, exact: result.exact, gain }];
    setGuesses(nextGuesses);
    telemetry.record("USER_RESPONSE", guesses.length, { guess, before, after: nextCandidates.length, informationGain: gain });
    telemetry.record(result.exact === 3 ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", guesses.length, { exact: result.exact });
    if (result.exact === 3) setFeedback("Solved · all three attributes are exact.");
    else if (repeated) setFeedback(`${result.exact} exact · repeated guess added no new information.`);
    else setFeedback(`${result.exact} exact · ${result.different} different · ${nextCandidates.length} possibilities remain internally.`);
    if (result.exact !== 3 && nextGuesses.length < maxGuesses) return;
    finished.current = true;
    const solved = result.exact === 3;
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
            score: solved ? Math.max(40, 110 - nextGuesses.length * 10) : 20,
            metrics: {
              guessesRequired: nextGuesses.length,
              solved: solved ? 1 : 0,
              repeatedGuesses: nextGuesses.filter((entry, index, array) => array.slice(0, index).some((prior) => sameGuess(prior.guess, entry.guess))).length,
              averageInformationGain: mean(gainsRef.current),
              remainingCandidates: nextCandidates.length,
            },
          }),
        ),
      750,
    );
  };

  return (
    <GameShell
      title="Figure It Out"
      eyebrow="Hypothesis testing"
      round={guesses.length}
      total={maxGuesses}
      score={`${maxGuesses - guesses.length} guesses left`}
      aside={<div><span className="aside-label">CLUE KEY</span><strong>Exact attributes</strong><p>Color, shape, and count are evaluated independently.</p>{props.debug && props.mode !== "simulation" && <code>debug · {target.color} {target.figure} × {target.count}</code>}</div>}
    >
      <div className="figure-builder">
        <div className={`figure-preview ${guess.color}`} aria-label={`${guess.count} ${guess.color} ${guess.figure}`}>
          {Array.from({ length: guess.count }, (_, index) => <span key={index}>{symbols[guess.figure]}</span>)}
        </div>
        <div className="attribute-controls">
          <label><span>Color</span><select value={guess.color} onChange={(event) => setGuess({ ...guess, color: event.target.value as FigureGuess["color"] })}>{COLORS.map((color) => <option key={color}>{color}</option>)}</select></label>
          <label><span>Shape</span><select value={guess.figure} onChange={(event) => setGuess({ ...guess, figure: event.target.value as FigureGuess["figure"] })}>{FIGURES.map((figure) => <option key={figure}>{figure}</option>)}</select></label>
          <label><span>Count</span><select value={guess.count} onChange={(event) => setGuess({ ...guess, count: Number(event.target.value) as FigureGuess["count"] })}>{COUNTS.map((count) => <option key={count}>{count}</option>)}</select></label>
        </div>
        <button className="btn primary wide" onClick={submit}>Submit guess</button>
      </div>
      <Feedback tone={feedback.startsWith("Solved") ? "good" : "neutral"}>{feedback}</Feedback>
      {guesses.length > 0 && (
        <div className="guess-log">
          {guesses.slice(-4).reverse().map((entry, index) => (
            <div key={`${entry.guess.color}-${entry.guess.figure}-${entry.guess.count}-${index}`}>
              <span className={entry.guess.color}>{symbols[entry.guess.figure].repeat(entry.guess.count)}</span>
              <strong>{entry.exact}/3 exact</strong>
              <small>+{entry.gain.toFixed(2)} bits</small>
            </div>
          ))}
        </div>
      )}
    </GameShell>
  );
}
