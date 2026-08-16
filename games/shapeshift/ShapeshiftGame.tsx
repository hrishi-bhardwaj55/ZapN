"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, standardDeviation } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import {
  calculateSimonMetrics,
  generateShapeTrials,
  isAnticipatory,
  isCorrectShapeResponse,
  SHAPES,
  SHAPE_MAPPING,
  shapeLevelProfile,
  type ShapeDirection,
} from "./engine";

const symbols = { circle: "○", square: "□" } as const;
const arrows: Record<ShapeDirection, string> = { ArrowLeft: "←", ArrowRight: "→" };

export function ShapeshiftGame(props: GameProps) {
  const levelProfile = shapeLevelProfile(props.mode === "tutorial" ? 1 : props.level);
  const total = props.mode === "tutorial" ? 4 : props.config?.trials || levelProfile.trials;
  const responseWindow = props.config?.timeLimitMs || levelProfile.responseWindowMs;
  const trials = useMemo(
    () => generateShapeTrials(props.seed, total, props.mode === "tutorial" ? 1 : props.level),
    [props.level, props.mode, props.seed, total],
  );
  const telemetry = useGameTelemetry(props.sessionId, "shapeshift");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const roundsRef = useRef<RoundRecord[]>([]);
  const locked = useRef(false);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      const simon = calculateSimonMetrics(records);
      const validReactionTimes = records
        .filter((record) => record.response !== "timeout" && !isAnticipatory(record.reactionTimeMs))
        .map((record) => record.reactionTimeMs);
      telemetry.record("GAME_COMPLETED", total, simon);
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "shapeshift",
          mode: props.mode,
          difficulty: props.difficulty,
          level: props.level,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            ...simon,
            level: props.level,
            trialCount: total,
            responseWindowMs: responseWindow,
            incongruentPercentage: records.length
              ? (records.filter((record) => record.stimulus.startsWith("incongruent:")).length / records.length) * 100
              : 0,
            anticipations: records.filter(
              (record) => record.response !== "timeout" && isAnticipatory(record.reactionTimeMs),
            ).length,
            timeouts: records.filter((record) => record.response === "timeout").length,
            consistencyMs: standardDeviation(validReactionTimes),
          },
        }),
      );
    },
    [props, responseWindow, telemetry, total],
  );

  const submit = useCallback(
    (direction: ShapeDirection | "timeout") => {
      if (props.paused || locked.current || finished.current) return;
      locked.current = true;
      const trial = trials[round];
      const reactionTimeMs = stimulusVisible ? performance.now() - shownAt.current : 0;
      const correct =
        direction !== "timeout" && stimulusVisible && isCorrectShapeResponse(trial, direction, reactionTimeMs);
      const response = direction === "timeout" ? "timeout" : direction;
      const record: RoundRecord = {
        round: round + 1,
        stimulus: `${trial.congruent ? "congruent" : "incongruent"}:${trial.shape}:${trial.position}`,
        response,
        correct,
        reactionTimeMs: direction === "timeout" ? responseWindow : reactionTimeMs,
        score: correct ? 1 : 0,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      const anticipatory = direction !== "timeout" && (!stimulusVisible || isAnticipatory(reactionTimeMs));
      telemetry.record(direction === "timeout" ? "TIMEOUT" : "USER_RESPONSE", round, {
        direction,
        reactionTimeMs,
        anticipatory,
      });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, {
        expected: trial.correctDirection,
        congruent: trial.congruent,
      });
      setFeedback({
        tone: correct ? "good" : "bad",
        text: correct
          ? `${Math.round(reactionTimeMs)} ms · correct`
          : anticipatory
            ? "Too early — wait for the shape."
            : direction === "timeout"
              ? `Timed out · expected ${arrows[trial.correctDirection]}`
              : `Expected ${arrows[trial.correctDirection]}`,
      });
      setStimulusVisible(false);
      window.setTimeout(() => {
        if (round + 1 >= total) {
          complete(records);
        } else {
          setRound((value) => value + 1);
          setFeedback(null);
          locked.current = false;
        }
      }, props.mode === "tutorial" ? 650 : 300);
    },
    [complete, props.mode, props.paused, responseWindow, round, stimulusVisible, telemetry, total, trials],
  );

  useEffect(() => {
    if (props.paused || feedback || stimulusVisible || finished.current) return;
    const trial = trials[round];
    const timeout = window.setTimeout(() => {
      shownAt.current = performance.now();
      setStimulusVisible(true);
      telemetry.record("STIMULUS_SHOWN", round, {
        shape: trial.shape,
        position: trial.position,
        congruent: trial.congruent,
      });
    }, trial.preStimulusMs);
    return () => window.clearTimeout(timeout);
  }, [feedback, props.paused, round, stimulusVisible, telemetry, trials]);

  useEffect(() => {
    if (!stimulusVisible || props.paused || !props.timed || props.mode === "tutorial") return;
    const timeout = window.setTimeout(() => submit("timeout"), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [props.mode, props.paused, props.timed, responseWindow, stimulusVisible, submit]);

  useEffect(() => {
    if (props.paused) {
      if (pausedAt.current === null) pausedAt.current = performance.now();
    } else if (pausedAt.current !== null) {
      if (stimulusVisible) shownAt.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
    }
  }, [props.paused, stimulusVisible]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = event.key === "f" || event.key === "F" || event.key === "ArrowLeft"
        ? "ArrowLeft"
        : event.key === "j" || event.key === "J" || event.key === "ArrowRight"
          ? "ArrowRight"
          : null;
      if (direction) {
        event.preventDefault();
        submit(direction);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const trial = trials[round];

  return (
    <GameShell
      title="Shapeshift"
      eyebrow="Simon interference"
      round={round}
      total={total}
      aside={
        <div>
          <span className="aside-label">FIXED IDENTITY MAP</span>
          <div className="shape-map">
            {SHAPES.map((shape) => (
              <span key={shape}><b>{symbols[shape]}</b><em>{arrows[SHAPE_MAPPING[shape]]}</em></span>
            ))}
          </div>
          <p>F or ← for circle. J or → for square. Ignore where the shape appears.</p>
        </div>
      }
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", minHeight: 220, alignItems: "center" }}
        aria-live="polite"
      >
        {(["left", "right"] as const).map((position) => (
          <div key={position} style={{ display: "grid", placeItems: "center", minWidth: 0 }}>
            {stimulusVisible && trial.position === position && (
              <div className={`shape-stimulus ${trial.shape}`} aria-label={`${trial.shape} on ${position}`}>
                {symbols[trial.shape]}
              </div>
            )}
          </div>
        ))}
        {!stimulusVisible && !feedback && (
          <span style={{ gridColumn: "1 / -1", gridRow: 1, justifySelf: "center", fontSize: "2rem" }}>+</span>
        )}
      </div>
      <p className="prompt-line">Identify the shape. Its position is irrelevant.</p>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
      <div className="direction-pad" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }} aria-label="Shape controls">
        <button type="button" onClick={() => submit("ArrowLeft")} disabled={props.paused || Boolean(feedback)} aria-label="Circle, left">
          ← <small>F · CIRCLE</small>
        </button>
        <button type="button" onClick={() => submit("ArrowRight")} disabled={props.paused || Boolean(feedback)} aria-label="Square, right">
          → <small>J · SQUARE</small>
        </button>
      </div>
    </GameShell>
  );
}
