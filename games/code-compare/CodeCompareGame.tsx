"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, standardDeviation } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { codeCompareLevelSettings, generateCodeTrials } from "./engine";

export function CodeCompareGame(props: GameProps) {
  const levelSettings = useMemo(
    () => codeCompareLevelSettings(props.mode === "tutorial" ? 1 : props.level),
    [props.level, props.mode],
  );
  const total = props.mode === "tutorial" ? 4 : props.config?.trials || levelSettings.trials;
  const length = levelSettings.codeLength;
  const responseWindow = props.mode === "tutorial" ? 3000 : props.config?.timeLimitMs || levelSettings.responseWindowMs;
  const trials = useMemo(
    () => generateCodeTrials(props.seed, total, length, levelSettings.choiceCount, levelSettings.mutationKinds),
    [length, levelSettings.choiceCount, levelSettings.mutationKinds, props.seed, total],
  );
  const telemetry = useGameTelemetry(props.sessionId, "code-compare");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const locked = useRef(false);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const complete = useCallback(
    (records: RoundRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      telemetry.record("GAME_COMPLETED", total);
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "code-compare",
          mode: props.mode,
          difficulty: props.difficulty,
          level: props.level,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: records,
          telemetry: telemetry.events,
          metrics: {
            level: props.level,
            codeLength: length,
            choiceCount: levelSettings.choiceCount,
            responseWindowMs: responseWindow,
            mutationVariety: levelSettings.mutationKinds.length,
            timeouts: records.filter((record) => record.response === "timeout").length,
            consistencyMs: standardDeviation(records.map((record) => record.reactionTimeMs).filter(Boolean)),
            distractorErrors: records.filter((record) => !record.correct && record.response !== "timeout").length,
          },
        }),
      );
    },
    [length, levelSettings.choiceCount, levelSettings.mutationKinds.length, props, responseWindow, telemetry, total],
  );

  const choose = useCallback(
    (choiceIndex: number | "timeout") => {
      if (props.paused || locked.current || finished.current) return;
      locked.current = true;
      const trial = trials[round];
      const reactionTimeMs = performance.now() - shownAt.current;
      const correct = choiceIndex === trial.answer;
      const record: RoundRecord = {
        round: round + 1,
        stimulus: trial.reference,
        response: choiceIndex === "timeout" ? "timeout" : String(choiceIndex + 1),
        correct,
        reactionTimeMs: choiceIndex === "timeout" ? responseWindow : reactionTimeMs,
        score: correct ? 1 : 0,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      telemetry.record(choiceIndex === "timeout" ? "TIMEOUT" : "USER_RESPONSE", round, {
        choice: choiceIndex,
        reactionTimeMs,
      });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", round, { answer: trial.answer });
      setFeedback({
        tone: correct ? "good" : "bad",
        text: correct ? `${Math.round(reactionTimeMs)} ms · exact match` : `Candidate ${trial.answer + 1} was exact`,
      });
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
    telemetry.record("STIMULUS_SHOWN", round, { reference: trials[round].reference });
    if (props.paused || !props.timed || props.mode === "tutorial") return;
    const timeout = window.setTimeout(() => choose("timeout"), responseWindow);
    return () => window.clearTimeout(timeout);
  }, [choose, props.mode, props.paused, props.timed, responseWindow, round, telemetry, trials]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const value = Number(event.key);
      if (value >= 1 && value <= levelSettings.choiceCount) choose(value - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, levelSettings.choiceCount]);

  const trial = trials[round];
  return (
    <GameShell
      title="Code Compare"
      eyebrow="Visual precision"
      round={round}
      total={total}
      score={`${length} digits · ${responseWindow} ms`}
      aside={
        <div>
          <span className="aside-label">RULE</span>
          <strong>Exactly one match</strong>
          <p>Compare every digit. Near-matches may replace or transpose digits at higher levels.</p>
          {props.debug && props.mode !== "simulation" && <code>debug · answer {trial.answer + 1}</code>}
        </div>
      }
    >
      <div className="reference-code">
        <small>REFERENCE NUMBER</small>
        <strong>{trial.reference}</strong>
      </div>
      <p className="prompt-line">Select the exact match.</p>
      <div className="code-choices">
        {trial.choices.map((choice, index) => (
          <button key={`${choice}-${index}`} onClick={() => choose(index)}>
            <kbd>{index + 1}</kbd><span>{choice}</span>
          </button>
        ))}
      </div>
      {feedback && <Feedback tone={feedback.tone}>{feedback.text}</Feedback>}
    </GameShell>
  );
}
