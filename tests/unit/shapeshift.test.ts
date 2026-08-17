import { describe, expect, it } from "vitest";
import {
  calculateSimonMetrics,
  generateShapeTrials,
  isAnticipatory,
  isCorrectShapeResponse,
  SHAPES,
  SHAPE_MAPPING,
  shapeLevelProfile,
} from "../../games/shapeshift/engine";

describe("Shapeshift engine", () => {
  it("uses only circle and square with a fixed left/right identity map", () => {
    expect(SHAPES).toEqual(["circle", "square"]);
    expect(SHAPE_MAPPING).toEqual({ circle: "ArrowLeft", square: "ArrowRight" });
  });

  it("generates deterministic, balanced congruent and incongruent trials", () => {
    const trials = generateShapeTrials("trial-seed", 40);
    expect(trials).toEqual(generateShapeTrials("trial-seed", 40));
    expect(trials.filter((trial) => trial.congruent)).toHaveLength(20);
    expect(trials.filter((trial) => !trial.congruent)).toHaveLength(20);
    expect(new Set(trials.map((trial) => trial.position))).toEqual(new Set(["left", "right"]));
    expect(trials.every((trial) => trial.correctDirection === SHAPE_MAPPING[trial.shape])).toBe(true);
  });

  it("rejects anticipatory responses", () => {
    const trial = generateShapeTrials("response", 1)[0];
    expect(isAnticipatory(119)).toBe(true);
    expect(isAnticipatory(120)).toBe(false);
    expect(isCorrectShapeResponse(trial, trial.correctDirection, 119)).toBe(false);
    expect(isCorrectShapeResponse(trial, trial.correctDirection, 250)).toBe(true);
  });

  it("reports condition medians and Simon interference", () => {
    const base = { response: "ArrowLeft", correct: true, score: 1 };
    const metrics = calculateSimonMetrics([
      { ...base, round: 1, stimulus: "congruent:circle:left", reactionTimeMs: 300 },
      { ...base, round: 2, stimulus: "congruent:square:right", reactionTimeMs: 400 },
      { ...base, round: 3, stimulus: "incongruent:circle:right", reactionTimeMs: 500 },
      { ...base, round: 4, stimulus: "incongruent:square:left", reactionTimeMs: 600 },
    ]);
    expect(metrics.congruentMedianRtMs).toBe(350);
    expect(metrics.incongruentMedianRtMs).toBe(550);
    expect(metrics.simonInterferenceMs).toBe(200);
  });

  it("makes level 10 longer, faster, and more interference-heavy than level 1", () => {
    const foundationProfile = shapeLevelProfile(1);
    const extremeProfile = shapeLevelProfile(10);
    const foundation = generateShapeTrials("level-shapes", foundationProfile.trials, 1);
    const extreme = generateShapeTrials("level-shapes", extremeProfile.trials, 10);
    const interferenceRate = (trials: ReturnType<typeof generateShapeTrials>) =>
      trials.filter((trial) => !trial.congruent).length / trials.length;

    expect(extreme.length).toBeGreaterThan(foundation.length);
    expect(extremeProfile.responseWindowMs).toBeLessThan(foundationProfile.responseWindowMs);
    expect(Math.max(...extreme.map((trial) => trial.preStimulusMs))).toBeLessThan(
      Math.min(...foundation.map((trial) => trial.preStimulusMs)),
    );
    expect(interferenceRate(extreme)).toBeGreaterThan(interferenceRate(foundation));
  });
});
