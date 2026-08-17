import { randomInt, seededRandom } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

export const COLORS = ["navy", "teal", "amber", "coral"] as const;
export const FIGURES = ["circle", "triangle", "square", "diamond"] as const;
export const PATTERNS = ["solid", "striped", "outline", "dotted", "crossed"] as const;

export interface FigureGuess {
  color: (typeof COLORS)[number];
  figure: (typeof FIGURES)[number];
  pattern: (typeof PATTERNS)[number];
}

export function figureLevelSettings(level: GameLevel) {
  return {
    colors: COLORS.slice(0, levelValue(level, [2, 3, 4, 4, 4, 4, 4, 4, 4, 4])) as FigureGuess["color"][],
    figures: FIGURES.slice(0, levelValue(level, [3, 4, 4, 4, 4, 4, 4, 4, 4, 4])) as FigureGuess["figure"][],
    patterns: PATTERNS.slice(0, levelValue(level, [2, 2, 3, 3, 3, 4, 4, 4, 4, 5])) as FigureGuess["pattern"][],
    maxGuesses: levelValue(level, [8, 7, 6, 6, 6, 6, 5, 5, 5, 4]),
  };
}

export function allCandidates(level: GameLevel = 3): FigureGuess[] {
  const profile = figureLevelSettings(level);
  return profile.colors.flatMap((color) =>
    profile.figures.flatMap((figure) => profile.patterns.map((pattern) => ({ color, figure, pattern }))),
  );
}

export function generateTarget(seed: string, level: GameLevel = 3): FigureGuess {
  const random = seededRandom(`${seed}:figure-target`);
  const profile = figureLevelSettings(level);
  return {
    color: profile.colors[randomInt(random, 0, profile.colors.length - 1)],
    figure: profile.figures[randomInt(random, 0, profile.figures.length - 1)],
    pattern: profile.patterns[randomInt(random, 0, profile.patterns.length - 1)],
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
