"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue, mean } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { gaugeClickOutcome, generateGauges, normalizeAngle, rescheduleGauge, type GaugeState } from "./engine";

export function StockMasterGame(props: GameProps) {
  const gaugeCount = props.mode === "tutorial" ? 4 : difficultyValue(props.difficulty, { easy: 4, medium: 4, hard: 6 });
  const total = props.mode === "tutorial" ? 6 : props.config?.trials ?? difficultyValue(props.difficulty, { easy: 9, medium: 11, hard: 13 });
  const initialGauges = useMemo(() => generateGauges(props.seed, gaugeCount, props.difficulty === "hard"), [gaugeCount, props.difficulty, props.seed]);
  const gaugesRef = useRef<GaugeState[]>(initialGauges);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrame = useRef(performance.now());
  const startedAt = useRef(new Date().toISOString());
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const telemetry = useGameTelemetry(props.sessionId, "stock-master");
  const [attempts, setAttempts] = useState(0);
  const [hits, setHits] = useState(0);
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
      const deltaSeconds = Math.min(0.05, (timestamp - lastFrame.current) / 1000);
      lastFrame.current = timestamp;
      if (!props.paused) {
        gaugesRef.current.forEach((gauge) => {
          gauge.angle = normalizeAngle(gauge.angle + gauge.angularVelocity * deltaSeconds);
        });
      }
      const context = canvas.getContext("2d");
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        draw(context, bounds.width, bounds.height);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [draw, props.paused]);

  const activate = useCallback(
    (index: number) => {
      if (props.paused || finished.current || !gaugesRef.current[index]) return;
      const gauge = gaugesRef.current[index];
      const outcome = gaugeClickOutcome(gauge);
      const correct = outcome.classification === "HIT";
      const nextAttempts = attempts + 1;
      const nextHits = hits + Number(correct);
      const record: RoundRecord = {
        round: nextAttempts,
        stimulus: `gauge:${index + 1}:target:${Math.round(gauge.targetStartAngle)}-${Math.round(gauge.targetEndAngle)}`,
        response: `${outcome.classification}:${Math.round(gauge.angle)}:${outcome.angularError.toFixed(2)}:${outcome.timeToTargetMs.toFixed(1)}`,
        correct,
        reactionTimeMs: Math.abs(outcome.timeToTargetMs),
        score: outcome.precision,
      };
      const records = [...roundsRef.current, record];
      roundsRef.current = records;
      telemetry.record("USER_RESPONSE", nextAttempts, { gauge: index + 1, ...outcome, angle: gauge.angle });
      telemetry.record(correct ? "CORRECT_RESPONSE" : "INCORRECT_RESPONSE", nextAttempts, { classification: outcome.classification });
      setAttempts(nextAttempts);
      setHits(nextHits);
      setFeedback({
        tone: correct ? "good" : "bad",
        text: correct ? `Gauge ${index + 1} · HIT · ${Math.round(outcome.precision * 100)}% precision` : `Gauge ${index + 1} · ${outcome.classification}`,
      });
      gaugesRef.current[index] = rescheduleGauge(gauge, nextAttempts);
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
                precision: precision * 100,
                meanAngularError: mean(records.map((record) => Number(record.response.split(":")[2]))),
                meanTimeToTargetAtClick: mean(records.map((record) => Number(record.response.split(":")[3]))),
                gaugeCount,
              },
            }),
          ),
        650,
      );
    },
    [attempts, gaugeCount, hits, props, telemetry, total],
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
      score={`${hits} precise hits`}
      aside={<div><span className="aside-label">TARGET</span><strong>Blue arc</strong><p>Click a gauge or press its number while the needle is inside the arc.</p>{props.debug && props.mode !== "simulation" && <code>debug · trajectory active</code>}</div>}
    >
      <canvas ref={canvasRef} className="gauge-canvas" onClick={onCanvasClick} aria-label={`${gaugeCount} animated timing gauges. Use number keys 1 through ${gaugeCount}.`} />
      <Feedback tone={feedback.tone}>{feedback.text}</Feedback>
      <div className="gauge-keys">{Array.from({ length: gaugeCount }, (_, index) => <button key={index} onClick={() => activate(index)}><kbd>{index + 1}</kbd> Gauge {index + 1}</button>)}</div>
    </GameShell>
  );
}
