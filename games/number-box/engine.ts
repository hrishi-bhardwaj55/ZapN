import { randomInt, seededRandom } from "@/lib/engine";

type Token = { type: "number" | "op" | "left" | "right"; value: string };

export interface NumberPuzzle {
  numbers: number[];
  target: number;
  solution: string;
}

export type NumberOperator = "+" | "-" | "*" | "/";

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
    return { valid: true, value };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "Invalid expression" };
  }
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
}

export function solveTo24(numbers: number[]): string | null {
  const search = (values: SolvableValue[]): string | null => {
    if (values.length === 1) return Math.abs(values[0].value - 24) < 1e-8 ? values[0].expression : null;
    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const left = values[leftIndex];
        const right = values[rightIndex];
        const remaining = values.filter((_, index) => index !== leftIndex && index !== rightIndex);
        const combinations: SolvableValue[] = [
          { value: left.value + right.value, expression: `(${left.expression}+${right.expression})` },
          { value: left.value * right.value, expression: `(${left.expression}*${right.expression})` },
          { value: left.value - right.value, expression: `(${left.expression}-${right.expression})` },
          { value: right.value - left.value, expression: `(${right.expression}-${left.expression})` },
        ];
        if (Math.abs(right.value) > 1e-10) combinations.push({ value: left.value / right.value, expression: `(${left.expression}/${right.expression})` });
        if (Math.abs(left.value) > 1e-10) combinations.push({ value: right.value / left.value, expression: `(${right.expression}/${left.expression})` });
        for (const combination of combinations) {
          const solution = search([...remaining, combination]);
          if (solution) return solution;
        }
      }
    }
    return null;
  };
  return search(numbers.map((value) => ({ value, expression: String(value) })));
}

export function generateNumberPuzzles(seed: string, count: number): NumberPuzzle[] {
  const random = seededRandom(`${seed}:number-box`);
  const puzzles: NumberPuzzle[] = [];
  let attempts = 0;
  while (puzzles.length < count && attempts < Math.max(200, count * 100)) {
    attempts += 1;
    const numbers = Array.from({ length: 4 }, () => randomInt(random, 1, 9));
    const solution = solveTo24(numbers);
    if (solution) puzzles.push({ numbers, target: 24, solution });
  }
  while (puzzles.length < count) puzzles.push({ numbers: [1, 2, 3, 4], target: 24, solution: "1*2*3*4" });
  return puzzles;
}
