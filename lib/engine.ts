import type {
  Difficulty,
  EventType,
  GameEvent,
  GameId,
  GameMode,
  GameResult,
  RoundRecord,
} from "./types";

export const CONFIG_VERSION = "zapn-public-guide-v2.0";

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seed: string) {
  return mulberry32(hashSeed(seed));
}

export function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function mean(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentile(values: number[], percent: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

export function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function accuracy(correct: number, total: number) {
  return total ? (correct / total) * 100 : 0;
}

export function movingAverage(values: number[], windowSize = 3) {
  return values.map((_, index) =>
    mean(values.slice(Math.max(0, index - windowSize + 1), index + 1)),
  );
}

export function createTelemetry(sessionId: string, gameId: GameId) {
  const events: GameEvent[] = [];
  return {
    events,
    record(
      eventType: EventType,
      round: number,
      payload: Record<string, unknown> = {},
    ) {
      events.push({
        sessionId,
        gameId,
        round,
        eventType,
        timestamp: performance.now(),
        payload,
      });
    },
  };
}

export function buildResult(options: {
  sessionId: string;
  gameId: GameId;
  mode: GameMode;
  difficulty: Difficulty;
  seed: string;
  startedAt: string;
  rounds: RoundRecord[];
  telemetry: GameEvent[];
  metrics?: Record<string, number>;
  score?: number;
}): GameResult {
  const correct = options.rounds.filter((round) => round.correct).length;
  const responseTimes = options.rounds
    .map((round) => round.reactionTimeMs)
    .filter((value) => value > 0);
  const rawScore = Math.max(
    0,
    Math.min(
      100,
      options.score ??
        accuracy(correct, options.rounds.length) * 0.72 +
          Math.max(0, 28 - median(responseTimes) / 50),
    ),
  );
  return {
    id: `${options.sessionId}-${options.gameId}-${Date.now()}`,
    sessionId: options.sessionId,
    gameId: options.gameId,
    mode: options.mode,
    difficulty: options.difficulty,
    seed: options.seed,
    configVersion: CONFIG_VERSION,
    startedAt: options.startedAt,
    completedAt: new Date().toISOString(),
    totalRounds: options.rounds.length,
    correct,
    incorrect: options.rounds.length - correct,
    accuracy: accuracy(correct, options.rounds.length),
    meanReactionTime: mean(responseTimes),
    medianReactionTime: median(responseTimes),
    rawScore,
    metrics: options.metrics ?? {},
    telemetry: options.telemetry,
    rounds: options.rounds,
  };
}

export function uid(prefix = "session") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatMs(value: number) {
  return value ? `${Math.round(value)} ms` : "—";
}

export function difficultyValue<T>(
  difficulty: Difficulty,
  values: Record<Difficulty, T>,
) {
  return values[difficulty];
}
