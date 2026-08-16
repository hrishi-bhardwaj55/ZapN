import { mean, randomInt, seededRandom, shuffle } from "@/lib/engine";
import type { RoundRecord } from "@/lib/types";

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

export function generateSwitchTrials(seed: string, count: number, sequenceLength = 4): SwitchTrial[] {
  const random = seededRandom(`${seed}:switch-position`);
  const positions = shuffle(
    Array.from({ length: count }, (_, index) => (index % 2 === 0 ? "top" : "bottom") as SwitchPosition),
    random,
  );
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
