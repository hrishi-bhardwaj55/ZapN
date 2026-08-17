import type { GameId, GameLevel } from "./types";

export const LEVELS: Array<{ id: GameLevel; name: string; summary: string }> = [
  { id: 1, name: "Foundation", summary: "Learn the core rule with generous timing and low complexity." },
  { id: 2, name: "Focused", summary: "Add more information while preserving a comfortable response window." },
  { id: 3, name: "Advanced", summary: "The reference-style balance of speed, accuracy, and complexity." },
  { id: 4, name: "Precision", summary: "A small step beyond reference load with tighter decisions." },
  { id: 5, name: "Accelerated", summary: "Quicker processing while the core task remains familiar." },
  { id: 6, name: "Intensive", summary: "Sustained mid-high load with fewer recovery moments." },
  { id: 7, name: "Pressure", summary: "Denser information and noticeably shorter response windows." },
  { id: 8, name: "Elite", summary: "Near-expert demands with little room for correction." },
  { id: 9, name: "Expert", summary: "The original expert profile with high density and strict timing." },
  { id: 10, name: "Extreme", summary: "Maximum supported load for deliberate overtraining." },
];

export const LEVEL_NOTES: Record<GameId, readonly string[]> = {
  balloon: [
    "8 balloons with wider, easier-to-learn burst ranges.",
    "10 balloons and greater overlap between color risk profiles.",
    "12 balloons with the reference mixed-risk profile.",
    "13 balloons with a slightly wider overlap between risk ranges.",
    "14 balloons with less separation between yellow and orange risk.",
    "14 balloons with broader blue uncertainty and sustained calibration demand.",
    "15 balloons with another step toward overlapping color profiles.",
    "15 balloons with near-expert uncertainty across all colors.",
    "16 balloons with broader uncertainty and less forgiving orange balloons.",
    "20 balloons with maximum distribution overlap and adaptation demand.",
  ],
  skyscraper: [
    "Three blocks and a short two-move planning path.",
    "Four blocks with a deeper target transformation.",
    "Five blocks across four towers and a four-move minimum.",
    "Five blocks with a deeper scramble and more tempting detours.",
    "Five blocks with a five-move planning floor.",
    "Six blocks introduce a larger state space at the same planning tier.",
    "Six blocks with a deeper scramble and wider branching.",
    "Six blocks with a six-move planning floor.",
    "Six blocks with longer optimal paths and more branching choices.",
    "Seven blocks, four towers, and the deepest supported search puzzle.",
  ],
  shapeshift: [
    "Slower trials with mostly congruent shape positions.",
    "Balanced left/right interference with a generous response window.",
    "Reference-level congruent and incongruent trial balance.",
    "Thirteen trials with a modest reduction in cue and response time.",
    "Fourteen trials with faster preparation and added interference.",
    "Fourteen trials with a tighter response window.",
    "Fifteen trials with sustained interference pressure.",
    "Fifteen near-expert trials with shorter preparation cues.",
    "Shorter preparation and response windows with more trials.",
    "Fastest window, shortest cues, and sustained interference pressure.",
  ],
  "code-compare": [
    "Six digits, three choices, and a generous comparison window.",
    "Eight digits and four closely matched choices.",
    "Ten digits with four one-position distractors.",
    "Ten digits and five choices with a slightly tighter window.",
    "Ten digits at accelerated comparison speed.",
    "Eleven digits with less time to eliminate distractors.",
    "Eleven digits with adjacent swaps added to the distractor mix.",
    "Twelve digits and mixed mutations at near-expert speed.",
    "Twelve digits, five choices, and mixed mutation types.",
    "Fourteen digits, six choices, and the shortest response window.",
  ],
  pincode: [
    "Four-digit sequences with a slower presentation cadence.",
    "Five-digit starting span across Repeat, Reverse, and Sort.",
    "Six-digit starting span with adaptive progression.",
    "Six-digit span with slightly faster flashes and recall pressure.",
    "Six-digit span with a shorter recall window.",
    "Six-digit start with progression up to nine digits.",
    "Seven-digit start with faster sequential presentation.",
    "Seven-digit span with a tighter minimum and recall window.",
    "Seven-digit span, faster flashes, and a shorter recall window.",
    "Eight-digit span with progression up to ten digits.",
  ],
  "number-box": [
    "Straightforward 24 puzzles with longer solve time.",
    "More varied operands and multi-step combinations.",
    "Reference-level four-number arithmetic search.",
    "Slightly rarer solutions with a modestly tighter solve window.",
    "Larger operands and fewer valid solution paths.",
    "Five rounds of low-solution-count arithmetic search.",
    "Two-digit operands begin appearing under tighter timing.",
    "Near-expert rarity with a reduced solve window.",
    "Rarer solutions with larger operands, required division, and tighter timing.",
    "Division-heavy and low-solution-count puzzles under maximum pressure.",
  ],
  "figure-it-out": [
    "A smaller candidate set and eight available guesses.",
    "More colors and shapes with seven guesses.",
    "The full reference candidate space and six guesses.",
    "Reference candidate space with stricter deduction expectations.",
    "Reference attributes with another calibrated deduction step.",
    "Expanded pattern choices while retaining six guesses.",
    "Expanded patterns with a five-guess budget.",
    "Near-expert deduction across the expanded candidate space.",
    "Expanded pattern choices with five guesses.",
    "The largest candidate space with only four guesses.",
  ],
  switch: [
    "Short arrow strings, slower responses, and fewer task switches.",
    "Longer prompts with a comfortable switch window.",
    "Balanced repeat/switch trials at reference speed.",
    "Reference-length prompts with a slightly higher switch rate.",
    "Faster balanced prompts with added switch pressure.",
    "An extra trial and shorter response window.",
    "Longer arrow strings with frequent switches.",
    "Near-expert switching density and timing.",
    "Long sequences, frequent switches, and a shorter window.",
    "Maximum sequence length and the fastest task-switching window.",
  ],
  "stock-master": [
    "Two gauges with wide target zones and separated events.",
    "Four gauges with moderate speed and wide zones.",
    "Four independently moving gauges at reference pressure.",
    "Four gauges with slightly narrower zones and faster needles.",
    "Five gauges introduce another divided-attention channel.",
    "Five gauges with tighter zones and overlapping arrivals.",
    "Five faster gauges with more direction reversals.",
    "Six gauges at near-expert timing density.",
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

export function levelValue<T>(level: GameLevel, values: readonly [T, T, T, T, T, T, T, T, T, T]) {
  return values[level - 1];
}
