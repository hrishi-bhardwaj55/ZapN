"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import {
  combineWorkingValues,
  generateNumberPuzzles,
  initialWorkingValues,
  type NumberOperator,
  type WorkingValue,
} from "./engine";

const OPERATORS: Array<{ value: NumberOperator; label: string }> = [
  { value: "+", label: "+" },
  { value: "-", label: "−" },
  { value: "*", label: "×" },
  { value: "/", label: "÷" },
];

function formatValue(value: number) {
  if (Math.abs(value - Math.round(value)) < 1e-8) return String(Math.round(value));
  return String(Number(value.toFixed(3)));
}

export function NumberBoxGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 2 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 3, medium: 4, hard: 5 });
  const puzzles = useMemo(() => generateNumberPuzzles(props.seed, total), [props.seed, total]);
  const telemetry = useGameTelemetry(props.sessionId, "number-box");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const invalidAttemptsRef = useRef(0);
  const undoCountRef = useRef(0);
  const resetCountRef = useRef(0);
  const locked = useRef(false);
  const finished = useRef(false);
  const resultSequence = useRef(0);
  const [round, setRound] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [values, setValues] = useState<WorkingValue[]>(() => initialWorkingValues(puzzles[0].numbers));
  const [history, setHistory] = useState<WorkingValue[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operator, setOperator] = useState<NumberOperator | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "neutral"; text: string } | null>(null);

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

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
            solveRate: records.length ? (records.filter((record) => record.correct).length / records.length) * 100 : 0,
            averageSolveTimeMs: mean(records.filter((record) => record.correct).map((record) => record.reactionTimeMs)),
            skippedPuzzles: records.filter((record) => record.response === "skip").length,
            invalidResults: invalidAttemptsRef.current,
            undoCount: undoCountRef.current,
            resetCount: resetCountRef.current,
          },
        }),
      );
    },
    [props, telemetry, total],
  );

  const advance = useCallback(
    (record: RoundRecord) => {
      if (locked.current || finished.current) return;
      locked.current = true;
      setIsLocked(true);
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      window.setTimeout(() => {
        if (round + 1 >= total) complete(records);
        else {
          const nextRound = round + 1;
          setRound(nextRound);
          setValues(initialWorkingValues(puzzles[nextRound].numbers));
          setHistory([]);
          setSelectedId(null);
          setOperator(null);
          setFeedback(null);
          shownAt.current = performance.now();
          locked.current = false;
          setIsLocked(false);
        }
      }, props.mode === "tutorial" ? 1000 : 650);
    },
    [complete, props.mode, puzzles, round, total],
  );

  const chooseValue = (id: string) => {
    if (props.paused || locked.current || finished.current) return;
    if (!selectedId) {
      setSelectedId(id);
      setFeedback(null);
      return;
    }
    if (!operator) {
      setSelectedId(selectedId === id ? null : id);
      return;
    }
    try {
      resultSequence.current += 1;
      const next = combineWorkingValues(values, selectedId, operator, id, `result-${round}-${resultSequence.current}`);
      setHistory((current) => [...current, values]);
      setValues(next);
      setSelectedId(null);
      setOperator(null);
      setFeedback(next.length === 1 ? { tone: "neutral", text: `Final value ${formatValue(next[0].value)} · check it against 24.` } : null);
    } catch (error) {
      setFeedback({ tone: "bad", text: error instanceof Error ? error.message : "That operation is not available." });
    }
  };

  const undo = () => {
    if (props.paused || locked.current || history.length === 0) return;
    undoCountRef.current += 1;
    setValues(history[history.length - 1]);
    setHistory((current) => current.slice(0, -1));
    setSelectedId(null);
    setOperator(null);
    setFeedback(null);
  };

  const reset = () => {
    if (props.paused || locked.current) return;
    resetCountRef.current += 1;
    setValues(initialWorkingValues(puzzles[round].numbers));
    setHistory([]);
    setSelectedId(null);
    setOperator(null);
    setFeedback(null);
  };

  const submit = () => {
    if (props.paused || locked.current || finished.current || values.length !== 1) return;
    const final = values[0];
    const allSources = [...new Set(final.sourceIndexes)];
    if (allSources.length !== 4) {
      setFeedback({ tone: "bad", text: "Use every supplied number exactly once." });
      return;
    }
    const reactionTimeMs = performance.now() - shownAt.current;
    const correct = Math.abs(final.value - 24) < 1e-8;
    telemetry.record("USER_RESPONSE", round, { expression: final.expression, value: final.value });
    telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { expression: final.expression });
    if (!correct) {
      invalidAttemptsRef.current += 1;
      setFeedback({ tone: "bad", text: `That equals ${formatValue(final.value)}, not 24. Undo or reset and try again.` });
      return;
    }
    setFeedback({ tone: "good", text: `Made 24 in ${Math.round(reactionTimeMs / 100) / 10}s.` });
    advance({
      round: round + 1,
      stimulus: `${puzzles[round].numbers.join(",")}=>24`,
      response: final.expression,
      correct: true,
      reactionTimeMs,
      score: 1,
    });
  };

  const skip = () => {
    if (props.paused || locked.current || finished.current) return;
    const puzzle = puzzles[round];
    const reactionTimeMs = performance.now() - shownAt.current;
    telemetry.record("USER_RESPONSE", round, { response: "skip" });
    telemetry.record("INCORRECT_RESPONSE", round, { solution: puzzle.solution });
    setFeedback({ tone: "neutral", text: `Skipped · one solution is ${puzzle.solution}.` });
    advance({
      round: round + 1,
      stimulus: `${puzzle.numbers.join(",")}=>24`,
      response: "skip",
      correct: false,
      reactionTimeMs,
      score: 0,
    });
  };

  const puzzle = puzzles[round];
  return (
    <GameShell
      title="Number Box"
      eyebrow="Arithmetic reasoning"
      round={round}
      total={total}
      score={`${values.length} value${values.length === 1 ? "" : "s"} left`}
      aside={<div><span className="aside-label">CONSTRAINT</span><strong>Make 24</strong><p>Use all four supplied numbers exactly once. Each operation collapses two values into one.</p>{props.debug && props.mode !== "simulation" && <code>debug · {puzzle.solution}</code>}</div>}
    >
      <div className="target-number"><small>TARGET</small><strong>24</strong></div>
      <p className="prompt-line">
        {!selectedId ? "Choose the first value." : !operator ? "Choose an operator." : "Choose the second value."}
      </p>
      <div className="number-tiles">
        {values.map((item) => (
          <button
            key={item.id}
            disabled={props.paused || isLocked}
            aria-pressed={selectedId === item.id}
            aria-label={`Use value ${formatValue(item.value)}`}
            onClick={() => chooseValue(item.id)}
          >
            <strong>{formatValue(item.value)}</strong>
            {item.sourceIndexes.length > 1 && <small>{item.expression}</small>}
          </button>
        ))}
      </div>
      <div className="operator-row" aria-label="Arithmetic operators">
        {OPERATORS.map((item) => (
          <button
            key={item.value}
            disabled={props.paused || isLocked || !selectedId || values.length < 2}
            aria-pressed={operator === item.value}
            onClick={() => setOperator(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="operator-row">
        <button onClick={undo} disabled={props.paused || isLocked || history.length === 0}>Undo</button>
        <button onClick={reset} disabled={props.paused || isLocked || history.length === 0}>Reset</button>
        <button onClick={skip} disabled={props.paused || isLocked}>Skip</button>
      </div>
      <button className="btn primary wide" onClick={submit} disabled={props.paused || isLocked || values.length !== 1}>Check 24</button>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    </GameShell>
  );
}
