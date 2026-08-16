"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean, standardDeviation } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { balloonScale, balloonScore, cashOutValue, generateBalloons, pumpBalloon } from "./engine";

export function BalloonGame(props: GameProps) {
  const total = props.mode === "tutorial" ? 2 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 8, medium: 12, hard: 20 });
  const deadlineEnabled = props.timed && props.mode === "simulation";
  const trials = useMemo(
    () => generateBalloons(props.seed, props.difficulty, total),
    [props.seed, props.difficulty, total],
  );
  const telemetry = useGameTelemetry(props.sessionId, "balloon");
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(0);
  const deadline = useRef(0);
  const pauseStarted = useRef<number | null>(null);
  const inputLocked = useRef(false);
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const [round, setRound] = useState(0);
  const [pumps, setPumps] = useState(0);
  const [banked, setBanked] = useState(0);
  const [explosions, setExplosions] = useState(0);
  const [status, setStatus] = useState<"active" | "burst" | "banked" | "timeout">("active");
  const [timeLeft, setTimeLeft] = useState(props.config?.timeLimitMs || 15000);

  useEffect(() => {
    const timestamp = performance.now();
    const duration = props.config?.timeLimitMs || 15000;
    shownAt.current = timestamp;
    deadline.current = timestamp + duration;
  }, [props.config?.timeLimitMs]);

  const finish = useCallback(
    (nextRounds: RoundRecord[], nextBanked: number, nextExplosions: number) => {
      if (finished.current) return;
      finished.current = true;
      telemetry.record("GAME_COMPLETED", total, { banked: nextBanked });
      const pumpsByRound = nextRounds.map((item) => Number(item.stimulus.split(":")[1]));
      const cashOutRounds = nextRounds.filter((item) => item.response === "cash-out");
      const cashOutPumps = cashOutRounds.map((item) => Number(item.stimulus.split(":")[1]));
      const adjustedAveragePumps = mean(cashOutPumps);
      const postExplosionChanges = nextRounds.reduce<number[]>((changes, item, index) => {
        if (index > 0 && nextRounds[index - 1].response === "burst") {
          changes.push(Number(item.stimulus.split(":")[1]) - Number(nextRounds[index - 1].stimulus.split(":")[1]));
        }
        return changes;
      }, []);
      const adjustedPumpsForColor = (color: "blue" | "yellow" | "orange") =>
        mean(cashOutRounds
          .filter((item) => trials[item.round - 1]?.color === color)
          .map((item) => Number(item.stimulus.split(":")[1])));
      props.onFinish(
        buildResult({
          sessionId: props.sessionId,
          gameId: "balloon",
          mode: props.mode,
          difficulty: props.difficulty,
          seed: props.seed,
          startedAt: startedAt.current,
          rounds: nextRounds,
          telemetry: telemetry.events,
          score: balloonScore(adjustedAveragePumps, props.difficulty),
          metrics: {
            adjustedAveragePumps,
            bankedMoney: nextBanked,
            explosions: nextExplosions,
            cashOuts: cashOutRounds.length,
            averagePumps: mean(pumpsByRound),
            pumpVariance: standardDeviation(pumpsByRound) ** 2,
            explosionPercentage: (nextExplosions / total) * 100,
            postExplosionAdaptation: mean(postExplosionChanges),
            rollingAveragePumps: mean(pumpsByRound.slice(-3)),
            blueAdjustedAveragePumps: adjustedPumpsForColor("blue"),
            yellowAdjustedAveragePumps: adjustedPumpsForColor("yellow"),
            orangeAdjustedAveragePumps: adjustedPumpsForColor("orange"),
          },
        }),
      );
    },
    [props, telemetry, total, trials],
  );

  const advance = useCallback(
    (record: RoundRecord, nextBanked: number, nextExplosions: number) => {
      const nextRounds = [...roundsRef.current, record];
      roundsRef.current = nextRounds;
      telemetry.record("ROUND_COMPLETED", round, { correct: record.correct });
      if (round + 1 >= total) {
        window.setTimeout(() => finish(nextRounds, nextBanked, nextExplosions), 620);
        return;
      }
      window.setTimeout(() => {
        setRound((value) => value + 1);
        setPumps(0);
        setStatus("active");
        inputLocked.current = false;
        shownAt.current = performance.now();
        const duration = props.config?.timeLimitMs || 15000;
        deadline.current = performance.now() + duration;
        setTimeLeft(duration);
        telemetry.record("ROUND_STARTED", round + 1, { seed: props.seed });
      }, 620);
    },
    [finish, props.config?.timeLimitMs, props.seed, round, telemetry, total],
  );

  const pump = useCallback(() => {
    if (props.paused || inputLocked.current || status !== "active" || finished.current) return;
    const outcome = pumpBalloon(pumps, trials[round].breakpoint);
    telemetry.record("USER_RESPONSE", round, { action: "PUMP", pump: outcome.nextPump });
    if (!outcome.exploded) {
      setPumps(outcome.nextPump);
      return;
    }
    const nextExplosions = explosions + 1;
    inputLocked.current = true;
    setPumps(outcome.nextPump);
    setExplosions(nextExplosions);
    setStatus("burst");
    advance(
      {
        round: round + 1,
        stimulus: `pumps:${outcome.nextPump}`,
        response: "burst",
        correct: true,
        reactionTimeMs: performance.now() - shownAt.current,
        score: 0,
      },
      banked,
      nextExplosions,
    );
  }, [advance, banked, explosions, props.paused, pumps, round, status, telemetry, trials]);

  const cashOut = useCallback(() => {
    if (props.paused || inputLocked.current || status !== "active" || pumps === 0 || finished.current) return;
    inputLocked.current = true;
    const nextBanked = banked + cashOutValue(pumps);
    setBanked(nextBanked);
    setStatus("banked");
    advance(
      {
        round: round + 1,
        stimulus: `pumps:${pumps}`,
        response: "cash-out",
        correct: true,
        reactionTimeMs: performance.now() - shownAt.current,
        score: pumps,
      },
      nextBanked,
      explosions,
    );
  }, [advance, banked, explosions, props.paused, pumps, round, status]);

  const timeOut = useCallback(() => {
    if (props.paused || inputLocked.current || status !== "active" || finished.current) return;
    inputLocked.current = true;
    setStatus("timeout");
    telemetry.record("TIMEOUT", round, { pumps });
    advance(
      {
        round: round + 1,
        stimulus: `pumps:${pumps}`,
        response: "timeout",
        correct: false,
        reactionTimeMs: props.config?.timeLimitMs || 15000,
        score: 0,
      },
      banked,
      explosions,
    );
  }, [advance, banked, explosions, props.config?.timeLimitMs, props.paused, pumps, round, status, telemetry]);

  useEffect(() => {
    if (!deadlineEnabled || status !== "active") return;
    if (props.paused) {
      pauseStarted.current = performance.now();
      return;
    }
    if (pauseStarted.current !== null) {
      deadline.current += performance.now() - pauseStarted.current;
      pauseStarted.current = null;
    }
    let frame = 0;
    const tick = () => {
      const remaining = Math.max(0, deadline.current - performance.now());
      const rounded = Math.ceil(remaining / 100) * 100;
      setTimeLeft((current) => current === rounded ? current : rounded);
      if (remaining <= 0) timeOut();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadlineEnabled, props.paused, round, status, timeOut]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        pump();
      }
      if (event.code === "Enter") cashOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cashOut, pump]);

  const trial = trials[round];
  return (
    <GameShell
      title="Balloon"
      eyebrow="Risk calibration"
      round={round}
      total={total}
      score={deadlineEnabled ? `$${banked.toFixed(0)} permanent · ${(timeLeft / 1000).toFixed(1)}s` : `$${banked.toFixed(0)} permanent`}
      aside={
        <div>
          <span className="aside-label">BALLOON CLASS</span>
          <strong className="capitalize">{trial.color}</strong>
          <p>Each color has a hidden pressure profile. A burst loses only the temporary value; your permanent bank is safe.</p>
          {props.debug && props.mode !== "simulation" && (
            <code>debug · breakpoint {trial.breakpoint}</code>
          )}
        </div>
      }
    >
      <div className="balloon-arena">
        <div
          className={`balloon ${trial.color} ${status}`}
          style={{ transform: `scale(${balloonScale(pumps)})` }}
          aria-label={`${trial.color} balloon, ${pumps} pumps`}
        >
          <span />
        </div>
      </div>
      <div className="value-readout">
        <small>TEMPORARY VALUE</small>
        <strong>${pumps.toFixed(0)}</strong>
      </div>
      {status === "burst" && <Feedback tone="bad">BURST · ${pumps} temporary lost · permanent bank safe</Feedback>}
      {status === "banked" && <Feedback tone="good">BANKED · ${pumps} transferred to permanent</Feedback>}
      {status === "timeout" && <Feedback tone="bad">TIMEOUT · temporary value lost</Feedback>}
      <div className="game-actions two-up">
        <button className="btn secondary" onClick={pump} disabled={status !== "active"}>
          <kbd>SPACE</kbd> Pump +$1
        </button>
        <button className="btn primary" onClick={cashOut} disabled={status !== "active" || pumps === 0}>
          <kbd>ENTER</kbd> Collect
        </button>
      </div>
    </GameShell>
  );
}
