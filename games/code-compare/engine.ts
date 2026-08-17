import { randomInt, seededRandom, shuffle } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

const DIGITS = "0123456789";

export interface CodeTrial {
  reference: string;
  choices: string[];
  answer: number;
  mutationPositions: number[];
  mutationKinds: CodeMutationKind[];
}

export type CodeMutationKind = "single" | "adjacent-swap" | "double";

export interface CodeCompareLevelSettings {
  trials: number;
  codeLength: number;
  choiceCount: number;
  responseWindowMs: number;
  mutationKinds: readonly CodeMutationKind[];
}

export function codeCompareLevelSettings(level: GameLevel): CodeCompareLevelSettings {
  return {
    trials: levelValue(level, [6, 8, 10, 10, 10, 11, 11, 12, 12, 14]),
    codeLength: levelValue(level, [6, 8, 10, 10, 10, 11, 11, 12, 12, 14]),
    choiceCount: levelValue(level, [3, 4, 5, 5, 5, 5, 5, 5, 5, 6]),
    responseWindowMs: levelValue(level, [3000, 2400, 1800, 1725, 1650, 1575, 1500, 1400, 1300, 900]),
    mutationKinds: levelValue(level, [
      ["single"],
      ["single"],
      ["single"],
      ["single"],
      ["single"],
      ["single"],
      ["single", "adjacent-swap"],
      ["single", "adjacent-swap"],
      ["single", "adjacent-swap"],
      ["single", "adjacent-swap", "double"],
    ] as const),
  };
}

export function generateCode(random: () => number, length: number) {
  return Array.from(
    { length },
    () => DIGITS[randomInt(random, 0, DIGITS.length - 1)],
  ).join("");
}

export function mutateCode(random: () => number, code: string, position: number) {
  let replacement = code[position];
  while (replacement === code[position]) {
    replacement = DIGITS[randomInt(random, 0, DIGITS.length - 1)];
  }
  return `${code.slice(0, position)}${replacement}${code.slice(position + 1)}`;
}

function mutateWithKind(
  random: () => number,
  code: string,
  kind: CodeMutationKind,
) {
  if (kind === "single") {
    const position = randomInt(random, 0, code.length - 1);
    return { code: mutateCode(random, code, position), position };
  }
  if (kind === "adjacent-swap") {
    const candidates = Array.from({ length: code.length - 1 }, (_, index) => index)
      .filter((index) => code[index] !== code[index + 1]);
    if (!candidates.length) return mutateWithKind(random, code, "single");
    const position = candidates[randomInt(random, 0, candidates.length - 1)];
    return {
      code: `${code.slice(0, position)}${code[position + 1]}${code[position]}${code.slice(position + 2)}`,
      position,
    };
  }
  const first = randomInt(random, 0, code.length - 1);
  let second = first;
  while (second === first) second = randomInt(random, 0, code.length - 1);
  return {
    code: mutateCode(random, mutateCode(random, code, first), second),
    position: Math.min(first, second),
  };
}

export function generateCodeTrials(
  seed: string,
  count: number,
  length: number,
  choiceCount = 4,
  mutationKinds: readonly CodeMutationKind[] = ["single"],
): CodeTrial[] {
  const random = seededRandom(`${seed}:code-compare`);
  return Array.from({ length: count }, () => {
    const reference = generateCode(random, length);
    const distractors = new Set<string>();
    const positions: number[] = [];
    const kinds: CodeMutationKind[] = [];
    while (distractors.size < choiceCount - 1) {
      const kind = mutationKinds[randomInt(random, 0, mutationKinds.length - 1)];
      const mutation = mutateWithKind(random, reference, kind);
      if (!distractors.has(mutation.code)) {
        distractors.add(mutation.code);
        positions.push(mutation.position);
        kinds.push(kind);
      }
    }
    const choices = shuffle([reference, ...distractors], random);
    return {
      reference,
      choices,
      answer: choices.indexOf(reference),
      mutationPositions: positions,
      mutationKinds: kinds,
    };
  });
}

export function hasExactlyOneMatch(trial: CodeTrial) {
  return trial.choices.filter((choice) => choice === trial.reference).length === 1;
}
