import { describe, expect, it } from "vitest";
import { createSystem, gravityDerivative } from "./nbody";
import {
  solarDate,
  SYSTEM_BODIES,
  systemSnapshot,
  systemTrails,
  tripleInitialState,
} from "./systems";

describe("system scenes", () => {
  it("uses eight planets, physical JPL metadata and a stated calendar epoch", () => {
    expect(SYSTEM_BODIES.solar).toHaveLength(9);
    expect(SYSTEM_BODIES.solar.map((body) => body.id)).toEqual([
      "sun",
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ]);
    expect(
      SYSTEM_BODIES.solar.find((body) => body.id === "earth"),
    ).toMatchObject({
      radiusKm: 6371.0084,
      semimajorAu: 1.00000261,
      periodYears: 1.0000174,
    });
    expect(
      SYSTEM_BODIES.solar.find((body) => body.id === "neptune"),
    ).toMatchObject({ semimajorAu: 30.06992276, periodYears: 164.79132 });
    expect(solarDate(0).toISOString()).toBe("2000-01-01T12:00:00.000Z");
    expect(solarDate(1).getTime() - solarDate(0).getTime()).toBe(
      365.25 * 86400000,
    );
    const mercury = [0, 0.06, 0.12, 0.18, 0.24].map(
      (time) => systemSnapshot("solar", time).bodies[1].position,
    );
    const radii = mercury.map((p) => Math.hypot(p.x, p.y, p.z));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.1);
    expect(mercury.some((p) => Math.abs(p.z) > 0.02)).toBe(true);
    expect(systemTrails("solar")).toHaveLength(8);
  });

  it("matches independent JPL Horizons heliocentric reference vectors", () => {
    // Horizons API: UT JD2451545.0, CENTER=500@10, REF_PLANE=ECLIPTIC,
    // REF_SYSTEM=ICRF, OUT_UNITS=AU-D, targets 199/399/899 (2026-11-14).
    // Fixed reference checks approximate positions; they do not certify navigation accuracy.
    const reference = [
      {
        id: "mercury",
        position: [
          -0.1300777328324658, -0.4472924077888585, -0.02460015509549487,
        ],
        tolerance: 0.00002,
      },
      {
        id: "earth",
        position: [
          -0.1771478822733411, 0.9672393401210591, -0.000004085203551709195,
        ],
        tolerance: 0.00002,
      },
      {
        id: "neptune",
        position: [16.81204952165866, -24.99176193299895, 0.1272224403813134],
        tolerance: 0.002,
      },
    ];
    for (const { id, position, tolerance } of reference) {
      const actual = systemSnapshot("solar", 0).bodies.find(
        (body) => body.id === id,
      )!.position;
      [actual.x, actual.y, actual.z].forEach((value, i) =>
        expect(Math.abs(value - position[i])).toBeLessThan(tolerance),
      );
    }
  });

  it("accelerates the passive planet under all stars without any reaction force", () => {
    const initial = tripleInitialState(),
      derivative = gravityDerivative([1, 1, 1, 0], initial);
    const stars = createSystem("triangle").flatMap((body) => [
      body.position.x,
      body.position.y,
      body.velocity.x,
      body.velocity.y,
    ]);
    expect(derivative.slice(0, 12)).toEqual(
      gravityDerivative([1, 1, 1], stars),
    );
    const expected = [0, 0];
    for (let i = 0; i < 3; i++) {
      const dx = initial[4 * i] - initial[12],
        dy = initial[4 * i + 1] - initial[13],
        r = Math.hypot(dx, dy);
      expected[0] += dx / r ** 3;
      expected[1] += dy / r ** 3;
    }
    expect(derivative[14]).toBeCloseTo(expected[0], 14);
    expect(derivative[15]).toBeCloseTo(expected[1], 14);
    const moved = [...initial];
    moved[12] += 2;
    expect(gravityDerivative([1, 1, 1, 0], moved).slice(0, 12)).toEqual(
      derivative.slice(0, 12),
    );
    expect(() =>
      gravityDerivative([1, 1, 1, 0], [...stars, ...stars.slice(0, 4)]),
    ).toThrow(/сближение/);
  });

  it("integrates one continuous 40-unit trajectory and samples it consistently", () => {
    const trails = systemTrails("triple"),
      initial = tripleInitialState();
    expect(trails).toHaveLength(4);
    expect(trails.every((trail) => trail.points.length === 801)).toBe(true);
    expect(systemSnapshot("triple", 40)).toMatchObject({
      time: 40,
      halted: false,
    });
    for (const time of [0, 1, 10, 20, 40]) {
      const frame = systemSnapshot("triple", time),
        index = Math.round(time / 0.05);
      frame.bodies.forEach((body, i) =>
        expect(body.position).toEqual(trails[i].points[index]),
      );
      for (let i = 0; i < 3; i++) {
        const angle = Math.PI / 2 + (i * 2 * Math.PI) / 3 + time * 3 ** -0.25;
        expect(
          Math.hypot(
            frame.bodies[i].position.x - Math.cos(angle),
            frame.bodies[i].position.y - Math.sin(angle),
          ),
        ).toBeLessThan(3e-6);
      }
    }
    expect(systemSnapshot("triple", 0.025).bodies[3].position.x).toBeCloseTo(
      (trails[3].points[0].x + trails[3].points[1].x) / 2,
      14,
    );
    expect(
      trails[3].points.some(
        (point) => Math.abs(Math.hypot(point.x, point.y) - 4.5) > 0.1,
      ),
    ).toBe(true);
    expect(initial.slice(12)).toEqual([4.5, 0, 0, Math.sqrt(3 / 4.5)]);
    expect(systemSnapshot("triple", 99).time).toBe(40);
    expect(() => systemSnapshot("solar", NaN)).toThrow(/конечным/);
  });
});
