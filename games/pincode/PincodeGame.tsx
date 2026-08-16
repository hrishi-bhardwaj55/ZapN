"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { generateDigits, nextAdaptiveSpan, taskForRound, transformDigits, type MemoryTask } from "./engine";

export function PincodeGame(props: GameProps) {
  const total = Math.max(3, props.mode === "tutorial" ? 3 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 4, medium: 5, hard: 6 }));
  const initialSpan = difficultyValue(props.difficulty, { easy: 4, medium: 5, hard: 6 });
  const responseWindow = props.config?.timeLimitMs || difficultyValue(props.difficulty, { easy: 12000, medium: 10000, hard: 8000 });
  const telemetry = useGameTelemetry(props.sessionId, "pincode");
  const startedAt = useRef(new Date().toISOString());
  const recallShownAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const locked = useRef(false);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [spans, setSpans] = useState<Record<MemoryTask, number>>({
    forward: initialSpan,
    reverse: initialSpan,
    sort: initialSpan,
  });
  const [phase, setPhase] = useState<"show" | "recall" | "feedback">("show");
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const task = taskForRound(round, total);
  const span = spans[task];
  const digits = useMemo(() => generateDigits(props.seed, round, span), [props.seed, round, span]);
  const expected = transformDigits(digits, task).join("");

  useEffect(() => {
    if (props.paused || phase !== "show") return;
    telemetry.record("STIMULUS_SHOWN", round, { digits, task, span });
    const interDigitDelay = props.config?.interDigitDelayMs ?? 650;
    const timers = digits.map((_, index) => window.setTimeout(() => setVisibleIndex(index), index * interDigitDelay));
    const timeout = window.setTimeout(() => {
      setPhase("recall");
      recallShownAt.current = performance.now();
    }, digits.length * interDigitDelay + 350);
    return () => { window.clearTimeout(timeout); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, [digits, phase, props.config?.interDigitDelayMs, props.paused, round, span, task, telemetry]);

  useEffect(() => {
    if (!props.paused && phase === "recall") recallShownAt.current = performance.now();
  }, [phase, props.paused]);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      const correctSpans = records.filter((record) => record.correct).map((record) => Number(record.stimulus.split(":")[1]));
      const recordsFor = (modeName: MemoryTask) => records.filter((record) => record.stimulus.startsWith(`${modeName}:`));
      const maxSpanFor = (modeName: MemoryTask) => {
        const spans = records.filter((record) => record.correct && record.stimulus.startsWith(`${modeName}:`)).map((record) => Number(record.stimulus.split(":")[1]));
        return spans.length ? Math.max(...spans) : 0;
      };
      const accuracyFor = (modeName: MemoryTask) => {
        const modeRecords = recordsFor(modeName);
        return modeRecords.length ? (modeRecords.filter((record) => record.correct).length / modeRecords.length) * 100 : 0;
      };
      const errorStats = records.filter((record) => !record.correct).reduce(
        (stats, record) => {
          const [modeName, , original] = record.stimulus.split(":");
          const target = transformDigits(original.split("").map(Number), modeName as MemoryTask).join("");
          if (record.response === "timeout") stats.missing += target.length;
          else if (record.response.split("").sort().join("") === target.split("").sort().join("")) stats.order += 1;
          else {
            const expectedCounts = [...target].reduce<Record<string, number>>((counts, digit) => ({ ...counts, [digit]: (counts[digit] ?? 0) + 1 }), {});
            const responseCounts = [...record.response].reduce<Record<string, number>>((counts, digit) => ({ ...counts, [digit]: (counts[digit] ?? 0) + 1 }), {});
            Object.keys(expectedCounts).forEach((digit) => { stats.missing += Math.max(0, expectedCounts[digit] - (responseCounts[digit] ?? 0)); });
            Object.keys(responseCounts).forEach((digit) => { stats.extra += Math.max(0, responseCounts[digit] - (expectedCounts[digit] ?? 0)); });
            if (Object.values(expectedCounts).some((count) => count > 1)) stats.duplicate += 1;
          }
          return stats;
        },
        { order: 0, missing: 0, extra: 0, duplicate: 0 },
      );
      telemetry.record("GAME_COMPLETED", total);
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "pincode",
          mode: props.mode,
          difficulty: props.difficulty,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            workingMemorySpan: correctSpans.length ? Math.max(...correctSpans) : 0,
            forwardMaxSpan: maxSpanFor("forward"),
            reverseMaxSpan: maxSpanFor("reverse"),
            sortedMaxSpan: maxSpanFor("sort"),
            repeatAccuracy: accuracyFor("forward"),
            reverseAccuracy: accuracyFor("reverse"),
            sortAccuracy: accuracyFor("sort"),
            repeatAttempts: recordsFor("forward").length,
            reverseAttempts: recordsFor("reverse").length,
            sortAttempts: recordsFor("sort").length,
            finalRepeatSpan: spans.forward,
            finalReverseSpan: spans.reverse,
            finalSortSpan: spans.sort,
            orderErrors: errorStats.order,
            missingDigits: errorStats.missing,
            extraDigits: errorStats.extra,
            duplicateErrors: errorStats.duplicate,
          },
        }),
      );
    },
    [props, spans, telemetry, total],
  );

  const submit = useCallback((timedOut = false) => {
    if (props.paused || phase !== "recall" || locked.current || finished.current || (!input && !timedOut)) return;
    locked.current = true;
    const response = timedOut ? "timeout" : input;
    const correct = !timedOut && input === expected;
    const reactionTimeMs = timedOut ? responseWindow : performance.now() - recallShownAt.current;
    const record: RoundRecord = {
      round: round + 1,
      stimulus: `${task}:${span}:${digits.join("")}`,
      response,
      correct,
      reactionTimeMs,
      score: correct ? span : 0,
    };
    const records = [...roundsRef.current, record];
    roundsRef.current = records;
    telemetry.record(timedOut ? "TIMEOUT" : "USER_RESPONSE", round, { input: response, reactionTimeMs });
    telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { expected });
    setFeedback({ tone: correct ? "good" : "bad", text: correct ? `${span}-digit recall correct` : `Correct sequence: ${expected}` });
    setPhase("feedback");
    const nextSpan = props.config?.adaptive === false ? span : nextAdaptiveSpan(span, correct);
    window.setTimeout(() => {
      if (round + 1 >= total) complete(records);
      else {
        setRound((value) => value + 1);
        setSpans((current) => ({ ...current, [task]: nextSpan }));
        setInput("");
        setFeedback(null);
        setVisibleIndex(0);
        setPhase("show");
        locked.current = false;
        telemetry.record("LEVEL_CHANGED", round + 1, { task, span: nextSpan });
      }
    }, props.mode === "tutorial" ? 1000 : 650);
  }, [complete, digits, expected, input, phase, props.config?.adaptive, props.mode, props.paused, responseWindow, round, span, task, telemetry, total]);

  useEffect(() => {
    if (props.paused || !props.timed || props.mode === "tutorial" || phase !== "recall") return;
    const timeout = window.setTimeout(() => submit(true), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [phase, props.mode, props.paused, props.timed, responseWindow, submit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (props.paused || phase !== "recall") return;
      if (/^\d$/.test(event.key) && input.length < span) {
        event.preventDefault();
        setInput((value) => value + event.key);
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setInput((value) => value.slice(0, -1));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        submit(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input.length, phase, props.paused, span, submit]);

  const taskName = task === "forward" ? "REPEAT" : task === "reverse" ? "REVERSE" : "SORT";
  const taskLabel = task === "forward" ? "Recall in the same order" : task === "reverse" ? "Recall in reverse order" : "Recall from lowest to highest";
  return (
    <GameShell
      title="Digit"
      eyebrow="Working memory"
      round={round}
      total={total}
      score={`Span ${span}`}
      aside={<div><span className="aside-label">TRANSFORMATION</span><strong>{taskLabel}</strong><p>The sequence disappears before entry begins.</p></div>}
    >
      <div className="memory-task-label">{taskName}</div>
      {phase === "show" ? (
        <div className="digit-display sequential" role="status" aria-live="polite" aria-label={`Digit ${visibleIndex + 1} of ${span}: ${digits[visibleIndex]}`}>
          <span key={`${digits[visibleIndex]}-${visibleIndex}`}>{digits[visibleIndex]}</span>
        </div>
      ) : (
        <div className="recall-display" aria-label="Your recalled sequence">
          {Array.from({ length: span }, (_, index) => <span key={index}>{input[index] ?? "·"}</span>)}
        </div>
      )}
      <p className="prompt-line">{phase === "show" ? `Memorize · digit ${visibleIndex + 1} of ${span}` : taskLabel}</p>
      <div className="number-pad compact">
        {Array.from({ length: 10 }, (_, digit) => (
          <button key={digit} disabled={props.paused || phase !== "recall" || input.length >= span} onClick={() => setInput((value) => `${value}${digit}`)}>{digit}</button>
        ))}
        <button disabled={props.paused || phase !== "recall"} onClick={() => setInput((value) => value.slice(0, -1))}>⌫</button>
        <button className="submit-key" disabled={props.paused || phase !== "recall" || input.length !== span} onClick={() => submit(false)}>Enter</button>
      </div>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    </GameShell>
  );
}
