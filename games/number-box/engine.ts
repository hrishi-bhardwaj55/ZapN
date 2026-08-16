import { randomInt, seededRandom } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

type Token = { type: "number" | "op" | "left" | "right"; value: string };

export interface NumberPuzzle {
  numbers: number[];
  target: number;
  solution: string;
  requiredOperators: NumberOperator[];
  solutionCount: number;
}

export type NumberOperator = "+" | "-" | "*" | "/";

export interface NumberBoxLevelSettings {
  minimumOperand: number;
  maximumOperand: number;
  responseWindowMs: number;
  minimumSolutionCount: number;
  maximumSolutionCount: number;
  requiredOperators: readonly NumberOperator[];
  trials: number;
}

export function numberBoxLevelSettings(level: GameLevel): NumberBoxLevelSettings {
  return {
    minimumOperand: levelValue(level, [1, 1, 1, 2, 2]),
    maximumOperand: levelValue(level, [6, 8, 9, 12, 13]),
    responseWindowMs: levelValue(level, [120000, 90000, 60000, 45000, 30000]),
    minimumSolutionCount: levelValue(level, [8, 4, 1, 1, 1]),
    maximumSolutionCount: levelValue(level, [120, 80, 50, 20, 8]),
    requiredOperators: levelValue(level, [[], [], [], ["/"], ["/", "-"]] as const),
    trials: levelValue(level, [2, 3, 4, 5, 6]),
  };
}

export interface WorkingValue {
  id: string;
  value: number;
  expression: string;
  sourceIndexes: number[];
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/\d|\./.test(character)) {
      let value = "";
      while (index < expression.length && /\d|\./.test(expression[index])) value += expression[index++];
      if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid number");
      tokens.push({ type: "number", value });
      continue;
    }
    if (["+", "-", "*", "/", "×", "÷"].includes(character)) {
      tokens.push({ type: "op", value: character === "×" ? "*" : character === "÷" ? "/" : character });
      index += 1;
      continue;
    }
    if (character === "(") tokens.push({ type: "left", value: character });
    else if (character === ")") tokens.push({ type: "right", value: character });
    else throw new Error("Unsupported character");
    index += 1;
  }
  return tokens;
}

