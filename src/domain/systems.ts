import { Solver } from "odex/src/odex.js";
import {
  Body as AstronomyBody,
  HelioVector,
  RotateVector,
  Rotation_EQJ_ECL,
} from "astronomy-engine";
import {
  createSystem,
  diagnostics,
  gravityDerivative,
  MAX_TIME_STEP,
  NUMERICS,
} from "./nbody.ts";

export type SystemId = "solar" | "triple";
export interface SystemBody {
  id: string;
  name: string;
  kind: "star" | "planet";
  color: string;
  radiusKm?: number;
  semimajorAu?: number;
  periodYears?: number;
}
export type SystemVector = { x: number; y: number; z: number };
export interface PositionedBody extends SystemBody {
  position: SystemVector;
}
export interface SystemSnapshot {
  time: number;
  bodies: PositionedBody[];
  halted: boolean;
  reason?: string;
}
export const SYSTEM_DURATION: Record<SystemId, number> = {
  solar: 165,
  triple: 40,
};
export const SOLAR_EPOCH = "2000-01-01T12:00:00Z";
export function solarDate(years: number): Date {
  if (!Number.isFinite(years))
    throw new RangeError("Время должно быть конечным.");
  return new Date(Date.parse(SOLAR_EPOCH) + years * 365.25 * 86400000);
}
// JPL fitted J2000 semimajor axes, sidereal periods (Julian years), mean radii (km).
// These J2000 metadata values do not drive the ephemeris calculation.
const planets = [
  ["mercury", "Меркурий", "#b8b0a3", 0.38709927, 0.2408467, 2439.4],
  ["venus", "Венера", "#e5b97f", 0.72333566, 0.61519726, 6051.8],
  ["earth", "Земля", "#62a7e8", 1.00000261, 1.0000174, 6371.0084],
  ["mars", "Марс", "#da7956", 1.52371034, 1.8808476, 3389.5],
  ["jupiter", "Юпитер", "#d6b592", 5.202887, 11.862615, 69911],
  ["saturn", "Сатурн", "#edce8f", 9.53667594, 29.447498, 58232],
  ["uranus", "Уран", "#8edadd", 19.18916464, 84.016846, 25362],
  ["neptune", "Нептун", "#587ce8", 30.06992276, 164.79132, 24622],
] as const;
const astronomyBodies = [
  AstronomyBody.Sun,
  AstronomyBody.Mercury,
  AstronomyBody.Venus,
  AstronomyBody.Earth,
  AstronomyBody.Mars,
  AstronomyBody.Jupiter,
  AstronomyBody.Saturn,
  AstronomyBody.Uranus,
  AstronomyBody.Neptune,
];
const equatorialToEcliptic = Rotation_EQJ_ECL();
function solarPosition(index: number, years: number): SystemVector {
  const v = RotateVector(
    equatorialToEcliptic,
    HelioVector(astronomyBodies[index], years * 365.25),
  );
  return { x: v.x, y: v.y, z: v.z };
}
export const SYSTEM_BODIES: Record<SystemId, readonly SystemBody[]> = {
  solar: [
    {
      id: "sun",
      name: "Солнце",
      kind: "star",
      color: "#ffd36d",
      radiusKm: 695700,
    },
    ...planets.map(([id, name, color, semimajorAu, periodYears, radiusKm]) => ({
      id,
      name,
      color,
      semimajorAu,
      periodYears,
      radiusKm,
      kind: "planet" as const,
    })),
  ],
  triple: [
    { id: "star-a", name: "Звезда A", kind: "star", color: "#ffd28a" },
    { id: "star-b", name: "Звезда B", kind: "star", color: "#e99069" },
    { id: "star-c", name: "Звезда C", kind: "star", color: "#b9d9ff" },
    {
      id: "test-planet",
      name: "Пробная планета",
      kind: "planet",
      color: "#7ad9c3",
    },
  ],
};

