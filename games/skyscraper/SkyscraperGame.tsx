"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { buildResult, difficultyValue } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import { bfsOptimalMoves, createTowers, isSolved, moveDisk } from "./engine";

export function SkyscraperGame(props: GameProps) {
  const diskCount = props.mode === "tutorial" ? 3 : difficultyValue(props.difficulty, { easy: 3, medium: 4, hard: 5 });
  const optimalPath = useMemo(() => bfsOptimalMoves(diskCount), [diskCount]);
  const telemetry = useGameTelemetry(props.sessionId, "skyscraper");
  const startedAt = useRef(new Date().toISOString());
  const lastMoveAt = useRef(performance.now());
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const [towers, setTowers] = useState(() => createTowers(diskCount));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [invalid, setInvalid] = useState(0);
  const [message, setMessage] = useState("Select the tower holding the top floor.");

  const chooseTower = useCallback(
    (index: number) => {
      if (props.paused || finished.current) return;
      if (selected === null) {
        if (!towers[index].length) {
          setInvalid((value) => value + 1);
          setMessage("That tower is empty. Choose another source.");
          telemetry.record("INCORRECT_RESPONSE", moves, { reason: "empty-source", tower: index });
          return;
        }
        setSelected(index);
        setMessage(`Tower ${index + 1} selected. Choose a destination.`);
        return;
      }
      if (selected === index) {
        setSelected(null);
        setMessage("Selection cleared.");
        return;
      }
      const next = moveDisk(towers, selected, index);
      if (!next) {
        setInvalid((value) => value + 1);
        setSelected(null);
        setMessage("Illegal move: a larger floor cannot sit on a smaller one.");
        telemetry.record("INCORRECT_RESPONSE", moves, { from: selected, to: index });
        return;
      }
      const nextMoves = moves + 1;
      const responseTime = performance.now() - lastMoveAt.current;
      lastMoveAt.current = performance.now();
      const record: RoundRecord = {
        round: nextMoves,
        stimulus: `towers:${towers.map((tower) => tower.join(".")).join("|")}`,
        response: `${selected + 1}->${index + 1}`,
        correct: true,
        reactionTimeMs: responseTime,
        score: 1,
      };
      const nextRounds = [...roundsRef.current, record];
      roundsRef.current = nextRounds;
      setTowers(next);
      setSelected(null);
      setMoves(nextMoves);
      telemetry.record("CORRECT_RESPONSE", nextMoves, { from: selected, to: index });
      if (!isSolved(next, diskCount)) {
        setMessage("Legal move. Continue toward the outlined target tower.");
        return;
      }
      finished.current = true;
      const efficiency = (optimalPath.length / nextMoves) * 100;
      setMessage("Tower complete.");
      telemetry.record("GAME_COMPLETED", nextMoves, { moves: nextMoves, optimal: optimalPath.length });
      window.setTimeout(
        () =>
          props.onFinish(
            buildResult({
              sessionId: props.sessionId,
              gameId: "skyscraper",
              mode: props.mode,
              difficulty: props.difficulty,
              seed: props.seed,
              startedAt: startedAt.current,
              rounds: nextRounds,
              telemetry: telemetry.events,
              score: Math.max(0, Math.min(100, efficiency - invalid * 3)),
              metrics: {
                actualMoves: nextMoves,
                optimalMoves: optimalPath.length,
                invalidMoves: invalid,
                planningEfficiency: efficiency,
              },
            }),
          ),
        550,
      );
    },
    [diskCount, invalid, moves, optimalPath.length, props, selected, telemetry, towers],
  );

  return (
    <GameShell
      title="Skyscraper"
      eyebrow="Planning efficiency"
      round={moves}
      total={optimalPath.length}
      score={`${moves} moves`}
      aside={
        <div>
          <span className="aside-label">OPTIMAL TARGET</span>
          <strong>{optimalPath.length} moves</strong>
          <p>Build the complete tower on pad 3. Only the top floor can move.</p>
          {props.debug && props.mode !== "simulation" && optimalPath[moves] && (
            <code>debug · try {optimalPath[moves][0] + 1} → {optimalPath[moves][1] + 1}</code>
          )}
        </div>
      }
    >
      <div className="tower-board">
        {towers.map((tower, towerIndex) => (
          <button
            key={towerIndex}
            className={`tower-pad ${selected === towerIndex ? "selected" : ""} ${towerIndex === 2 ? "target" : ""}`}
            onClick={() => chooseTower(towerIndex)}
            aria-label={`Tower ${towerIndex + 1}, ${tower.length} floors`}
          >
            <span className="tower-number">0{towerIndex + 1}</span>
            <span className="tower-post" />
            <span className="tower-disks">
              {tower.map((disk) => (
                <span
                  key={disk}
                  className={`tower-disk disk-${disk}`}
                  style={{ width: `${30 + disk * 13}%` }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <Feedback tone={message.startsWith("Illegal") ? "bad" : isSolved(towers, diskCount) ? "good" : "neutral"}>
        {message}
      </Feedback>
    </GameShell>
  );
}
