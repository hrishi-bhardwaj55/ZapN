"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { calculateSwitchCost, generateSwitchTrials, switchLevelSettings } from "./engine";

export function SwitchGame(props: GameProps) {
  const activeLevel = props.mode === "tutorial" ? 3 : props.level;
  const profile = useMemo(() => switchLevelSettings(activeLevel), [activeLevel]);
  const total = props.mode === "tutorial" ? 6 : props.config?.trials || profile.total;
  const responseWindow = props.mode === "tutorial" ? profile.responseWindowMs : props.config?.timeLimitMs || profile.responseWindowMs;
  const trials = useMemo(
    () => generateSwitchTrials(props.seed, total, profile.sequenceLength, profile.switchRate),
    [profile, props.seed, total],
  );
  const telemetry = useGameTelemetry(props.sessionId, "switch");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const locked = useRef(false);
  const finished = useRef(false);
  const pausedRef = useRef(props.paused);
  const transitionTimer = useRef<number | null>(null);
  const pendingTransition = useRef<(() => void) | null>(null);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const complete = useCallback((records: RoundRecord[]) => {
    if (finished.current) return;
    finished.current = true;
    const costs = calculateSwitchCost(records);
    const switchRecords = records.filter((record) => record.stimulus.startsWith("switch:"));
    const repeatRecords = records.filter((record) => record.stimulus.startsWith("repeat:"));
    telemetry.record("GAME_COMPLETED", total, costs);
    props.onFinish(buildResult({
      sessionId: props.sessionId,
      gameId: "switch",
      mode: props.mode,
      difficulty: props.difficulty,
      level: props.level,
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
        positionErrors: records.filter((record) => !record.correct && record.response !== "timeout").length,
        timeouts: records.filter((record) => record.response === "timeout").length,
        sequenceLength: profile.sequenceLength,
        responseWindowMs: responseWindow,
        switchRateTarget: profile.switchRate * 100,
        actualSwitchRate: records.length > 1 ? (switchRecords.length / (records.length - 1)) * 100 : 0,
        level: props.level,
      },
    }));
  }, [profile, props, responseWindow, telemetry, total]);

  const respond = useCallback((answer: boolean | "timeout") => {
    if (pausedRef.current || locked.current || finished.current) return;
    locked.current = true;
    const trial = trials[round];
    const reactionTimeMs = performance.now() - shownAt.current;
    const correct = answer === trial.answer;
    const record: RoundRecord = {
      round: round + 1,
      stimulus: `${trial.switched ? "switch" : "repeat"}:${trial.position}:${trial.task}`,
      response: answer === "timeout" ? "timeout" : answer ? "yes" : "no",
      correct,
      reactionTimeMs: answer === "timeout" ? responseWindow : reactionTimeMs,
      score: correct ? 1 : 0,
    };
    const records = [...roundsRef.current, record];
    roundsRef.current = records;
    telemetry.record(answer === "timeout" ? "TIMEOUT" : "USER_RESPONSE", round, { answer, position: trial.position, reactionTimeMs });
    telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { expected: trial.answer, task: trial.task });
    setFeedback({
      tone: correct ? "good" : "bad",
      text: correct ? `${trial.switched ? "Switch" : "Repeat"} · ${Math.round(reactionTimeMs)} ms` : `Correct answer: ${trial.answer ? "YES" : "NO"}`,
    });
    const transition = () => {
      if (round + 1 >= total) complete(records);
      else {
        setRound((value) => value + 1);
        setFeedback(null);
        locked.current = false;
        shownAt.current = performance.now();
      }
    };
    pendingTransition.current = transition;
    transitionTimer.current = window.setTimeout(() => {
      if (pausedRef.current) return;
      pendingTransition.current = null;
      transition();
    }, props.mode === "tutorial" ? 650 : 240);
  }, [complete, props.mode, responseWindow, round, telemetry, total, trials]);

  useEffect(() => {
    pausedRef.current = props.paused;
    if (props.paused && transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
    if (!props.paused && pendingTransition.current) {
      const transition = pendingTransition.current;
      transitionTimer.current = window.setTimeout(() => {
        if (pausedRef.current) return;
        pendingTransition.current = null;
        transition();
      }, 0);
    }
  }, [props.paused]);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

  useEffect(() => {
    shownAt.current = performance.now();
    const trial = trials[round];
    telemetry.record("STIMULUS_SHOWN", round, { position: trial.position, task: trial.task, switched: trial.switched });
    if (props.paused || !props.timed || props.mode === "tutorial") return;
    const timeout = window.setTimeout(() => respond("timeout"), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [props.mode, props.paused, props.timed, respond, responseWindow, round, telemetry, trials]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" || event.key === "ArrowLeft") respond(false);
      if (event.key.toLowerCase() === "j" || event.key === "ArrowRight") respond(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond]);

  const trial = trials[round];
  const prompt = trial.task === "NUMBER"
    ? <><strong>{trial.arithmetic.left} + {trial.arithmetic.right} = {trial.arithmetic.result}</strong><p>IS THE RESULT {trial.arithmetic.asksOdd ? "ODD" : "EVEN"}?</p></>
    : <><strong>{trial.arrows.top.join(" ")}</strong><strong>{trial.arrows.bottom.join(" ")}</strong><p>ARE THEY THE SAME?</p></>;

  return (
    <GameShell
      title="The Switch"
      eyebrow="Position-driven task switching"
      round={round}
      total={total}
      score={trial.switched ? "TASK SWITCH" : "TASK REPEAT"}
      aside={<div><span className="aside-label">POSITION RULE</span><strong>Above = Number</strong><strong>Below = Arrows</strong><p>The prompt never names its rule. Read its position, then answer Yes or No.</p></div>}
    >
      <div className="position-switch-board" aria-label={`Prompt in ${trial.position} region`}>
        <div className={`position-zone top ${trial.position === "top" ? "active" : ""}`}>
          {trial.position === "top" && <div className="switch-prompt-card"><small>ABOVE</small>{prompt}</div>}
        </div>
        <div className="position-divider"><span>POSITION DECIDES THE RULE</span></div>
        <div className={`position-zone bottom ${trial.position === "bottom" ? "active" : ""}`}>
          {trial.position === "bottom" && <div className="switch-prompt-card"><small>BELOW</small>{prompt}</div>}
        </div>
      </div>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
      <div className="game-actions two-up yes-no">
        <button className="btn secondary" disabled={Boolean(feedback)} onClick={(event) => { if (event.detail < 2) respond(false); }}><kbd>F / ←</kbd> No</button>
        <button className="btn primary" disabled={Boolean(feedback)} onClick={(event) => { if (event.detail < 2) respond(true); }}><kbd>J / →</kbd> Yes</button>
      </div>
    </GameShell>
  );
}
