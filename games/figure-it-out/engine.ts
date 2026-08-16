import { randomInt, seededRandom } from "@/lib/engine";

export const COLORS = ["navy", "teal", "amber", "coral"] as const;
export const FIGURES = ["circle", "triangle", "square", "diamond"] as const;
export const COUNTS = [1, 2, 3] as const;

export interface FigureGuess {
  color: (typeof COLORS)[number];
  figure: (typeof FIGURES)[number];
  count: (typeof COUNTS)[number];
}

export function allCandidates(): FigureGuess[] {
  return COLORS.flatMap((color) =>
    FIGURES.flatMap((figure) => COUNTS.map((count) => ({ color, figure, count }))),
  );
}

export function generateTarget(seed: string): FigureGuess {
  const random = seededRandom(`${seed}:figure-target`);
  return {
    color: COLORS[randomInt(random, 0, COLORS.length - 1)],
    figure: FIGURES[randomInt(random, 0, FIGURES.length - 1)],
    count: COUNTS[randomInt(random, 0, COUNTS.length - 1)],
  };
}

export function figureFeedback(guess: FigureGuess, target: FigureGuess) {
  const exact = Number(guess.color === target.color) + Number(guess.figure === target.figure) + Number(guess.count === target.count);
  return { exact, different: 3 - exact };
}

export function reduceCandidates(candidates: FigureGuess[], guess: FigureGuess, exact: number) {
  return candidates.filter((candidate) => figureFeedback(guess, candidate).exact === exact);
}

export function sameGuess(left: FigureGuess, right: FigureGuess) {
  return left.color === right.color && left.figure === right.figure && left.count === right.count;
}
