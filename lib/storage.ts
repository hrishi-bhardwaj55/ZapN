import type { GameResult } from "./types";

const HISTORY_KEY = "cortex-history-v1";
const THEME_KEY = "cortex-theme";

export function loadHistory(): GameResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveResult(result: GameResult) {
  const history = [result, ...loadHistory()].slice(0, 250);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function loadTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function saveTheme(theme: "light" | "dark") {
  localStorage.setItem(THEME_KEY, theme);
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportJson(history: GameResult[]) {
  downloadText(
    "cortex-practice-history.json",
    JSON.stringify(history, null, 2),
    "application/json",
  );
}

export function exportCsv(history: GameResult[]) {
  const header = [
    "timestamp",
    "game",
    "round",
    "stimulus",
    "response",
    "correct",
    "reaction_time_ms",
    "score",
  ];
  const rows = history.flatMap((attempt) =>
    attempt.rounds.map((round) => [
      attempt.completedAt,
      attempt.gameId,
      round.round,
      round.stimulus,
      round.response,
      round.correct,
      Math.round(round.reactionTimeMs),
      round.score,
    ]),
  );
  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  downloadText("cortex-practice-rounds.csv", csv, "text/csv");
}
