import { mean, randomInt, seededRandom } from "@/lib/engine";
import type { RoundRecord } from "@/lib/types";

export type SwitchTask = "NUMBER" | "ARROWS";
export interface SwitchTrial {
  task: SwitchTask;
  previousTask: SwitchTask | null;
  switched: boolean;
  arithmetic: { left: number; right: number; result: number; question: string; answer: boolean };
  arrows: { top: string[]; bottom: string[]; answer: boolean };
  answer: boolean;
}

const arrowSet = ["↑", "←", "↓", "→"];

export function parityAnswer(left: number, right: number, asksOdd = true) {
  const odd = (left + right) % 2 !== 0;
  return asksOdd ? odd : !odd;
}

export function arrowsMatch(top: string[], bottom: string[]) {
  return top.length === bottom.length && top.every((arrow, index) => arrow === bottom[index]);
}

export function generateSwitchTrials(seed: string, count: number, sequenceLength = 4): SwitchTrial[] {
  const random = seededRandom(`${seed}:switch`);
  const trials: SwitchTrial[] = [];
  let previous: SwitchTask | null = null;
  for (let index = 0; index < count; index += 1) {
    const task: SwitchTask = previous === null ? (random() > 0.5 ? "NUMBER" : "ARROWS") : random() < 0.5 ? previous : previous === "NUMBER" ? "ARROWS" : "NUMBER";
    const left = randomInt(random, 6, 24);
    const right = randomInt(random, 2, 16);
    const asksOdd = random() > 0.5;
    const top = Array.from({ length: sequenceLength }, () => arrowSet[randomInt(random, 0, 3)]);
    const bottom = [...top];
    const shouldMatch = random() > 0.5;
    if (!shouldMatch) {
      const position = randomInt(random, 0, sequenceLength - 1);
      const current = bottom[position];
      do bottom[position] = arrowSet[randomInt(random, 0, 3)]; while (bottom[position] === current);
    }
    const arithmetic = { left, right, result: left + right, question: asksOdd ? "IS THE RESULT ODD?" : "IS THE RESULT EVEN?", answer: parityAnswer(left, right, asksOdd) };
    const arrows = { top, bottom, answer: arrowsMatch(top, bottom) };
    trials.push({ task, previousTask: previous, switched: previous !== null && previous !== task, arithmetic, arrows, answer: task === "NUMBER" ? arithmetic.answer : arrows.answer });
    previous = task;
  }
  return trials;
}

export function calculateSwitchCost(records: RoundRecord[]) {
  const switchRecords = records.filter((record) => record.stimulus.startsWith("switch:"));
  const repeatRecords = records.filter((record) => record.stimulus.startsWith("repeat:"));
  const switchRt = mean(switchRecords.map((record) => record.reactionTimeMs));
  const repeatRt = mean(repeatRecords.map((record) => record.reactionTimeMs));
  return { switchRt, repeatRt, switchCost: switchRt - repeatRt };
}
