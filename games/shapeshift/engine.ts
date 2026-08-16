import { randomInt, seededRandom, shuffle } from "@/lib/engine";

export const SHAPES = ["triangle", "circle", "square", "diamond"] as const;
export const DIRECTIONS = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"] as const;
export type Shape = (typeof SHAPES)[number];
export type Direction = (typeof DIRECTIONS)[number];

export function createMapping(seed: string): Record<Shape, Direction> {
  const random = seededRandom(`${seed}:shape-map`);
  const directions = shuffle([...DIRECTIONS], random);
  return Object.fromEntries(SHAPES.map((shape, index) => [shape, directions[index]])) as Record<Shape, Direction>;
}

export function generateShapeTrials(seed: string, count: number): Shape[] {
  const random = seededRandom(`${seed}:shape-trials`);
  const trials: Shape[] = [];
  while (trials.length < count) {
    const candidate = SHAPES[randomInt(random, 0, SHAPES.length - 1)];
    if (candidate !== trials[trials.length - 1]) trials.push(candidate);
  }
  return trials;
}

export function isAnticipatory(reactionTimeMs: number) {
  return reactionTimeMs < 120;
}
