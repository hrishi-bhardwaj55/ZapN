import { difficultyValue, randomInt, seededRandom } from "@/lib/engine";
import type { Difficulty } from "@/lib/types";

export interface BalloonTrial {
  color: "blue" | "yellow" | "orange";
  breakpoint: number;
}

const ranges = {
  easy: { blue: [8, 14], yellow: [5, 10], orange: [3, 7] },
  medium: { blue: [7, 16], yellow: [4, 11], orange: [2, 8] },
  hard: { blue: [6, 18], yellow: [3, 12], orange: [2, 9] },
} as const;

export function generateBalloons(
  seed: string,
  difficulty: Difficulty,
  count: number,
): BalloonTrial[] {
  const random = seededRandom(`${seed}:balloon`);
  const colors: BalloonTrial["color"][] = ["blue", "yellow", "orange"];
  const trialColors = Array.from({ length: count }, (_, index) => colors[index % colors.length]);
  for (let index = trialColors.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [trialColors[index], trialColors[swapIndex]] = [trialColors[swapIndex], trialColors[index]];
  }
  return trialColors.map((color) => {
    const [min, max] = ranges[difficulty][color];
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
