import { median, randomInt, seededRandom, shuffle } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel, RoundRecord } from "@/lib/types";

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

export interface ShapeLevelProfile {
  trials: number;
  responseWindowMs: number;
  preparationRangeMs: readonly [number, number];
  incongruentRatio: number;
}

export function shapeLevelProfile(level: GameLevel): ShapeLevelProfile {
  return levelValue(level, [
    { trials: 8, responseWindowMs: 2200, preparationRangeMs: [900, 1400], incongruentRatio: 0.25 },
    { trials: 10, responseWindowMs: 1800, preparationRangeMs: [700, 1100], incongruentRatio: 0.4 },
    { trials: 12, responseWindowMs: 1400, preparationRangeMs: [550, 1000], incongruentRatio: 0.5 },
    { trials: 16, responseWindowMs: 1000, preparationRangeMs: [350, 700], incongruentRatio: 0.625 },
    { trials: 20, responseWindowMs: 700, preparationRangeMs: [180, 450], incongruentRatio: 0.75 },
  ] as const);
}

export function generateShapeTrials(seed: string, count: number, level: GameLevel = 3): ShapeTrial[] {
  const random = seededRandom(seed);
  const profile = shapeLevelProfile(level);
  const incongruentCount = Math.min(count, Math.round(count * profile.incongruentRatio));
  const congruentCount = count - incongruentCount;
  const congruentConditions = CONDITIONS.filter((condition) => condition.congruent);
  const incongruentConditions = CONDITIONS.filter((condition) => !condition.congruent);
  const conditions = [
    ...Array.from({ length: congruentCount }, (_, index) => congruentConditions[index % congruentConditions.length]),
    ...Array.from({ length: incongruentCount }, (_, index) => incongruentConditions[index % incongruentConditions.length]),
  ];
  return shuffle(conditions, random).map((condition) => ({
    ...condition,
    preStimulusMs: randomInt(random, profile.preparationRangeMs[0], profile.preparationRangeMs[1]),
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