export const TRIPLE_STEP = 0.05;
export function tripleInitialState(): number[] {
  return [
    ...createSystem("triangle").flatMap((body) => [
      body.position.x,
      body.position.y,
      body.velocity.x,
      body.velocity.y,
    ]),
    4.5,
    0,
    0,
    Math.sqrt(3 / 4.5),
  ];
}
type Sample = { time: number; state: number[] };
let tripleCache:
  | { samples: Sample[]; halted: boolean; reason?: string }
  | undefined;
function tripleData() {
  if (tripleCache) return tripleCache;
  const state = tripleInitialState(),
    masses = [1, 1, 1, 0];
  const starEnergy = (y: number[]) =>
    diagnostics(
      [0, 1, 2].map((i) => ({
        mass: 1,
        position: { x: y[4 * i], y: y[4 * i + 1] },
        velocity: { x: y[4 * i + 2], y: y[4 * i + 3] },
      })),
    ).energy;
  const initialEnergy = starEnergy(state);
  const evaluate = new Solver((_time, y) => gravityDerivative(masses, y), 16, {
    absoluteTolerance: NUMERICS.absoluteTolerance,
    relativeTolerance: NUMERICS.relativeTolerance,
    maxStepSize: MAX_TIME_STEP,
    maxSteps: 100_000,
  }).integrate(0, state);
  const samples = [{ time: 0, state }];
  let halted = false,
    reason: string | undefined;
  try {
    for (let i = 1; i <= SYSTEM_DURATION.triple / TRIPLE_STEP; i++) {
      const time = i * TRIPLE_STEP,
        next = evaluate(time);
      if (Math.abs((starEnergy(next) - initialEnergy) / initialEnergy) > 0.01)
        throw new Error("Дрейф энергии звёзд превысил 1%.");
      if (Math.hypot(next[12], next[13]) > 100)
        throw new Error("Планета вышла за расчётную область.");
      samples.push({ time, state: [...next] });
    }
  } catch (error) {
    halted = true;
    reason = error instanceof Error ? error.message : "Расчёт остановлен.";
  } finally {
    evaluate();
  }
  return (tripleCache = { samples, halted, ...(reason ? { reason } : {}) });
}

/** Raw physical coordinates: AU/Julian years for solar, normalized units for triple. */
export function systemSnapshot(id: SystemId, time: number): SystemSnapshot {
  if (!Number.isFinite(time))
    throw new RangeError("Время должно быть конечным.");
  const bounded = Math.max(0, Math.min(SYSTEM_DURATION[id], time));
  if (id === "solar")
    return {
      time: bounded,
      halted: false,
      bodies: SYSTEM_BODIES.solar.map((body, i) => ({
        ...body,
        position: solarPosition(i, bounded),
      })),
    };
  const data = tripleData(),
    last = data.samples.at(-1)!;
  const shown = Math.min(bounded, last.time),
    index = Math.min(Math.floor(shown / TRIPLE_STEP), data.samples.length - 1);
  const a = data.samples[index],
    b = data.samples[Math.min(index + 1, data.samples.length - 1)];
  const fraction = b.time === a.time ? 0 : (shown - a.time) / (b.time - a.time);
  return {
    time: shown,
    halted: data.halted,
    reason: data.reason,
    bodies: SYSTEM_BODIES.triple.map((body, i) => ({
      ...body,
      position: {
        x: a.state[4 * i] + fraction * (b.state[4 * i] - a.state[4 * i]),
        y:
          a.state[4 * i + 1] +
          fraction * (b.state[4 * i + 1] - a.state[4 * i + 1]),
        z: 0,
      },
    })),
  };
}

/** Whole paths for scene orientation; display compression belongs only in the renderer. */
export function systemTrails(
  id: SystemId,
): { id: string; points: SystemVector[] }[] {
  if (id === "solar")
    return SYSTEM_BODIES.solar
      .slice(1)
      .map((body, index) => ({
        id: body.id,
        points: Array.from({ length: 361 }, (_, i) =>
          solarPosition(index + 1, (body.periodYears! * i) / 360),
        ),
      }));
  return SYSTEM_BODIES.triple.map((body, i) => ({
    id: body.id,
    points: tripleData().samples.map((sample) => ({
      x: sample.state[4 * i],
      y: sample.state[4 * i + 1],
      z: 0,
    })),
  }));
}
