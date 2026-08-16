import { randomInt, seededRandom } from "@/lib/engine";

export interface GaugeState {
  id: number;
  angle: number;
  angularVelocity: number;
  targetStartAngle: number;
  targetEndAngle: number;
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

export function generateGauges(seed: string, count: number, hard = false): GaugeState[] {
  const random = seededRandom(`${seed}:stock-master`);
  return Array.from({ length: count }, (_, index) => {
    const start = randomInt(random, 0, 359);
    const width = hard ? 28 : 42;
    return {
      id: index,
      angle: randomInt(random, 0, 359),
      angularVelocity: randomInt(random, 35, hard ? 65 : 52) * (hard && random() > 0.72 ? -1 : 1),
      targetStartAngle: start,
      targetEndAngle: normalizeAngle(start + width),
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
