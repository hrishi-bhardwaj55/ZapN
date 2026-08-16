"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, standardDeviation } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { createMapping, generateShapeTrials, isAnticipatory, SHAPES, type Direction } from "./engine";

const symbols = { triangle: "△", circle: "○", square: "□", diamond: "◇" };
const arrows: Record<Direction, string> = {
  ArrowLeft: "←",
  ArrowUp: "↑",
  ArrowRight: "→",
  ArrowDown: "↓",
};

export function ShapeshiftGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 5 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 8, medium: 10, hard: 12 });
  const responseWindow = props.config?.timeLimitMs || difficultyValue(props.difficulty, { easy: 2200, medium: 1600, hard: 1150 });
  const mapping = useMemo(() => createMapping(props.seed), [props.seed]);
  const trials = useMemo(() => generateShapeTrials(props.seed, total), [props.seed, total]);
  const telemetry = useGameTelemetry(props.sessionId, "shapeshift");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(performance.now());
  const roundsRef = useRef<RoundRecord[]>([]);
  const locked = useRef(false);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      const anticipations = records.filter((record) => isAnticipatory(record.reactionTimeMs)).length;
      telemetry.record("GAME_COMPLETED", total);
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "shapeshift",
          mode: props.mode,
          difficulty: props.difficulty,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            anticipations,
            timeouts: records.filter((record) => record.response === "timeout").length,
            consistencyMs: standardDeviation(records.map((record) => record.reactionTimeMs).filter(Boolean)),
          },
        }),
      );
    },
    [props, telemetry, total],
  );

  const submit = useCallback(
    (direction: Direction | "timeout") => {
      if (props.paused || locked.current || finished.current) return;
      locked.current = true;
      const reactionTimeMs = performance.now() - shownAt.current;
      const correctDirection = mapping[trials[round]];
      const correct = direction === correctDirection && !isAnticipatory(reactionTimeMs);
      const record: RoundRecord = {
        round: round + 1,
        stimulus: trials[round],
        response: direction,
        correct,
        reactionTimeMs: direction === "timeout" ? responseWindow : reactionTimeMs,
        score: correct ? 1 : 0,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      telemetry.record(direction === "timeout" ? "TIMEOUT" : "USER_RESPONSE", round, { direction, reactionTimeMs });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { expected: correctDirection });
      setFeedback({
        tone: correct ? "good" : "bad",
        text: correct ? `${Math.round(reactionTimeMs)} ms · correct` : `Expected ${arrows[correctDirection]}`,
      });
      window.setTimeout(() => {
        if (round + 1 >= total) {
          complete(records);
        } else {
          setRound((value) => value + 1);
          setFeedback(null);
          locked.current = false;
          shownAt.current = performance.now();
          telemetry.record("STIMULUS_SHOWN", round + 1, { shape: trials[round + 1] });
        }
      }, props.mode === "tutorial" ? 650 : 280);
    },
    [complete, mapping, props.mode, props.paused, responseWindow, round, telemetry, total, trials],
  );

  useEffect(() => {
    shownAt.current = performance.now();
    telemetry.record("STIMULUS_SHOWN", round, { shape: trials[round] });
    if (props.paused || !props.timed || props.mode === "tutorial") return;
    const timeout = window.setTimeout(() => submit("timeout"), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [props.mode, props.paused, props.timed, responseWindow, round, submit, telemetry, trials]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        submit(event.key as Direction);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  return (
    <GameShell
      title="Shapeshift"
      eyebrow="Rule mapping"
      round={round}
      total={total}
      aside={
        <div>
          <span className="aside-label">ACTIVE MAP</span>
          <div className="shape-map">
            {SHAPES.map((shape) => (
              <span key={shape}><b>{symbols[shape]}</b><em>{arrows[mapping[shape]]}</em></span>
            ))}
          </div>
          <p>Respond to the shape using the mapped direction.</p>
        </div>
      }
    >
      <div className={`shape-stimulus ${trials[round]}`} aria-label={trials[round]}>
        {symbols[trials[round]]}
      </div>
      <p className="prompt-line">Which direction does this shape map to?</p>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
      <div className="direction-pad" aria-label="Direction controls">
        {(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"] as Direction[]).map((direction) => (
          <button key={direction} onClick={() => submit(direction)} aria-label={direction.replace("Arrow", "")}>
            {arrows[direction]}
          </button>
        ))}
      </div>
    </GameShell>
  );
}
