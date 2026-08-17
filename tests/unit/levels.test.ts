import { describe, expect, it } from "vitest";
import { balloonCountForLevel } from "../../games/balloon/engine";
import { codeCompareLevelSettings } from "../../games/code-compare/engine";
import { allCandidates, figureLevelSettings } from "../../games/figure-it-out/engine";
import { numberBoxLevelSettings } from "../../games/number-box/engine";
import { digitLevelSettings } from "../../games/pincode/engine";
import { shapeLevelProfile } from "../../games/shapeshift/engine";
import { skyscraperOptionsForLevel } from "../../games/skyscraper/engine";
import { stockLevelSettings } from "../../games/stock-master/engine";
import { switchLevelSettings } from "../../games/switch/engine";
import { LEVELS, levelDefinition, levelNote } from "../../lib/levels";
import type { GameId } from "../../lib/types";

const levels = LEVELS.map(({ id }) => id);
const middleLevels = levels.filter((level) => level >= 4 && level <= 8);
const games: GameId[] = [
  "balloon",
  "skyscraper",
  "shapeshift",
  "code-compare",
  "pincode",
  "number-box",
  "figure-it-out",
  "switch",
  "stock-master",
];

function expectNonDecreasing(values: number[]) {
  values.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(values[index]));
}

function expectNonIncreasing(values: number[]) {
  values.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(values[index]));
}

describe("ten-level progression", () => {
  it("defines ten named levels and a game-specific note for every level", () => {
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(levelDefinition(10).name).toBe("Extreme");
    games.forEach((gameId) => {
      expect(levels.map((level) => levelNote(gameId, level))).toHaveLength(10);
      expect(levels.every((level) => levelNote(gameId, level).length > 20)).toBe(true);
    });
  });

  it("places all five new levels between the old Advanced and Expert bounds", () => {
    middleLevels.forEach((level) => {
      expect(level).toBeGreaterThan(3);
      expect(level).toBeLessThan(9);
    });

    expectNonDecreasing(levels.map(balloonCountForLevel));
    expectNonDecreasing(levels.map((level) => skyscraperOptionsForLevel(level).pieceCount));
    expectNonDecreasing(levels.map((level) => skyscraperOptionsForLevel(level).minOptimalMoves ?? 0));
    expectNonDecreasing(levels.map((level) => shapeLevelProfile(level).trials));
    expectNonIncreasing(levels.map((level) => shapeLevelProfile(level).responseWindowMs));
    expectNonDecreasing(levels.map((level) => codeCompareLevelSettings(level).codeLength));
    expectNonDecreasing(levels.map((level) => codeCompareLevelSettings(level).trials));
    expectNonIncreasing(levels.map((level) => codeCompareLevelSettings(level).responseWindowMs));
    expectNonDecreasing(levels.map((level) => digitLevelSettings(level).initialSpan));
    expectNonIncreasing(levels.map((level) => digitLevelSettings(level).interDigitDelayMs));
    expectNonDecreasing(levels.map((level) => numberBoxLevelSettings(level).maximumOperand));
    expectNonIncreasing(levels.map((level) => numberBoxLevelSettings(level).responseWindowMs));
    expectNonDecreasing(levels.map((level) => allCandidates(level).length));
    expectNonIncreasing(levels.map((level) => figureLevelSettings(level).maxGuesses));
    expectNonDecreasing(levels.map((level) => switchLevelSettings(level).switchRate));
    expectNonIncreasing(levels.map((level) => switchLevelSettings(level).responseWindowMs));
    expectNonDecreasing(levels.map((level) => stockLevelSettings(level).gaugeCount));
    expectNonIncreasing(levels.map((level) => stockLevelSettings(level).targetWidth));
  });

  it("keeps L3 unchanged and maps the former Expert/Extreme profiles to L9/L10", () => {
    expect(shapeLevelProfile(3)).toMatchObject({ trials: 12, responseWindowMs: 1400, incongruentRatio: 0.5 });
    expect(codeCompareLevelSettings(9)).toMatchObject({ codeLength: 12, choiceCount: 5, responseWindowMs: 1300 });
    expect(digitLevelSettings(9)).toMatchObject({ initialSpan: 7, maximumSpan: 9, interDigitDelayMs: 520 });
    expect(numberBoxLevelSettings(9)).toMatchObject({ maximumOperand: 12, responseWindowMs: 45000, trials: 5 });
    expect(figureLevelSettings(10)).toMatchObject({ maxGuesses: 4 });
    expect(allCandidates(10)).toHaveLength(80);
    expect(stockLevelSettings(10)).toMatchObject({ gaugeCount: 9, targetWidth: 24 });
  });
});
