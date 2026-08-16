import { randomInt, seededRandom, shuffle } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

export type BlockId = string;
export type Stacks = BlockId[][];

export interface StackMove {
  from: number;
  to: number;
}

export interface SkyscraperPuzzle {
  initial: Stacks;
  target: Stacks;
  capacity: number;
  optimalPath: StackMove[];
}

export interface PuzzleOptions {
  stackCount: number;
  pieceCount: number;
  capacity: number;
  scrambleMoves: number;
  minOptimalMoves?: number;
}

export function skyscraperOptionsForLevel(level: GameLevel): PuzzleOptions {
  return levelValue(level, [
    { stackCount: 3, pieceCount: 3, capacity: 3, scrambleMoves: 3, minOptimalMoves: 2 },
    { stackCount: 3, pieceCount: 4, capacity: 3, scrambleMoves: 5, minOptimalMoves: 3 },
    { stackCount: 4, pieceCount: 5, capacity: 3, scrambleMoves: 7, minOptimalMoves: 4 },
    { stackCount: 4, pieceCount: 6, capacity: 3, scrambleMoves: 10, minOptimalMoves: 6 },
    { stackCount: 4, pieceCount: 7, capacity: 3, scrambleMoves: 14, minOptimalMoves: 8 },
  ] as const);
}

export const BLOCK_COLORS: Record<BlockId, string> = {
  coral: "#ef6f61",
  teal: "#1ca59c",
  amber: "#f2b84b",
  blue: "#4b7bec",
  violet: "#9b6de3",
  green: "#64a852",
  rose: "#df6394",
  gold: "#d89928",
};

const BLOCK_IDS = Object.keys(BLOCK_COLORS);

export function stateKey(stacks: Stacks) {
  return stacks.map((stack) => stack.join(",")).join("|");
}

export function isLegalMove(stacks: Stacks, from: number, to: number, capacity: number) {
  return (
    from !== to &&
    from >= 0 &&
    to >= 0 &&
    from < stacks.length &&
    to < stacks.length &&
    stacks[from].length > 0 &&
    stacks[to].length < capacity
  );
}

export function moveBlock(stacks: Stacks, from: number, to: number, capacity: number): Stacks {
  if (!isLegalMove(stacks, from, to, capacity)) return stacks;
  const next = stacks.map((stack) => [...stack]);
  const block = next[from].pop();
  if (block) next[to].push(block);
  return next;
}

export function matchesTarget(stacks: Stacks, target: Stacks) {
  return stateKey(stacks) === stateKey(target);
}

export function legalMoves(stacks: Stacks, capacity: number): StackMove[] {
  const moves: StackMove[] = [];
  for (let from = 0; from < stacks.length; from += 1) {
    for (let to = 0; to < stacks.length; to += 1) {
      if (isLegalMove(stacks, from, to, capacity)) moves.push({ from, to });
    }
  }
  return moves;
}

export function bfsOptimalMoves(start: Stacks, target: Stacks, capacity: number): StackMove[] {
  const targetKey = stateKey(target);
  if (stateKey(start) === targetKey) return [];

  const queue: Array<{ stacks: Stacks; path: StackMove[] }> = [{ stacks: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    for (const move of legalMoves(current.stacks, capacity)) {
      const next = moveBlock(current.stacks, move.from, move.to, capacity);
      const key = stateKey(next);
      if (seen.has(key)) continue;
      const path = [...current.path, move];
      if (key === targetKey) return path;
      seen.add(key);
      queue.push({ stacks: next, path });
    }
  }
  return [];
}

function buildTarget(seed: string, options: PuzzleOptions): Stacks {
  const random = seededRandom(`${seed}:target`);
  const blocks = shuffle(BLOCK_IDS.slice(0, options.pieceCount), random);
  const target = Array.from({ length: options.stackCount }, () => [] as BlockId[]);
  blocks.forEach((block, index) => {
    const preferred = index % options.stackCount;
    const available = Array.from({ length: options.stackCount }, (_, stack) => stack).filter(
      (stack) => target[stack].length < options.capacity,
    );
    const destination = available.includes(preferred)
      ? preferred
      : available[randomInt(random, 0, available.length - 1)];
    target[destination].push(block);
  });
  return target;
}

export function generateSkyscraperPuzzle(seed: string, options: PuzzleOptions): SkyscraperPuzzle {
  const target = buildTarget(seed, options);
  const minimum = Math.max(1, options.minOptimalMoves ?? 1);
  let bestInitial = target;
  let bestPath: StackMove[] = [];

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const random = seededRandom(`${seed}:scramble:${attempt}`);
    let current = target.map((stack) => [...stack]);
    const visited = new Set([stateKey(current)]);
    let previous: StackMove | null = null;

    for (let step = 0; step < options.scrambleMoves + attempt; step += 1) {
      let choices = legalMoves(current, options.capacity).filter(
        (move) => !previous || move.from !== previous.to || move.to !== previous.from,
      );
      const unvisited = choices.filter((move) => {
        const next = moveBlock(current, move.from, move.to, options.capacity);
        return !visited.has(stateKey(next));
      });
      if (unvisited.length) choices = unvisited;
      if (!choices.length) choices = legalMoves(current, options.capacity);
      const move = choices[randomInt(random, 0, choices.length - 1)];
      current = moveBlock(current, move.from, move.to, options.capacity);
      visited.add(stateKey(current));
      previous = move;
    }

    const path = bfsOptimalMoves(current, target, options.capacity);
    if (path.length > bestPath.length) {
      bestInitial = current;
      bestPath = path;
    }
    if (path.length >= minimum) {
      return { initial: current, target, capacity: options.capacity, optimalPath: path };
    }
  }

  return { initial: bestInitial, target, capacity: options.capacity, optimalPath: bestPath };
}
