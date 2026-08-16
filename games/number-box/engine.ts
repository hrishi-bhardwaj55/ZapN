import { randomInt, seededRandom } from "@/lib/engine";

type Token = { type: "number" | "op" | "left" | "right"; value: string };

export interface NumberPuzzle {
  numbers: number[];
  target: number;
  solution: string;
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

export function generateNumberPuzzles(seed: string, count: number, numberCount = 4): NumberPuzzle[] {
  const random = seededRandom(`${seed}:number-box`);
  return Array.from({ length: count }, () => {
    const numbers = Array.from({ length: numberCount }, () => randomInt(random, 2, 9));
    const [a, b, c, d = 0] = numbers;
    const pattern = randomInt(random, 0, numberCount === 3 ? 1 : 2);
    const solution =
      numberCount === 3
        ? pattern === 0 ? `(${a}+${b})*${c}` : `${a}*${b}+${c}`
        : pattern === 0 ? `(${a}+${b})*${c}-${d}` : pattern === 1 ? `${a}*${b}+${c}+${d}` : `(${a}+${b})*(${c}-${d})`;
    return { numbers, target: parseExpression(solution), solution };
  });
}
