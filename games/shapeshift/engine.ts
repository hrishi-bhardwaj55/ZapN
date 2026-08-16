import { median, randomInt, seededRandom, shuffle } from "@/lib/engine";
import type { RoundRecord } from "@/lib/types";

export const SHAPES = ["circle", "square"] as const;
export const DIRECTIONS = ["ArrowLeft", "ArrowRight"] as const;
export const SHAPE_MAPPING = {
  circle: "ArrowLeft",
  square: "ArrowRight",
} as const;

export type ShapeName = (typeof SHAPES)[number];
export type ShapeDirection = (typeof DIRECTIONS)[number];
export type ShapePosition = "left" | "right";

export interface ShapeTrial {
  shape: ShapeName;
  position: ShapePosition;
  correctDirection: ShapeDirection;
  congruent: boolean;
  preStimulusMs: number;
}

const CONDITIONS: Array<Omit<ShapeTrial, "preStimulusMs">> = [
  { shape: "circle", position: "left", correctDirection: "ArrowLeft", congruent: true },
  { shape: "circle", position: "right", correctDirection: "ArrowLeft", congruent: false },
  { shape: "square", position: "left", correctDirection: "ArrowRight", congruent: false },
  { shape: "square", position: "right", correctDirection: "ArrowRight", congruent: true },
];

export function generateShapeTrials(seed: string, count: number): ShapeTrial[] {
  const random = seededRandom(seed);
  const conditions = Array.from({ length: count }, (_, index) => CONDITIONS[index % CONDITIONS.length]);
  return shuffle(conditions, random).map((condition) => ({
    ...condition,
    preStimulusMs: randomInt(random, 250, 700),
  }));
}

export function isAnticipatory(reactionTimeMs: number) {
  return reactionTimeMs < 120;
}

export function isCorrectShapeResponse(trial: ShapeTrial, response: string, reactionTimeMs: number) {
  return response === trial.correctDirection && !isAnticipatory(reactionTimeMs);
}

export function calculateSimonMetrics(rounds: RoundRecord[]) {
  const condition = (name: "congruent" | "incongruent") => rounds.filter((round) => round.stimulus.startsWith(`${name}:`));
  const congruent = condition("congruent");
  const incongruent = condition("incongruent");
  const correctTimes = (items: RoundRecord[]) =>
    items.filter((item) => item.correct && item.response !== "timeout").map((item) => item.reactionTimeMs);
  const congruentMedianRtMs = median(correctTimes(congruent));
  const incongruentMedianRtMs = median(correctTimes(incongruent));
  return {
    congruentMedianRtMs,
    incongruentMedianRtMs,
    simonInterferenceMs: incongruentMedianRtMs - congruentMedianRtMs,
    congruentAccuracy: congruent.length ? (congruent.filter((item) => item.correct).length / congruent.length) * 100 : 0,
    incongruentAccuracy: incongruent.length ? (incongruent.filter((item) => item.correct).length / incongruent.length) * 100 : 0,
  };
}
