import { mean, randomInt, seededRandom, shuffle } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel, RoundRecord } from "@/lib/types";

export type SwitchTask = "NUMBER" | "ARROWS";
export type SwitchPosition = "top" | "bottom";

export interface SwitchTrial {
  task: SwitchTask;
  position: SwitchPosition;
  previousTask: SwitchTask | null;
  switched: boolean;
  arithmetic: { left: number; right: number; result: number; asksOdd: boolean; answer: boolean };
  arrows: { top: string[]; bottom: string[]; answer: boolean };
  answer: boolean;
}

const arrowSet = ["↑", "←", "↓", "→"];

export function taskForPosition(position: SwitchPosition): SwitchTask {
  return position === "top" ? "NUMBER" : "ARROWS";
}

export function parityAnswer(left: number, right: number, asksOdd = true) {
  const odd = (left + right) % 2 !== 0;
  return asksOdd ? odd : !odd;
}

export function arrowsMatch(top: string[], bottom: string[]) {
  return top.length === bottom.length && top.every((arrow, index) => arrow === bottom[index]);
}

export function switchLevelSettings(level: GameLevel) {
  return {
    total: levelValue(level, [10, 12, 14, 16, 18]),
    sequenceLength: levelValue(level, [3, 4, 5, 6, 7]),
    switchRate: levelValue(level, [0.25, 0.4, 0.5, 0.7, 0.85]),
    responseWindowMs: levelValue(level, [3000, 2500, 2000, 1550, 1150]),
  };
}

function distributeAcrossRuns(total: number, runs: number, random: () => number) {
  const lengths = Array.from({ length: runs }, () => 1);
  for (let remaining = total - runs; remaining > 0; remaining -= 1) {
    lengths[randomInt(random, 0, runs - 1)] += 1;
  }
  return shuffle(lengths, random);
}

function balancedPositions(count: number, switchRate: number, random: () => number): SwitchPosition[] {
  if (count <= 1) return ["top"].slice(0, count) as SwitchPosition[];
  const topCount = Math.ceil(count / 2);
  const bottomCount = Math.floor(count / 2);
  const requestedSwitches = Math.max(1, Math.min(count - 1, Math.round((count - 1) * switchRate)));

  for (let distance = 0; distance < count; distance += 1) {
    for (const switches of [requestedSwitches - distance, requestedSwitches + distance]) {
      if (switches < 1 || switches >= count) continue;
      const runCount = switches + 1;
      const starts = shuffle(["top", "bottom"] as SwitchPosition[], random);
      for (const start of starts) {
        const topRuns = start === "top" ? Math.ceil(runCount / 2) : Math.floor(runCount / 2);
        const bottomRuns = runCount - topRuns;
        if (topRuns > topCount || bottomRuns > bottomCount) continue;
        const topLengths = distributeAcrossRuns(topCount, topRuns, random);
        const bottomLengths = distributeAcrossRuns(bottomCount, bottomRuns, random);
        const positions: SwitchPosition[] = [];
        let topIndex = 0;
        let bottomIndex = 0;
        for (let run = 0; run < runCount; run += 1) {
          const position = run % 2 === 0 ? start : start === "top" ? "bottom" : "top";
          const length = position === "top" ? topLengths[topIndex++] : bottomLengths[bottomIndex++];
          positions.push(...Array.from({ length }, () => position));
        }
        return positions;
      }
    }
  }
  return shuffle(Array.from({ length: count }, (_, index) => (index < topCount ? "top" : "bottom") as SwitchPosition), random);
}

export function generateSwitchTrials(seed: string, count: number, sequenceLength = 4, switchRate = 0.5): SwitchTrial[] {
  const random = seededRandom(`${seed}:switch-position`);
  const positions = balancedPositions(count, switchRate, random);
  const trials: SwitchTrial[] = [];
  let previousTask: SwitchTask | null = null;

  positions.forEach((position) => {
    const task = taskForPosition(position);
    const left = randomInt(random, 6, 24);
    const right = randomInt(random, 2, 16);
    const asksOdd = random() > 0.5;
    const numberAnswer = parityAnswer(left, right, asksOdd);
    const top = Array.from({ length: sequenceLength }, () => arrowSet[randomInt(random, 0, 3)]);
    const bottom = [...top];
    const shouldMatch = random() > 0.5;
    if (!shouldMatch) {
      const mutationIndex = randomInt(random, 0, sequenceLength - 1);
      const original = bottom[mutationIndex];
      do bottom[mutationIndex] = arrowSet[randomInt(random, 0, 3)]; while (bottom[mutationIndex] === original);
    }
    const arrows = { top, bottom, answer: arrowsMatch(top, bottom) };
    const arithmetic = { left, right, result: left + right, asksOdd, answer: numberAnswer };
    trials.push({
      task,
      position,
      previousTask,
      switched: previousTask !== null && previousTask !== task,
      arithmetic,
      arrows,
      answer: task === "NUMBER" ? arithmetic.answer : arrows.answer,
    });
    previousTask = task;
  });
  return trials;
}

export function calculateSwitchCost(records: RoundRecord[]) {
  const switchRecords = records.filter((record) => record.stimulus.startsWith("switch:"));
  const repeatRecords = records.filter((record) => record.stimulus.startsWith("repeat:"));
  const switchRt = mean(switchRecords.map((record) => record.reactionTimeMs));
  const repeatRt = mean(repeatRecords.map((record) => record.reactionTimeMs));
  return { switchRt, repeatRt, switchCost: switchRt - repeatRt };
}
