"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { generateDigits, nextAdaptiveSpan, transformDigits, type MemoryTask } from "./engine";

export function PincodeGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 3 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 4, medium: 5, hard: 6 });
  const initialSpan = difficultyValue(props.difficulty, { easy: 4, medium: 5, hard: 6 });
  const displayMs = difficultyValue(props.difficulty, { easy: 2200, medium: 1750, hard: 1400 });
  const responseWindow = props.config?.timeLimitMs || difficultyValue(props.difficulty, { easy: 12000, medium: 10000, hard: 8000 });
  const telemetry = useGameTelemetry(props.sessionId, "pincode");
  const startedAt = useRef(new Date().toISOString());
  const recallShownAt = useRef(performance.now());
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [span, setSpan] = useState(initialSpan);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<"show" | "recall" | "feedback">("show");
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const task: MemoryTask = useMemo(() => {
    if (props.difficulty === "easy") return "forward";
    const tasks: MemoryTask[] = props.difficulty === "hard" ? ["forward", "reverse", "sort"] : ["forward", "reverse"];
    return tasks[round % tasks.length];
  }, [props.difficulty, round]);
  const digits = useMemo(() => generateDigits(props.seed, round, span), [props.seed, round, span]);
  const expected = transformDigits(digits, task).join("");
  const presentationMode = props.config?.presentationMode ?? "mixed";
  const sequential = presentationMode === "sequential" || (presentationMode === "mixed" && props.difficulty === "hard" && round % 2 === 1);

  useEffect(() => {
    if (props.paused || phase !== "show") return;
    telemetry.record("STIMULUS_SHOWN", round, { digits, task, span });
    const interDigitDelay = props.config?.interDigitDelayMs ?? 650;
    const timers: number[] = [];
    if (sequential) {
      digits.forEach((_, index) => timers.push(window.setTimeout(() => setVisibleIndex(index), index * interDigitDelay)));
    }
    const timeout = window.setTimeout(() => {
      setPhase("recall");
      recallShownAt.current = performance.now();
    }, sequential ? digits.length * interDigitDelay + 500 : props.mode === "tutorial" ? displayMs + 600 : displayMs);
    return () => { window.clearTimeout(timeout); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, [digits, displayMs, phase, props.config?.interDigitDelayMs, props.mode, props.paused, round, sequential, span, task, telemetry]);

  useEffect(() => {
    if (!props.paused && phase === "recall") recallShownAt.current = performance.now();
  }, [phase, props.paused]);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      const correctSpans = records.filter((record) => record.correct).map((record) => Number(record.stimulus.split(":")[1]));
      const maxSpanFor = (modeName: MemoryTask) => {
        const spans = records.filter((record) => record.correct && record.stimulus.startsWith(`${modeName}:`)).map((record) => Number(record.stimulus.split(":")[1]));
        return spans.length ? Math.max(...spans) : 0;
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
            finalSpan: span,
            orderErrors: errorStats.order,
            missingDigits: errorStats.missing,
            extraDigits: errorStats.extra,
            duplicateErrors: errorStats.duplicate,
            reverseAccuracy: records.filter((record) => record.stimulus.startsWith("reverse")).length
              ? (records.filter((record) => record.stimulus.startsWith("reverse") && record.correct).length /
                  records.filter((record) => record.stimulus.startsWith("reverse")).length) * 100
              : 0,
          },
        }),
      );
    },
    [props, span, telemetry, total],
  );

  const submit = useCallback((timedOut = false) => {
    if (props.paused || phase !== "recall" || finished.current || (!input && !timedOut)) return;
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
    const adaptive = props.config?.adaptive === false ? { span, streak: correct ? streak + 1 : 0 } : nextAdaptiveSpan(span, streak, correct);
    window.setTimeout(() => {
      if (round + 1 >= total) complete(records);
      else {
        setRound((value) => value + 1);
        setSpan(adaptive.span);
        setStreak(adaptive.streak);
        setInput("");
        setFeedback(null);
        setPhase("show");
        telemetry.record("LEVEL_CHANGED", round + 1, { span: adaptive.span });
      }
    }, props.mode === "tutorial" ? 1000 : 650);
  }, [complete, digits, expected, input, phase, props.mode, props.paused, responseWindow, round, span, streak, task, telemetry, total]);

  useEffect(() => {
    if (props.paused || !props.timed || props.mode === "tutorial" || phase !== "recall") return;
    const timeout = window.setTimeout(() => submit(true), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [phase, props.mode, props.paused, props.timed, responseWindow, submit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (props.paused || phase !== "recall") return;
      if (/^\d$/.test(event.key) && input.length < span) setInput((value) => value + event.key);
      if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
      if (event.key === "Enter") submit(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input.length, phase, props.paused, span, submit]);

  const taskLabel = task === "forward" ? "Recall in the same order" : task === "reverse" ? "Recall in reverse order" : "Recall from lowest to highest";
  return (
    <GameShell
      title="Pincode"
      eyebrow="Working memory"
      round={round}
      total={total}
      score={`Span ${span}`}
      aside={<div><span className="aside-label">TRANSFORMATION</span><strong>{taskLabel}</strong><p>The sequence disappears before entry begins.</p></div>}
    >
      <div className="memory-task-label">{task.toUpperCase()}</div>
      {phase === "show" ? (
        <div className={`digit-display ${sequential ? "sequential" : ""}`} aria-label={`Memorize ${digits.join(" ")}`}>
          {(sequential ? [digits[visibleIndex]] : digits).map((digit, index) => <span key={`${digit}-${sequential ? visibleIndex : index}`}>{digit}</span>)}
        </div>
      ) : (
        <div className="recall-display" aria-label="Your recalled sequence">
          {Array.from({ length: span }, (_, index) => <span key={index}>{input[index] ?? "·"}</span>)}
        </div>
      )}
      <p className="prompt-line">{phase === "show" ? "Memorize the sequence" : taskLabel}</p>
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
