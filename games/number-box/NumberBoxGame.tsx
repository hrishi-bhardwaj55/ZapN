"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { generateNumberPuzzles, numbersUsed, validateSolution } from "./engine";

export function NumberBoxGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 2 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 3, medium: 4, hard: 5 });
  const numberCount = props.difficulty === "easy" ? 3 : 4;
  const puzzles = useMemo(() => generateNumberPuzzles(props.seed, total, numberCount), [numberCount, props.seed, total]);
  const telemetry = useGameTelemetry(props.sessionId, "number-box");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(performance.now());
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [expression, setExpression] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "neutral"; text: string } | null>(null);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      telemetry.record("GAME_COMPLETED", total);
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "number-box",
          mode: props.mode,
          difficulty: props.difficulty,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            solveRate: (records.filter((record) => record.correct).length / records.length) * 100,
            averageSolveTimeMs: mean(records.filter((record) => record.correct).map((record) => record.reactionTimeMs)),
            invalidExpressions: records.filter((record) => !record.correct).length,
          },
        }),
      );
    },
    [props, telemetry, total],
  );

  const advance = useCallback(
    (record: RoundRecord) => {
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      window.setTimeout(() => {
        if (round + 1 >= total) complete(records);
        else {
          setRound((value) => value + 1);
          setExpression("");
          setAttempts(0);
          setFeedback(null);
          shownAt.current = performance.now();
        }
      }, props.mode === "tutorial" ? 1000 : 650);
    },
    [complete, props.mode, round, total],
  );

  const submit = () => {
    if (props.paused || !expression || finished.current) return;
    const puzzle = puzzles[round];
    const result = validateSolution(expression, puzzle);
    const reactionTimeMs = performance.now() - shownAt.current;
    telemetry.record("USER_RESPONSE", round, { expression, valid: result.valid });
    if (result.valid) {
      telemetry.record("CORRECT_RESPONSE", round, { expression });
      setFeedback({ tone: "good", text: `Solved in ${Math.round(reactionTimeMs / 100) / 10}s` });
      advance({ round: round + 1, stimulus: `${puzzle.numbers.join(",")}=>${puzzle.target}`, response: expression, correct: true, reactionTimeMs, score: 1 });
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    telemetry.record("INCORRECT_RESPONSE", round, { reason: result.reason });
    setFeedback({ tone: "bad", text: result.reason ?? "Invalid expression" });
    if (nextAttempts >= 3) {
      advance({ round: round + 1, stimulus: `${puzzle.numbers.join(",")}=>${puzzle.target}`, response: expression, correct: false, reactionTimeMs, score: 0 });
    }
  };

  const puzzle = puzzles[round];
  const usedNumbers = numbersUsed(expression);
  return (
    <GameShell
      title="Number Box"
      eyebrow="Arithmetic reasoning"
      round={round}
      total={total}
      score={`${3 - attempts} tries left`}
      aside={<div><span className="aside-label">CONSTRAINT</span><strong>Use each number once</strong><p>Parentheses and + − × ÷ are allowed. Concatenation is not.</p>{props.debug && props.mode !== "simulation" && <code>debug · {puzzle.solution}</code>}</div>}
    >
      <div className="target-number"><small>TARGET</small><strong>{puzzle.target}</strong></div>
      <div className="number-tiles">{puzzle.numbers.map((number, index) => {
        const occurrence = puzzle.numbers.slice(0, index + 1).filter((value) => value === number).length;
        const used = usedNumbers.filter((value) => value === number).length >= occurrence;
        return <button key={`${number}-${index}`} disabled={used} onClick={() => setExpression((value) => `${value}${number}`)} aria-label={`Use number ${number}`}>{number}</button>;
      })}</div>
      <label className="expression-field">
        <span>Your expression</span>
        <input
          autoFocus
          value={expression}
          onChange={(event) => setExpression(event.target.value.replace(/[^\d+\-*/().×÷\s]/g, ""))}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
          placeholder="(2 + 3) × 4"
          aria-label="Arithmetic expression"
        />
      </label>
      <div className="operator-row">
        {["+", "−", "×", "÷", "(", ")"].map((operator) => <button key={operator} onClick={() => setExpression((value) => value + (operator === "−" ? "-" : operator))}>{operator}</button>)}
      </div>
      <button className="btn primary wide" onClick={submit} disabled={!expression}>Check expression</button>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    </GameShell>
  );
}