export function parseExpression(expression: string) {
  const tokens = tokenize(expression);
  let index = 0;
  const parsePrimary = (): number => {
    const token = tokens[index];
    if (!token) throw new Error("Unexpected end");
    if (token.type === "number") {
      index += 1;
      return Number(token.value);
    }
    if (token.type === "left") {
      index += 1;
      const value = parseAdditive();
      if (tokens[index]?.type !== "right") throw new Error("Missing parenthesis");
      index += 1;
      return value;
    }
    throw new Error("Expected number");
  };
  const parseMultiplicative = (): number => {
    let value = parsePrimary();
    while (tokens[index]?.type === "op" && ["*", "/"].includes(tokens[index].value)) {
      const operator = tokens[index++].value;
      const right = parsePrimary();
      if (operator === "/" && right === 0) throw new Error("Division by zero");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseAdditive = (): number => {
    let value = parseMultiplicative();
    while (tokens[index]?.type === "op" && ["+", "-"].includes(tokens[index].value)) {
      const operator = tokens[index++].value;
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = parseAdditive();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid expression");
  return result;
}

export function numbersUsed(expression: string) {
  return (expression.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export function usesEachNumberOnce(expression: string, supplied: number[]) {
  const used = numbersUsed(expression).sort((left, right) => left - right);
  const expected = [...supplied].sort((left, right) => left - right);
  return used.length === expected.length && used.every((value, index) => value === expected[index]);
}

export function validateSolution(expression: string, puzzle: NumberPuzzle) {
  try {
    const value = parseExpression(expression);
    if (!usesEachNumberOnce(expression, puzzle.numbers)) return { valid: false, reason: "Use every supplied number exactly once." };
    if (Math.abs(value - puzzle.target) > 1e-8) return { valid: false, reason: `That equals ${Number(value.toFixed(3))}, not ${puzzle.target}.` };
    if (!meetsOperatorRequirements(expression, puzzle.requiredOperators ?? [])) {
      return { valid: false, reason: `Use the required operator${puzzle.requiredOperators.length === 1 ? "" : "s"}: ${puzzle.requiredOperators.join(" ")}.` };
    }
    return { valid: true, value };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "Invalid expression" };
  }
}

export function operatorsUsed(expression: string): NumberOperator[] {
  return [...new Set(expression.match(/[+\-*/]/g) ?? [])] as NumberOperator[];
}

export function meetsOperatorRequirements(
  expression: string,
  requiredOperators: readonly NumberOperator[],
) {
  const used = new Set(operatorsUsed(expression));
  return requiredOperators.every((operator) => used.has(operator));
}

export function applyOperation(left: number, operator: NumberOperator, right: number) {
  if (operator === "/" && Math.abs(right) < 1e-10) throw new Error("Division by zero");
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  return left / right;
}

export function initialWorkingValues(numbers: number[]): WorkingValue[] {
  return numbers.map((value, index) => ({ id: `number-${index}`, value, expression: String(value), sourceIndexes: [index] }));
}

export function combineWorkingValues(
  values: WorkingValue[],
  leftId: string,
  operator: NumberOperator,
  rightId: string,
  resultId: string,
) {
  if (leftId === rightId) throw new Error("Choose two different values");
  const leftIndex = values.findIndex((item) => item.id === leftId);
  const rightIndex = values.findIndex((item) => item.id === rightId);
  if (leftIndex < 0 || rightIndex < 0) throw new Error("That value is no longer available");
  const left = values[leftIndex];
  const right = values[rightIndex];
  if (left.sourceIndexes.some((index) => right.sourceIndexes.includes(index))) throw new Error("A supplied number cannot be reused");
  const result: WorkingValue = {
    id: resultId,
    value: applyOperation(left.value, operator, right.value),
    expression: `(${left.expression}${operator}${right.expression})`,
    sourceIndexes: [...left.sourceIndexes, ...right.sourceIndexes].sort((a, b) => a - b),
  };
  const insertAt = Math.min(leftIndex, rightIndex);
  const next = values.filter((_, index) => index !== leftIndex && index !== rightIndex);
  next.splice(insertAt, 0, result);
  return next;
}

interface SolvableValue {
  value: number;
  expression: string;
  operators: Set<NumberOperator>;
}

function findSolutionsTo24(
  numbers: number[],
  requiredOperators: readonly NumberOperator[] = [],
  limit = Number.MAX_SAFE_INTEGER,
) {
  const solutions = new Set<string>();
  const search = (values: SolvableValue[]) => {
    if (solutions.size >= limit) return;
    if (values.length === 1) {
      if (
        Math.abs(values[0].value - 24) < 1e-8
        && requiredOperators.every((operator) => values[0].operators.has(operator))
      ) solutions.add(values[0].expression);
      return;
    }
    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const left = values[leftIndex];
        const right = values[rightIndex];
        const remaining = values.filter((_, index) => index !== leftIndex && index !== rightIndex);
        const withOperator = (operator: NumberOperator) => new Set<NumberOperator>([
          ...left.operators,
          ...right.operators,
          operator,
        ]);
        const combinations: SolvableValue[] = [
          { value: left.value + right.value, expression: `(${left.expression}+${right.expression})`, operators: withOperator("+") },
          { value: left.value * right.value, expression: `(${left.expression}*${right.expression})`, operators: withOperator("*") },
          { value: left.value - right.value, expression: `(${left.expression}-${right.expression})`, operators: withOperator("-") },
          { value: right.value - left.value, expression: `(${right.expression}-${left.expression})`, operators: withOperator("-") },
        ];
        if (Math.abs(right.value) > 1e-10) combinations.push({ value: left.value / right.value, expression: `(${left.expression}/${right.expression})`, operators: withOperator("/") });
        if (Math.abs(left.value) > 1e-10) combinations.push({ value: right.value / left.value, expression: `(${right.expression}/${left.expression})`, operators: withOperator("/") });
        for (const combination of combinations) {
          search([...remaining, combination]);
          if (solutions.size >= limit) return;
        }
      }
    }
  };
  search(numbers.map((value) => ({ value, expression: String(value), operators: new Set<NumberOperator>() })));
  return [...solutions];
}

export function solveTo24(numbers: number[], requiredOperators: readonly NumberOperator[] = []): string | null {
  return findSolutionsTo24(numbers, requiredOperators, 1)[0] ?? null;
}

export function countSolutionsTo24(
  numbers: number[],
  requiredOperators: readonly NumberOperator[] = [],
  limit = Number.MAX_SAFE_INTEGER,
) {
  return findSolutionsTo24(numbers, requiredOperators, limit).length;
}

export function generateNumberPuzzles(seed: string, count: number, level: GameLevel = 3): NumberPuzzle[] {
  const settings = numberBoxLevelSettings(level);
  const random = seededRandom(`${seed}:number-box:level-${level}`);
  const puzzles: NumberPuzzle[] = [];
  const usedPuzzles = new Set<string>();
  let attempts = 0;
  while (puzzles.length < count && attempts < Math.max(1000, count * 1000)) {
    attempts += 1;
    const numbers = Array.from(
      { length: 4 },
      () => randomInt(random, settings.minimumOperand, settings.maximumOperand),
    );
    const puzzleKey = [...numbers].sort((left, right) => left - right).join(",");
    if (usedPuzzles.has(puzzleKey)) continue;
    const solutions = findSolutionsTo24(
      numbers,
      settings.requiredOperators,
      settings.maximumSolutionCount + 1,
    );
    if (
      solutions.length < settings.minimumSolutionCount
      || solutions.length > settings.maximumSolutionCount
    ) continue;
    usedPuzzles.add(puzzleKey);
    puzzles.push({
      numbers,
      target: 24,
      solution: solutions[0],
      requiredOperators: [...settings.requiredOperators],
      solutionCount: solutions.length,
    });
  }
  const fallbackNumbers = settings.requiredOperators.includes("/") ? [3, 3, 8, 8] : [1, 2, 3, 4];
  const fallbackSolutions = findSolutionsTo24(fallbackNumbers, settings.requiredOperators, settings.maximumSolutionCount + 1);
  while (puzzles.length < count) {
    puzzles.push({
      numbers: fallbackNumbers,
      target: 24,
      solution: fallbackSolutions[0] ?? "1*2*3*4",
      requiredOperators: [...settings.requiredOperators],
      solutionCount: Math.max(1, fallbackSolutions.length),
    });
  }
  return puzzles;
}
