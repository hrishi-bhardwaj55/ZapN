import { randomInt, seededRandom } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

export type MemoryTask = "forward" | "reverse" | "sort";

export const MEMORY_TASKS: MemoryTask[] = ["forward", "reverse", "sort"];

export interface DigitLevelSettings {
  initialSpan: number;
  minimumSpan: number;
  maximumSpan: number;
  interDigitDelayMs: number;
  recallWindowMs: number;
  trials: number;
}

export function digitLevelSettings(level: GameLevel): DigitLevelSettings {
  return {
    initialSpan: levelValue(level, [4, 5, 6, 7, 8]),
    minimumSpan: levelValue(level, [4, 4, 5, 6, 7]),
    maximumSpan: levelValue(level, [6, 7, 8, 9, 10]),
    interDigitDelayMs: levelValue(level, [900, 780, 650, 520, 400]),
    recallWindowMs: levelValue(level, [14000, 12000, 10000, 8000, 6500]),
    trials: levelValue(level, [3, 6, 6, 9, 9]),
  };
}

export function generateDigits(seed: string, round: number, length: number) {
  const random = seededRandom(`${seed}:pincode:${round}`);
  return Array.from({ length }, () => randomInt(random, 0, 9));
}

export function transformDigits(digits: number[], task: MemoryTask) {
  if (task === "reverse") return [...digits].reverse();
  if (task === "sort") return [...digits].sort((left, right) => left - right);
  return [...digits];
}

export function taskForRound(round: number, total: number): MemoryTask {
  const safeTotal = Math.max(MEMORY_TASKS.length, total);
  const baseBlockSize = Math.floor(safeTotal / MEMORY_TASKS.length);
  const remainder = safeTotal % MEMORY_TASKS.length;
  const blockSizes = MEMORY_TASKS.map((_, index) => baseBlockSize + Number(index < remainder));
  let upperBound = 0;
  for (let index = 0; index < MEMORY_TASKS.length; index += 1) {
    upperBound += blockSizes[index];
    if (round < upperBound) return MEMORY_TASKS[index];
  }
  return "sort";
}

export function nextAdaptiveSpan(span: number, correct: boolean, minimum = 4, maximum = 8) {
  return correct ? Math.min(maximum, span + 1) : Math.max(minimum, span - 1);
}
