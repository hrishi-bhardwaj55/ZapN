import { randomInt, seededRandom } from "@/lib/engine";

export const COLORS = ["navy", "teal", "amber", "coral"] as const;
export const FIGURES = ["circle", "triangle", "square", "diamond"] as const;
export const PATTERNS = ["solid", "striped", "outline"] as const;

export interface FigureGuess {
  color: (typeof COLORS)[number];
  figure: (typeof FIGURES)[number];
  pattern: (typeof PATTERNS)[number];
}

export function allCandidates(): FigureGuess[] {
  return COLORS.flatMap((color) =>
    FIGURES.flatMap((figure) => PATTERNS.map((pattern) => ({ color, figure, pattern }))),
  );
}

export function generateTarget(seed: string): FigureGuess {
  const random = seededRandom(`${seed}:figure-target`);
  return {
    color: COLORS[randomInt(random, 0, COLORS.length - 1)],
    figure: FIGURES[randomInt(random, 0, FIGURES.length - 1)],
    pattern: PATTERNS[randomInt(random, 0, PATTERNS.length - 1)],
  };
}

export function figureFeedback(guess: FigureGuess, target: FigureGuess) {
  const right = Number(guess.color === target.color) + Number(guess.figure === target.figure) + Number(guess.pattern === target.pattern);
  return { right, wrong: 3 - right };
}

export function reduceCandidates(candidates: FigureGuess[], guess: FigureGuess, right: number) {
  return candidates.filter((candidate) => figureFeedback(guess, candidate).right === right);
}

export function sameGuess(left: FigureGuess, right: FigureGuess) {
  return left.color === right.color && left.figure === right.figure && left.pattern === right.pattern;
}
