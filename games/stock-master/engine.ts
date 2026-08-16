import { randomInt, seededRandom } from "@/lib/engine";
import { levelValue } from "@/lib/levels";
import type { GameLevel } from "@/lib/types";

export interface GaugeState {
  id: number;
  angle: number;
  angularVelocity: number;
  targetStartAngle: number;
  targetEndAngle: number;
}

export interface GaugeGenerationProfile {
  targetWidth: number;
  minVelocity: number;
  maxVelocity: number;
  reverseChance: number;
  arrivalSpacingSeconds: number;
  arrivalJitterSeconds: number;
}

export function stockLevelSettings(level: GameLevel) {
  return {
    gaugeCount: levelValue(level, [2, 4, 4, 6, 9]),
    total: levelValue(level, [8, 9, 11, 13, 15]),
    targetWidth: levelValue(level, [58, 50, 42, 32, 24]),
    minVelocity: levelValue(level, [24, 30, 35, 45, 55]),
    maxVelocity: levelValue(level, [36, 46, 52, 68, 84]),
    reverseChance: levelValue(level, [0, 0.06, 0.12, 0.28, 0.48]),
    arrivalSpacingSeconds: levelValue(level, [1.6, 0.85, 0.48, 0.2, 0.06]),
    arrivalJitterSeconds: levelValue(level, [0.12, 0.14, 0.16, 0.12, 0.06]),
  };
}

export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export function targetContains(angle: number, start: number, end: number) {
  const value = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  return normalizedStart <= normalizedEnd
    ? value >= normalizedStart && value <= normalizedEnd
    : value >= normalizedStart || value <= normalizedEnd;
}

export function targetCenter(start: number, end: number) {
  const width = normalizeAngle(end - start);
  return normalizeAngle(start + width / 2);
}

export function shortestAngularDistance(from: number, to: number) {
  return ((normalizeAngle(to) - normalizeAngle(from) + 540) % 360) - 180;
}

export function gaugeClickOutcome(gauge: GaugeState) {
  const center = targetCenter(gauge.targetStartAngle, gauge.targetEndAngle);
  const width = normalizeAngle(gauge.targetEndAngle - gauge.targetStartAngle);
  const error = Math.abs(shortestAngularDistance(center, gauge.angle));
  const inside = targetContains(gauge.angle, gauge.targetStartAngle, gauge.targetEndAngle);
  const precision = inside ? Math.max(0, 1 - error / (width / 2)) : 0;
  const directedDistance = shortestAngularDistance(gauge.angle, center) * Math.sign(gauge.angularVelocity);
  const timeToTargetMs = (directedDistance / Math.abs(gauge.angularVelocity)) * 1000;
  return {
    classification: inside ? "HIT" : directedDistance > 0 ? "EARLY" : "LATE",
    precision,
    angularError: error,
    timeToTargetMs,
  } as const;
}

export function targetPassState(gauge: GaugeState, wasInside: boolean) {
  const inside = targetContains(gauge.angle, gauge.targetStartAngle, gauge.targetEndAngle);
  return { inside, missed: wasInside && !inside };
}

export function escalatedVelocity(angularVelocity: number, step: number) {
  const direction = Math.sign(angularVelocity) || 1;
  const increase = 1.5 + Math.min(20, Math.max(0, step)) * 0.35;
  return direction * Math.min(96, Math.abs(angularVelocity) + increase);
}

export function generateGauges(seed: string, count: number, profileOrHard: Partial<GaugeGenerationProfile> | boolean = false): GaugeState[] {
  const random = seededRandom(`${seed}:stock-master`);
  const profile: GaugeGenerationProfile = typeof profileOrHard === "boolean"
    ? {
        targetWidth: profileOrHard ? 28 : 42,
        minVelocity: 35,
        maxVelocity: profileOrHard ? 65 : 52,
        reverseChance: profileOrHard ? 0.28 : 0,
        arrivalSpacingSeconds: profileOrHard ? 0.2 : 0.48,
        arrivalJitterSeconds: 0.14,
      }
    : {
        targetWidth: profileOrHard.targetWidth ?? 42,
        minVelocity: profileOrHard.minVelocity ?? 35,
        maxVelocity: profileOrHard.maxVelocity ?? 52,
        reverseChance: profileOrHard.reverseChance ?? 0,
        arrivalSpacingSeconds: profileOrHard.arrivalSpacingSeconds ?? 0.48,
        arrivalJitterSeconds: profileOrHard.arrivalJitterSeconds ?? 0.14,
      };
  const sharedArrivalSeconds = 1.15 + random() * 0.25;
  return Array.from({ length: count }, (_, index) => {
    const start = randomInt(random, 0, 359);
    const speed = randomInt(random, profile.minVelocity, profile.maxVelocity);
    const reverse = profile.reverseChance > 0 && (index === count - 1 || random() < profile.reverseChance);
    const direction = reverse ? -1 : 1;
    const center = normalizeAngle(start + profile.targetWidth / 2);
    const arrivalSeconds = sharedArrivalSeconds
      + index * profile.arrivalSpacingSeconds
      + (random() - 0.5) * profile.arrivalJitterSeconds;
    return {
      id: index,
      angle: normalizeAngle(center - direction * Math.min(170, speed * arrivalSeconds)),
      angularVelocity: speed * direction,
      targetStartAngle: start,
      targetEndAngle: normalizeAngle(start + profile.targetWidth),
    };
  });
}

export function rescheduleGauge(gauge: GaugeState, step: number): GaugeState {
  const width = normalizeAngle(gauge.targetEndAngle - gauge.targetStartAngle);
  const direction = Math.sign(gauge.angularVelocity);
  const start = normalizeAngle(gauge.angle + direction * (95 + (step * 37) % 135));
  return {
    ...gauge,
    angularVelocity: escalatedVelocity(gauge.angularVelocity, step),
    targetStartAngle: start,
    targetEndAngle: normalizeAngle(start + width),
  };
}
