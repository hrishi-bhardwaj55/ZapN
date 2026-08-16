import type { GameResult } from "./types";

export function resultInsight(result: GameResult) {
  const rt = Math.round(result.medianReactionTime);
  if (result.gameId === "balloon") {
    return result.metrics.explosions > 2
      ? "Frequent bursts reduced your banked value. Your next useful target is steadier risk calibration across balloon classes."
      : "Your cash-out pattern was controlled. Compare average pumps across repeated seeds to check consistency.";
  }
  if (result.gameId === "pincode") {
    const transformed = Math.min(result.metrics.reverseAccuracy || 0, result.metrics.sortAccuracy || 0);
    return transformed < (result.metrics.repeatAccuracy || 0)
      ? "Repeat recall is stronger than transformed recall. Focus the next block on Reverse and Sort sequences."
      : `Your strongest completed span was ${Math.round(result.metrics.workingMemorySpan || 0)} digits.`;
  }
  if (result.gameId === "shapeshift") {
    return `Incongruent trials changed your median response by ${Math.round(result.metrics.simonInterferenceMs || 0)} ms versus congruent trials. Keep classifying the shape, not its location.`;
  }
  if (result.gameId === "switch") {
    return `Responses after a task switch were ${Math.round(result.metrics.switchCostMs || 0)} ms ${result.metrics.switchCostMs > 0 ? "slower" : "faster"} than repeats.`;
  }
  if (result.gameId === "code-compare") {
    return result.accuracy >= 90
      ? `Accuracy is strong at ${Math.round(result.metrics.codeLength || 0)} characters; the next gain is reducing the ${rt} ms median response time.`
      : "Slow down enough to verify the final characters; accuracy is currently the highest-leverage improvement.";
  }
  if (result.gameId === "stock-master") {
    return result.metrics.earlyClicks > result.metrics.lateClicks
      ? "Your misses skew early. Let the needle enter the arc before committing."
      : "Your misses skew late. Begin tracking the next target before the current activation resolves.";
  }
  if (result.gameId === "skyscraper") {
    return `You used ${Math.round(result.metrics.actualMoves || 0)} moves against an optimum of ${Math.round(result.metrics.optimalMoves || 0)}.`;
  }
  if (result.gameId === "figure-it-out") {
    return `Average information gain was ${(result.metrics.averageInformationGain || 0).toFixed(2)} bits per guess. Favor guesses that change multiple attributes.`;
  }
  if (result.gameId === "number-box") {
    return `Your solve rate was ${Math.round(result.metrics.solveRate || 0)}%. Explore pairings that create useful intermediate values before committing to the final operation.`;
  }
  return `Practice result: ${Math.round(result.accuracy)}% accuracy with a ${rt} ms median response.`;
}

export function primaryWeakness(result: GameResult) {
  if (result.gameId === "balloon") return result.metrics.explosions > result.totalRounds * 0.35 ? "Risk calibration" : "Strategy consistency";
  if (result.gameId === "skyscraper" && result.metrics.planningEfficiency < 90) return "Planning efficiency";
  if (result.gameId === "shapeshift" && result.metrics.simonInterferenceMs > 100) return "Spatial interference";
  if (result.gameId === "switch" && result.metrics.switchCostMs > 180) return "Switch cost";
  if (result.accuracy < 70) return "Accuracy";
  if (result.metrics.consistencyMs > 500) return "Consistency";
  if (result.medianReactionTime > 1500) return "Response speed";
  return "Maintain form";
}
