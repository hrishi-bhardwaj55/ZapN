"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { escalatedVelocity, gaugeClickOutcome, generateGauges, normalizeAngle, rescheduleGauge, stockLevelSettings, targetContains, targetPassState, type GaugeState } from "./engine";

export function StockMasterGame(props: GameProps) {
  const activeLevel = props.mode === "tutorial" ? 3 : props.level;
  const profile = useMemo(() => stockLevelSettings(activeLevel), [activeLevel]);
  const gaugeCount = props.mode === "tutorial" ? 4 : profile.gaugeCount;
  const total = props.mode === "tutorial" ? 6 : props.config?.trials || profile.total;
  const initialGauges = useMemo(
    () => generateGauges(props.seed, gaugeCount, profile),
    [gaugeCount, profile, props.seed],
  );
  const gaugesRef = useRef<GaugeState[]>(initialGauges);
  const targetSeenRef = useRef(initialGauges.map((gauge) => targetContains(gauge.angle, gauge.targetStartAngle, gauge.targetEndAngle)));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrame = useRef(0);
  const startedAt = useRef(new Date().toISOString());
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const telemetry = useGameTelemetry(props.sessionId, "stock-master");
  const attemptsRef = useRef(0);
  const hitsRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const [attempts, setAttempts] = useState(0);
  const [hits, setHits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string }>({ tone: "good", text: "Track every gauge. Activate a needle inside its target arc." });

  const draw = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    context.clearRect(0, 0, width, height);
    const columns = gaugeCount <= 4 ? 2 : 3;
    const rows = Math.ceil(gaugeCount / columns);
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    gaugesRef.current.forEach((gauge, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const centerX = column * cellWidth + cellWidth / 2;
      const centerY = row * cellHeight + cellHeight / 2;
      const radius = Math.min(cellWidth, cellHeight) * 0.31;
      context.save();
      context.lineCap = "round";
      context.strokeStyle = "rgba(111,126,145,.28)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = "#2a93c9";
      context.lineWidth = Math.max(7, radius * 0.11);
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        radius,
        ((gauge.targetStartAngle - 90) * Math.PI) / 180,
        ((gauge.targetEndAngle - 90 + (gauge.targetEndAngle < gauge.targetStartAngle ? 360 : 0)) * Math.PI) / 180,
      );
      context.stroke();
      const needleAngle = ((gauge.angle - 90) * Math.PI) / 180;
      context.strokeStyle = "#18212b";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(centerX + Math.cos(needleAngle) * radius * 0.82, centerY + Math.sin(needleAngle) * radius * 0.82);
      context.stroke();
      context.fillStyle = "#18212b";
      context.beginPath();
      context.arc(centerX, centerY, 5, 0, Math.PI * 2);
      context.fill();
      context.font = `600 ${Math.max(13, radius * 0.19)}px ui-monospace, monospace`;
      context.textAlign = "center";
      context.fillText(String(index + 1), centerX, centerY + radius + 24);
      context.restore();
    });
  }, [gaugeCount]);

  const completeAttempt = useCallback(
    (index: number, missedPass = false) => {
      if (props.paused || finished.current || !gaugesRef.current[index]) return;
      const gauge = gaugesRef.current[index];
      const outcome = gaugeClickOutcome(gauge);
      const classification = missedPass ? "MISSED_PASS" : outcome.classification;
      const correct = classification === "HIT";
      const nextAttempts = attemptsRef.current + 1;
      const nextHits = hitsRef.current + Number(correct);
      const nextStreak = correct ? streakRef.current + 1 : 0;
      attemptsRef.current = nextAttempts;
      hitsRef.current = nextHits;
      streakRef.current = nextStreak;
      bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);
      const record: RoundRecord = {
        round: nextAttempts,
        stimulus: `gauge:${index + 1}:target:${Math.round(gauge.targetStartAngle)}-${Math.round(gauge.targetEndAngle)}`,
        response: `${classification}:${Math.round(gauge.angle)}:${outcome.angularError.toFixed(2)}:${outcome.timeToTargetMs.toFixed(1)}`,
        correct,
        reactionTimeMs: Math.abs(outcome.timeToTargetMs),
        score: outcome.precision,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      telemetry.record("USER_RESPONSE", nextAttempts, { gauge: index + 1, ...outcome, classification, angle: gauge.angle });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", nextAttempts, { classification });
      setAttempts(nextAttempts);
      setHits(nextHits);
      setStreak(nextStreak);
      setFeedback({
        tone: correct ? "good" : "bad",
        text: correct
          ? `Gauge ${index + 1} · HIT · ${Math.round(outcome.precision * 100)}% precision · ${nextStreak} streak`
          : missedPass
            ? `Gauge ${index + 1} · MISSED TARGET PASS`
            : `Gauge ${index + 1} · ${outcome.classification}`,
      });
      gaugesRef.current = gaugesRef.current.map((currentGauge, gaugeIndex) =>
        gaugeIndex === index
          ? rescheduleGauge(currentGauge, nextAttempts)
          : { ...currentGauge, angularVelocity: escalatedVelocity(currentGauge.angularVelocity, nextAttempts) });
      targetSeenRef.current[index] = false;
      if (nextAttempts < total) return;
      finished.current = true;
      telemetry.record("GAME_COMPLETED", total, { hits: nextHits });
      const precision = mean(records.filter((record) => record.correct).map((record) => record.score));
      window.setTimeout(
        () =>
          props.onFinish(
            buildResult({
              sessionId: props.sessionId,
              gameId: "stock-master",
              mode: props.mode,
              difficulty: props.difficulty,
              level: props.level,
              seed: props.seed,
              startedAt: startedAt.current,
              rounds: records,
              telemetry: telemetry.events,
              score: (nextHits / total) * 70 + precision * 30,
              metrics: {
                successfulHits: nextHits,
                misses: total - nextHits,
                earlyClicks: records.filter((record) => record.response.startsWith("EARLY")).length,
                lateClicks: records.filter((record) => record.response.startsWith("LATE")).length,
                missedTargetPasses: records.filter((record) => record.response.startsWith("MISSED_PASS")).length,
                precision: precision * 100,
                meanAngularError: mean(records.map((record) => Number(record.response.split(":")[2]))),
                meanTimeToTargetAtClick: mean(records.map((record) => Number(record.response.split(":")[3]))),
                gaugeCount,
                bestStreak: bestStreakRef.current,
                targetZoneWidth: profile.targetWidth,
                initialMinVelocity: profile.minVelocity,
                initialMaxVelocity: profile.maxVelocity,
                arrivalSpacingMs: profile.arrivalSpacingSeconds * 1000,
                level: props.level,
              },
            }),
          ),
        650,
      );
    },
    [gaugeCount, profile, props, telemetry, total],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const render = (timestamp: number) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const pixelWidth = Math.max(1, Math.floor(bounds.width * ratio));
      const pixelHeight = Math.max(1, Math.floor(bounds.height * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const deltaSeconds = lastFrame.current === 0 ? 0 : Math.min(0.05, (timestamp - lastFrame.current) / 1000);
      lastFrame.current = timestamp;
      const missedIndices: number[] = [];
      if (!props.paused) {
        gaugesRef.current.forEach((gauge, index) => {
          gauge.angle = normalizeAngle(gauge.angle + gauge.angularVelocity * deltaSeconds);
          const pass = targetPassState(gauge, targetSeenRef.current[index]);
          targetSeenRef.current[index] = pass.inside;
          if (pass.missed) missedIndices.push(index);
        });
      }
      missedIndices.forEach((index) => completeAttempt(index, true));
      const context = canvas.getContext("2d");
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        draw(context, bounds.width, bounds.height);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [completeAttempt, draw, props.paused]);

  const activate = useCallback(
    (index: number) => completeAttempt(index),
    [completeAttempt],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < gaugeCount) activate(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activate, gaugeCount]);

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const columns = gaugeCount <= 4 ? 2 : 3;
    const rows = Math.ceil(gaugeCount / columns);
    const column = Math.min(columns - 1, Math.floor((event.clientX - bounds.left) / (bounds.width / columns)));
    const row = Math.min(rows - 1, Math.floor((event.clientY - bounds.top) / (bounds.height / rows)));
    const index = row * columns + column;
    if (index < gaugeCount) activate(index);
  };

  return (
    <GameShell
      title="Stock Master"
      eyebrow="Divided attention"
      round={attempts}
      total={total}
      score={`${hits} hits · ${streak} streak`}
      aside={<div><span className="aside-label">TARGET</span><strong>Blue arc</strong><p>Each number always maps to the same gauge. Unclaimed target passes count as misses, and gauge speed rises as the run progresses.</p>{props.debug && props.mode !== "simulation" && <code>debug · trajectory active</code>}</div>}
    >
      <canvas ref={canvasRef} className="gauge-canvas" onClick={onCanvasClick} aria-label={`${gaugeCount} animated timing gauges. Use number keys 1 through ${gaugeCount}.`} />
      <Feedback tone={feedback.tone}>{feedback.text}</Feedback>
      <div className="gauge-keys">{Array.from({ length: gaugeCount }, (_, index) => <button key={index} onClick={() => activate(index)}><kbd>{index + 1}</kbd> Gauge {index + 1}</button>)}</div>
    </GameShell>
  );
}
