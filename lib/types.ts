export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "tutorial" | "practice" | "simulation";

export type GameId =
  | "balloon"
  | "skyscraper"
  | "shapeshift"
  | "code-compare"
  | "pincode"
  | "number-box"
  | "figure-it-out"
  | "switch"
  | "stock-master";

export type EventType =
  | "GAME_STARTED"
  | "ROUND_STARTED"
  | "STIMULUS_SHOWN"
  | "USER_RESPONSE"
  | "CORRECT_RESPONSE"
  | "INCORRECT_RESPONSE"
  | "TIMEOUT"
  | "ROUND_COMPLETED"
  | "GAME_COMPLETED"
  | "LEVEL_CHANGED"
  | "DIFFICULTY_CHANGED"
  | "FOCUS_LOST";

export interface GameEvent {
  sessionId: string;
  gameId: GameId;
  round: number;
  eventType: EventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface RoundRecord {
  round: number;
  stimulus: string;
  response: string;
  correct: boolean;
  reactionTimeMs: number;
  score: number;
}

export interface GameResult {
  id: string;
  sessionId: string;
  gameId: GameId;
  mode: GameMode;
  difficulty: Difficulty;
  seed: string;
  configVersion: string;
  startedAt: string;
  completedAt: string;
  totalRounds: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  meanReactionTime: number;
  medianReactionTime: number;
  rawScore: number;
  metrics: Record<string, number>;
  telemetry: GameEvent[];
  rounds: RoundRecord[];
}

export interface GameProps {
  seed: string;
  difficulty: Difficulty;
  mode: GameMode;
  timed: boolean;
  paused?: boolean;
  config?: {
    trials: number;
    timeLimitMs: number;
    adaptive: boolean;
    presentationMode?: "mixed" | "simultaneous" | "sequential";
    interDigitDelayMs?: number;
  };
  sessionId: string;
  debug: boolean;
  onFinish: (result: GameResult) => void;
}

export interface GameMeta {
  id: GameId;
  name: string;
  kicker: string;
  skill: string;
  description: string;
  accent: string;
  glyph: string;
  controls: string;
  scoring: string;
  example: string;
  failure: string;
}
