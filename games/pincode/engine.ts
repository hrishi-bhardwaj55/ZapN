import { randomInt, seededRandom } from "@/lib/engine";

export type MemoryTask = "forward" | "reverse" | "sort";

export function generateDigits(seed: string, round: number, length: number) {
  const random = seededRandom(`${seed}:pincode:${round}`);
  return Array.from({ length }, () => randomInt(random, 0, 9));
}

export function transformDigits(digits: number[], task: MemoryTask) {
  if (task === "reverse") return [...digits].reverse();
  if (task === "sort") return [...digits].sort((left, right) => left - right);
  return [...digits];
}

export function nextAdaptiveSpan(span: number, consecutiveCorrect: number, correct: boolean) {
  if (!correct) return { span: Math.max(3, span - 1), streak: 0 };
  if (consecutiveCorrect + 1 >= 2) return { span: span + 1, streak: 0 };
  return { span, streak: consecutiveCorrect + 1 };
}
