import type { GameId, GameLevel } from "./types";

export const LEVELS: Array<{ id: GameLevel; name: string; summary: string }> = [
  { id: 1, name: "Foundation", summary: "Learn the core rule with generous timing and low complexity." },
  { id: 2, name: "Focused", summary: "Add more information while preserving a comfortable response window." },
  { id: 3, name: "Advanced", summary: "The reference-style balance of speed, accuracy, and complexity." },
  { id: 4, name: "Expert", summary: "Denser stimuli, shorter windows, and less room for correction." },
  { id: 5, name: "Extreme", summary: "Maximum supported load for deliberate overtraining." },
];

export const LEVEL_NOTES: Record<GameId, readonly string[]> = {
  balloon: [
    "8 balloons with wider, easier-to-learn burst ranges.",
    "10 balloons and greater overlap between color risk profiles.",
    "12 balloons with the reference mixed-risk profile.",
    "16 balloons with broader uncertainty and less forgiving orange balloons.",
    "20 balloons with maximum distribution overlap and adaptation demand.",
  ],
  skyscraper: [
    "Three blocks and a short two-move planning path.",
    "Four blocks with a deeper target transformation.",
    "Five blocks across four towers and a four-move minimum.",
    "Six blocks with longer optimal paths and more branching choices.",
    "Seven blocks, four towers, and the deepest supported search puzzle.",
  ],
  shapeshift: [
    "Slower trials with mostly congruent shape positions.",
    "Balanced left/right interference with a generous response window.",
    "Reference-level congruent and incongruent trial balance.",
    "Shorter preparation and response windows with more trials.",
    "Fastest window, shortest cues, and sustained interference pressure.",
  ],
  "code-compare": [
    "Six digits, three choices, and a generous comparison window.",
    "Eight digits and four closely matched choices.",
    "Ten digits with four one-position distractors.",
    "Twelve digits, five choices, and mixed mutation types.",
    "Fourteen digits, six choices, and the shortest response window.",
  ],
  pincode: [
    "Four-digit sequences with a slower presentation cadence.",
    "Five-digit starting span across Repeat, Reverse, and Sort.",
    "Six-digit starting span with adaptive progression.",
    "Seven-digit span, faster flashes, and a shorter recall window.",
    "Eight-digit span with progression up to ten digits.",
  ],
  "number-box": [
    "Straightforward 24 puzzles with longer solve time.",
    "More varied operands and multi-step combinations.",
    "Reference-level four-number arithmetic search.",
    "Rarer solutions with larger operands and tighter timing.",
    "Division-heavy and low-solution-count puzzles under maximum pressure.",
  ],
  "figure-it-out": [
    "A smaller candidate set and eight available guesses.",
    "More colors and shapes with seven guesses.",
    "The full reference candidate space and six guesses.",
    "Expanded pattern choices with five guesses.",
    "The largest candidate space with only four guesses.",
  ],
  switch: [
    "Short arrow strings, slower responses, and fewer task switches.",
    "Longer prompts with a comfortable switch window.",
    "Balanced repeat/switch trials at reference speed.",
    "Long sequences, frequent switches, and a shorter window.",
    "Maximum sequence length and the fastest task-switching window.",
  ],
  "stock-master": [
    "Two gauges with wide target zones and separated events.",
    "Four gauges with moderate speed and wide zones.",
    "Four independently moving gauges at reference pressure.",
    "Six faster gauges with narrower target zones.",
    "Nine gauges, narrow zones, reversals, and overlapping target events.",
  ],
};

export function levelDefinition(level: GameLevel) {
  return LEVELS[level - 1];
}

export function levelNote(gameId: GameId, level: GameLevel) {
  return LEVEL_NOTES[gameId][level - 1];
}

export function levelValue<T>(level: GameLevel, values: readonly [T, T, T, T, T]) {
  return values[level - 1];
}
