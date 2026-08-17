import { difficultyValue, randomInt, seededRandom } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { Difficulty, GameLevel } from "@/lib/types";

export interface BalloonTrial {
  color: "blue" | "yellow" | "orange";
  breakpoint: number;
}

type RiskRange = readonly [number, number];
type RiskProfile = Record<BalloonTrial["color"], RiskRange>;

const LEVEL_RANGES: readonly RiskProfile[] = [
  { blue: [10, 15], yellow: [6, 9], orange: [3, 5] },
  { blue: [9, 16], yellow: [6, 12], orange: [3, 8] },
  { blue: [7, 16], yellow: [4, 11], orange: [2, 8] },
  { blue: [7, 17], yellow: [4, 12], orange: [2, 8] },
  { blue: [7, 17], yellow: [4, 13], orange: [2, 9] },
  { blue: [6, 17], yellow: [4, 13], orange: [2, 9] },
  { blue: [6, 17], yellow: [4, 14], orange: [2, 10] },
  { blue: [6, 18], yellow: [4, 14], orange: [2, 10] },
  { blue: [6, 18], yellow: [4, 15], orange: [2, 10] },
  { blue: [5, 18], yellow: [4, 17], orange: [2, 15] },
];

export function balloonCountForLevel(level: GameLevel) {
  return levelValue(level, [8, 10, 12, 13, 14, 14, 15, 15, 16, 20] as const);
}

export function balloonRiskProfile(level: GameLevel, difficulty: Difficulty): RiskProfile {
  const profile = LEVEL_RANGES[level - 1];
  const adjustment = difficultyValue(difficulty, {
    easy: { min: 1, max: -1 },
    medium: { min: 0, max: 0 },
    hard: { min: -1, max: 2 },
  });
  return Object.fromEntries(
    Object.entries(profile).map(([color, [min, max]]) => [
      color,
      [Math.max(2, min + adjustment.min), Math.max(3, max + adjustment.max)] as RiskRange,
    ]),
  ) as RiskProfile;
}

export function generateBalloons(
  seed: string,
  difficulty: Difficulty,
  count: number,
  level: GameLevel = 3,
): BalloonTrial[] {
  const random = seededRandom(`${seed}:balloon`);
  const ranges = balloonRiskProfile(level, difficulty);
  const colors: BalloonTrial["color"][] = ["blue", "yellow", "orange"];
  const trialColors = Array.from({ length: count }, (_, index) => colors[index % colors.length]);
  for (let index = trialColors.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [trialColors[index], trialColors[swapIndex]] = [trialColors[swapIndex], trialColors[index]];
  }
  return trialColors.map((color) => {
    const [min, max] = ranges[color];
    return { color, breakpoint: randomInt(random, min, max) };
  });
}

export function pumpBalloon(pumpCount: number, breakpoint: number) {
  const nextPump = pumpCount + 1;
  return { nextPump, exploded: nextPump === breakpoint };
}

export function balloonScale(pumps: number) {
  return Math.min(2.55, 1 + 0.2 * Math.sqrt(pumps));
}

export function cashOutValue(pumpCount: number, pumpReward = 1) {
  return pumpCount * pumpReward;
}

export function explosionPenalty(currentValue: number, multiplier = 0) {
  return currentValue * Math.max(0, multiplier);
}

export function balloonScore(adjustedAveragePumps: number, difficulty: Difficulty = "medium") {
  const upperBreakpoint = difficultyValue(difficulty, { easy: 14, medium: 16, hard: 18 });
  return Math.max(0, Math.min(100, (adjustedAveragePumps / upperBreakpoint) * 100));
}
