import { randomInt, seededRandom, shuffle } from "@/lib/engine";

const DIGITS = "0123456789";

export interface CodeTrial {
  reference: string;
  choices: string[];
  answer: number;
  mutationPositions: number[];
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

export function generateCodeTrials(seed: string, count: number, length: number): CodeTrial[] {
  const random = seededRandom(`${seed}:code-compare`);
  return Array.from({ length: count }, () => {
    const reference = generateCode(random, length);
    const distractors = new Set<string>();
    const positions: number[] = [];
    while (distractors.size < 3) {
      const position = randomInt(random, 0, length - 1);
      const distractor = mutateCode(random, reference, position);
      if (!distractors.has(distractor)) {
        distractors.add(distractor);
        positions.push(position);
      }
    }
    const choices = shuffle([reference, ...distractors], random);
    return {
      reference,
      choices,
      answer: choices.indexOf(reference),
      mutationPositions: positions,
    };
  });
}

export function hasExactlyOneMatch(trial: CodeTrial) {
  return trial.choices.filter((choice) => choice === trial.reference).length === 1;
}
