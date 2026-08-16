"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { calculateSwitchCost, generateSwitchTrials } from "./engine";

export function SwitchGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 5 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 9, medium: 11, hard: 13 });
  const responseWindow = props.config?.timeLimitMs || difficultyValue(props.difficulty, { easy: 3200, medium: 2400, hard: 1750 });
  const sequenceLength = difficultyValue(props.difficulty, { easy: 3, medium: 4, hard: 5 });
  const trials = useMemo(() => generateSwitchTrials(props.seed, total, sequenceLength), [props.seed, sequenceLength, total]);
  const telemetry = useGameTelemetry(props.sessionId, "switch");
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
      const costs = calculateSwitchCost(records);
      telemetry.record("GAME_COMPLETED", total, costs);
      const switchRecords = records.filter((record) => record.stimulus.startsWith("switch:"));
      const repeatRecords = records.filter((record) => record.stimulus.startsWith("repeat:"));
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "switch",
          mode: props.mode,
          difficulty: props.difficulty,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            switchCostMs: costs.switchCost,
            switchReactionTimeMs: costs.switchRt,
            repeatReactionTimeMs: costs.repeatRt,
            switchAccuracy: switchRecords.length ? (switchRecords.filter((record) => record.correct).length / switchRecords.length) * 100 : 0,
            repeatAccuracy: repeatRecords.length ? (repeatRecords.filter((record) => record.correct).length / repeatRecords.length) * 100 : 0,
            timeouts: records.filter((record) => record.response === "timeout").length,
          },
        }),
      );
    },
    [props, telemetry, total],
  );

  const respond = useCallback(
    (answer: boolean | "timeout") => {
      if (props.paused || locked.current || finished.current) return;
      locked.current = true;
      const trial = trials[round];
      const reactionTimeMs = performance.now() - shownAt.current;
      const correct = answer === trial.answer;
      const record: RoundRecord = {
        round: round + 1,
        stimulus: `${trial.switched ? "switch" : "repeat"}:${trial.task}`,
        response: answer === "timeout" ? "timeout" : answer ? "yes" : "no",
        correct,
        reactionTimeMs: answer === "timeout" ? responseWindow : reactionTimeMs,
        score: correct ? 1 : 0,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      telemetry.record(answer === "timeout" ? "TIMEOUT" : "USER_RESPONSE", round, { answer, reactionTimeMs, switched: trial.switched });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { expected: trial.answer });
      setFeedback({ tone: correct ? "good" : "bad", text: correct ? `${trial.switched ? "Switch" : "Repeat"} · ${Math.round(reactionTimeMs)} ms` : `Correct answer: ${trial.answer ? "YES" : "NO"}` });
      window.setTimeout(() => {
        if (round + 1 >= total) complete(records);
        else {
          setRound((value) => value + 1);
          setFeedback(null);
          locked.current = false;
          shownAt.current = performance.now();
        }
      }, props.mode === "tutorial" ? 700 : 280);
    },
    [complete, props.mode, props.paused, responseWindow, round, telemetry, total, trials],
  );

  useEffect(() => {
    shownAt.current = performance.now();
    telemetry.record("STIMULUS_SHOWN", round, { task: trials[round].task, switched: trials[round].switched });
    if (props.paused || !props.timed || props.mode === "tutorial") return;
    const timeout = window.setTimeout(() => respond("timeout"), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [props.mode, props.paused, props.timed, respond, responseWindow, round, telemetry, trials]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") respond(false);
      if (event.key.toLowerCase() === "j") respond(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond]);

  const trial = trials[round];
  return (
    <GameShell
      title="The Switch"
      eyebrow="Cognitive flexibility"
      round={round}
      total={total}
      score={trial.switched ? "TASK SWITCH" : "TASK REPEAT"}
      aside={<div><span className="aside-label">ACTIVE TASK</span><strong>{trial.task}</strong><p>Ignore the uncued panel. Answer only the highlighted task.</p></div>}
    >
      <div className="task-cue">{trial.task}</div>
      <div className="switch-panels">
        <div className={trial.task === "NUMBER" ? "active" : "muted"}>
          <small>NUMBER</small>
          <strong>{trial.arithmetic.left} + {trial.arithmetic.right} = {trial.arithmetic.result}</strong>
          <p>{trial.arithmetic.question}</p>
        </div>
        <div className={trial.task === "ARROWS" ? "active" : "muted"}>
          <small>ARROWS</small>
          <strong>{trial.arrows.top.join(" ")}</strong>
          <strong>{trial.arrows.bottom.join(" ")}</strong>
          <p>ARE THEY THE SAME?</p>
        </div>
      </div>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
      <div className="game-actions two-up yes-no">
        <button
          className="btn secondary"
          disabled={Boolean(feedback)}
          onClick={(event) => {
            if (event.detail < 2) respond(false);
          }}
        ><kbd>F</kbd> No</button>
        <button
          className="btn primary"
          disabled={Boolean(feedback)}
          onClick={(event) => {
            if (event.detail < 2) respond(true);
          }}
        ><kbd>J</kbd> Yes</button>
      </div>
    </GameShell>
  );
}
