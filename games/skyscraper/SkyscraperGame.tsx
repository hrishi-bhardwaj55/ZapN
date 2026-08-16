"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResult } from "@/lib/engine";
import type { GameProps, RoundRecord } from "@/lib/types";
import { Feedback, GameShell, useGameTelemetry } from "../shared";
import {
  bfsOptimalMoves,
  BLOCK_COLORS,
  generateSkyscraperPuzzle,
  isLegalMove,
  matchesTarget,
  moveBlock,
  type Stacks,
} from "./engine";

const OPTIONS = {
  tutorial: { stackCount: 3, pieceCount: 3, capacity: 3, scrambleMoves: 3, minOptimalMoves: 2 },
  easy: { stackCount: 3, pieceCount: 4, capacity: 3, scrambleMoves: 5, minOptimalMoves: 3 },
  medium: { stackCount: 4, pieceCount: 5, capacity: 3, scrambleMoves: 7, minOptimalMoves: 4 },
  hard: { stackCount: 4, pieceCount: 6, capacity: 3, scrambleMoves: 10, minOptimalMoves: 6 },
};

function Structure({ stacks, compact = false }: { stacks: Stacks; compact?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stacks.length}, minmax(0, 1fr))`,
        alignItems: "end",
        gap: compact ? 6 : 10,
        marginTop: 10,
      }}
      aria-label="Target stack structure"
    >
      {stacks.map((stack, index) => (
        <div
          key={index}
          style={{
            minHeight: compact ? 70 : 90,
            display: "flex",
            flexDirection: "column-reverse",
            justifyContent: "flex-start",
            gap: 3,
            padding: compact ? 5 : 8,
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          {stack.map((block) => (
            <span
              key={block}
              title={block}
              style={{ height: compact ? 12 : 16, borderRadius: 3, background: BLOCK_COLORS[block] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkyscraperGame(props: GameProps) {
  const options = props.mode === "tutorial" ? OPTIONS.tutorial : OPTIONS[props.difficulty];
  const puzzle = useMemo(
    () => generateSkyscraperPuzzle(props.seed, options),
    [options, props.seed],
  );
  const telemetry = useGameTelemetry(props.sessionId, "skyscraper");
  const startedAt = useRef(new Date().toISOString());
  const puzzleStartedAt = useRef(0);
  const firstMoveAt = useRef<number | null>(null);
  const lastMoveAt = useRef(0);
  const roundsRef = useRef<RoundRecord[]>([]);
  const finished = useRef(false);
  const [stacks, setStacks] = useState<Stacks>(() => puzzle.initial.map((stack) => [...stack]));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [invalid, setInvalid] = useState(0);
  const [message, setMessage] = useState("Select a stack to pick up its top block.");

  useEffect(() => {
    const now = performance.now();
    puzzleStartedAt.current = now;
    lastMoveAt.current = now;
  }, []);

  const restart = useCallback(() => {
    if (props.paused || finished.current) return;
    const now = performance.now();
    startedAt.current = new Date().toISOString();
    puzzleStartedAt.current = now;
    firstMoveAt.current = null;
    lastMoveAt.current = now;
    roundsRef.current = [];
    setStacks(puzzle.initial.map((stack) => [...stack]));
    setSelected(null);
    setMoves(0);
    setInvalid(0);
    setMessage("Puzzle restarted. Select a stack to pick up its top block.");
    telemetry.record("ROUND_STARTED", 0, { restarted: true });
  }, [props.paused, puzzle.initial, telemetry]);

  const chooseStack = useCallback(
    (index: number) => {
      if (props.paused || finished.current) return;
      if (selected === null) {
        if (!stacks[index].length) {
          setInvalid((value) => value + 1);
          setMessage("That stack is empty. Pick a stack with a top block.");
          telemetry.record("INCORRECT_RESPONSE", moves, { reason: "empty-source", stack: index });
          return;
        }
        setSelected(index);
        setMessage(`Stack ${index + 1} selected. Choose any stack with free space.`);
        return;
      }
      if (selected === index) {
        setSelected(null);
        setMessage("Selection cleared.");
        return;
      }
      if (!isLegalMove(stacks, selected, index, puzzle.capacity)) {
        setInvalid((value) => value + 1);
        setSelected(null);
        setMessage("That destination is full. No move was counted.");
        telemetry.record("INCORRECT_RESPONSE", moves, { reason: "full-destination", from: selected, to: index });
        return;
      }

      const now = performance.now();
      if (firstMoveAt.current === null) firstMoveAt.current = now;
      const next = moveBlock(stacks, selected, index, puzzle.capacity);
      const nextMoves = moves + 1;
      const record: RoundRecord = {
        round: nextMoves,
        stimulus: `stacks:${stacks.map((stack) => stack.join(".")).join("|")}`,
        response: `${selected + 1}->${index + 1}`,
        correct: true,
        reactionTimeMs: now - lastMoveAt.current,
        score: 1,
      };
      lastMoveAt.current = now;
      const nextRounds = [...roundsRef.current, record];
      roundsRef.current = nextRounds;
      setStacks(next);
      setSelected(null);
      setMoves(nextMoves);
      telemetry.record("CORRECT_RESPONSE", nextMoves, { from: selected, to: index });

      if (!matchesTarget(next, puzzle.target)) {
        setMessage("Legal move. Match every stack to the target structure.");
        return;
      }

      finished.current = true;
      const solveTimeMs = now - puzzleStartedAt.current;
      const planningTimeMs = (firstMoveAt.current ?? now) - puzzleStartedAt.current;
      const efficiency = Math.min(100, (puzzle.optimalPath.length / nextMoves) * 100);
      const averageInterMoveTimeMs =
        nextRounds.length > 1
          ? nextRounds.slice(1).reduce((sum, item) => sum + item.reactionTimeMs, 0) / (nextRounds.length - 1)
          : 0;
      setMessage("Exact match complete.");
      telemetry.record("GAME_COMPLETED", nextMoves, { moves: nextMoves, optimal: puzzle.optimalPath.length });
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
              score: Math.max(0, efficiency - invalid * 3),
              metrics: {
                actualMoves: nextMoves,
                optimalMoves: puzzle.optimalPath.length,
                extraMoves: nextMoves - puzzle.optimalPath.length,
                invalidMoves: invalid,
                moveEfficiency: efficiency,
                planningEfficiency: efficiency,
                planningTimeMs,
                solveTimeMs,
                averageInterMoveTimeMs,
              },
            }),
          ),
        550,
      );
    },
    [invalid, moves, props, puzzle, selected, stacks, telemetry],
  );

  const debugMove = props.debug && props.mode !== "simulation"
    ? bfsOptimalMoves(stacks, puzzle.target, puzzle.capacity)[0]
    : undefined;
  const solved = matchesTarget(stacks, puzzle.target);

  return (
    <GameShell
      title="Skyscraper"
      eyebrow="Stack planning"
      round={moves}
      total={puzzle.optimalPath.length}
      score={`${moves} moves`}
      aside={
        <div>
          <span className="aside-label">TARGET STRUCTURE</span>
          <strong>{puzzle.optimalPath.length} optimal moves</strong>
          <Structure stacks={puzzle.target} compact />
          <p>Move only the top block. Any block may go on any stack with free space.</p>
          {debugMove && <code>debug · try {debugMove.from + 1} → {debugMove.to + 1}</code>}
        </div>
      }
    >
      <div className="game-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>CURRENT STRUCTURE</strong>
        <button className="btn" type="button" onClick={restart} disabled={props.paused || solved}>
          Restart
        </button>
      </div>
      <div className="tower-board" style={{ gridTemplateColumns: `repeat(${stacks.length}, minmax(0, 1fr))` }}>
        {stacks.map((stack, stackIndex) => {
          const legalDestination = selected !== null && isLegalMove(stacks, selected, stackIndex, puzzle.capacity);
          return (
            <button
              key={stackIndex}
              type="button"
              className={`tower-pad ${selected === stackIndex ? "selected" : ""}`}
              style={legalDestination ? { boxShadow: "inset 0 0 0 2px var(--blue)" } : undefined}
              onClick={() => chooseStack(stackIndex)}
              aria-label={`Stack ${stackIndex + 1}, ${stack.length} blocks${legalDestination ? ", legal destination" : ""}`}
              aria-pressed={selected === stackIndex}
            >
              <span className="tower-number">{String(stackIndex + 1).padStart(2, "0")}</span>
              <span className="tower-post" />
              <span className="tower-disks">
                {stack.map((block) => (
                  <span
                    key={block}
                    className="tower-disk"
                    title={block}
                    style={{ width: "78%", background: BLOCK_COLORS[block] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <Feedback tone={message.startsWith("That") ? "bad" : solved ? "good" : "neutral"}>{message}</Feedback>
    </GameShell>
  );
}
