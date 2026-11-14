import { describe, expect, it } from 'vitest';
import { createSystem, diagnostics, MIN_SEPARATION, PRESETS, simulate, stepSystem, type Body } from './nbody';

function advance(initial: Body[], count: number, dt: number): Body[] {
  let state = initial;
  for (let i = 0; i < count; i += 1) state = stepSystem(state, dt);
  return state;
}

function stateDistance(a: Body[], b: Body[]): number {
  return Math.sqrt(a.reduce((sum, body, index) => sum
    + (body.position.x - b[index].position.x) ** 2
    + (body.position.y - b[index].position.y) ** 2
    + (body.velocity.x - b[index].velocity.x) ** 2
    + (body.velocity.y - b[index].velocity.y) ** 2, 0));
}

describe('Newtonian three-body laboratory', () => {
  it('creates independent equal-mass states in a barycentric frame', () => {
    for (const preset of PRESETS) {
      const bodies = createSystem(preset.id, 0.01);
      expect(bodies).toHaveLength(3);
      expect(bodies.map(body => body.mass)).toEqual([1, 1, 1]);
      expect(bodies.reduce((sum, body) => sum + body.position.x, 0)).toBeCloseTo(0, 14);
      expect(bodies.reduce((sum, body) => sum + body.position.y, 0)).toBeCloseTo(0, 14);
      expect(diagnostics(bodies).momentum).toBeLessThan(1e-14);
      const other = createSystem(preset.id, 0.01);
      bodies[0].position.x = 999;
      expect(other[0].position.x).not.toBe(999);
    }
  });

  it('returns to the published figure-eight initial condition after one period', () => {
    const period = 6.32591398;
    const initial = createSystem('figure-eight');
    const final = advance(initial, 6326, period / 6326);
    expect(stateDistance(initial, final)).toBeLessThan(0.0002);
    expect(Math.abs(diagnostics(final).energy - diagnostics(initial).energy)).toBeLessThan(2e-7);
  });

  it('cycles all three bodies along one figure-eight after a third-period', () => {
    const initial = createSystem('figure-eight');
    const advanced = advance(initial, 2109, 6.32591398 / 3 / 2109);
    for (let i = 0; i < 3; i += 1) {
      const target = initial[(i + 1) % 3];
      expect(Math.hypot(
        advanced[i].position.x - target.position.x,
        advanced[i].position.y - target.position.y,
      )).toBeLessThan(0.00001);
    }
  });

  it('preserves the Lagrange equal-side solution over one revolution', () => {
    const initial = createSystem('triangle');
    const period = 2 * Math.PI * 3 ** 0.25;
    const final = advance(initial, 3000, period / 3000);
    for (let i = 0; i < 3; i += 1) {
      const a = final[i].position;
      const b = final[(i + 1) % 3].position;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(Math.sqrt(3), 4);
    }
    expect(stateDistance(initial, final)).toBeLessThan(0.0001);
  });

  it('conserves linear and angular momentum and has bounded energy error', () => {
    const initial = createSystem('figure-eight', 0.001);
    const before = diagnostics(initial);
    const final = advance(initial, 4000, 0.002);
    const after = diagnostics(final);
    expect(after.momentum).toBeLessThan(1e-12);
    expect(after.angularMomentum).toBeCloseTo(before.angularMomentum, 11);
    expect(Math.abs((after.energy - before.energy) / before.energy)).toBeLessThan(0.0001);
    expect(final.reduce((sum, body) => sum + body.position.x, 0)).toBeCloseTo(0, 10);
    expect(final.reduce((sum, body) => sum + body.position.y, 0)).toBeCloseTo(0, 10);
  });

  it('converges as the ODEX error tolerance is tightened', () => {
    const reference = simulate('figure-eight', 1000, 0.005, 0, 1e-11);
    const loose = simulate('figure-eight', 1000, 0.005, 0, 1e-3);
    const precise = simulate('figure-eight', 1000, 0.005, 0, 1e-9);
    expect(stateDistance(precise.bodies, reference.bodies)).toBeLessThan(stateDistance(loose.bodies, reference.bodies) / 100);
    expect(Math.abs(precise.energyDrift)).toBeLessThan(1e-8);
  });

  it('integrates in either direction without mutating its input', () => {
    const initial = createSystem('figure-eight');
    const saved = structuredClone(initial);
    const next = stepSystem(initial, 0.003);
    expect(initial).toEqual(saved);
    expect(stateDistance(stepSystem(next, -0.003), initial)).toBeLessThan(1e-9);
  });

  it('does not change the trajectory when only the output sample interval changes', () => {
    const sparse = simulate('figure-eight', 1000, 0.01);
    const dense = simulate('figure-eight', 5000, 0.002);
    expect(stateDistance(sparse.bodies, dense.bodies)).toBeLessThan(1e-10);
  });

  it('bounds preview data and includes initial and final positions', () => {
    const result = simulate('figure-eight', 5000, 0.002);
    const initial = createSystem('figure-eight');
    expect(result.halted).toBe(false);
    expect(result.time).toBe(10);
    expect(new Set(result.trails.map(trail => trail.length)).size).toBe(1);
    for (let i = 0; i < 3; i += 1) {
      expect(result.trails[i].length).toBeLessThanOrEqual(600);
      expect(result.trails[i][0]).toEqual(initial[i].position);
      expect(result.trails[i].at(-1)).toEqual(result.bodies[i].position);
    }
    expect(result.samples).toHaveLength(result.trails[0].length);
    expect(result.samples[0].time).toBe(0);
    expect(result.samples.at(-1)?.time).toBe(result.time);
    for (let index = 0; index < result.samples.length; index += 1) {
      expect(result.samples[index].energy).toBe(diagnostics(result.samples[index].bodies).energy);
      expect(result.samples[index].bodies[0].position).toEqual(result.trails[0][index]);
    }
    expect(simulate('triangle', 0, 0.002).trails).toEqual(createSystem('triangle').map(body => [body.position]));
    expect(simulate('figure-eight', 5000, 0.002)).toEqual(result);
  });

  it('reveals sensitivity for the asymmetric preset without confusing it with energy error', () => {
    const base = simulate('chaotic', 6000, 0.002);
    const perturbed = simulate('chaotic', 6000, 0.002, 0.0001);
    expect(base.halted).toBe(false);
    expect(perturbed.halted).toBe(false);
    expect(Math.abs(base.energyDrift)).toBeLessThan(0.001);
    expect(Math.abs(perturbed.energyDrift)).toBeLessThan(0.001);
    expect(stateDistance(base.bodies, perturbed.bodies)).toBeGreaterThan(0.1);
  });

  it('reports a numerical stop and retains only the last trustworthy state', () => {
    const result = simulate('chaotic', 5000, 0.004, 0.05);
    expect(result.halted).toBe(true);
    expect(result.reason).toMatch(/Погрешность энергии|Тесное сближение/);
    expect(result.time).toBeGreaterThan(0);
    expect(result.time).toBeLessThan(20);
    expect(Math.abs(result.energyDrift)).toBeLessThanOrEqual(0.01);
    for (let i = 0; i < 3; i += 1) expect(result.trails[i].at(-1)).toEqual(result.bodies[i].position);
  });

  it('rejects invalid values and unsafe close encounters explicitly', () => {
    const initial = createSystem('figure-eight');
    expect(() => stepSystem(initial, NaN)).toThrow(/конечн/);
    expect(() => stepSystem(initial, 0)).toThrow(/Шаг времени/);
    expect(() => stepSystem(initial, 0.1)).toThrow(/Шаг времени/);
    expect(() => createSystem('figure-eight', Infinity)).toThrow(/конечн/);
    expect(() => simulate('figure-eight', -1, 0.002)).toThrow(/Число шагов/);
    expect(() => simulate('figure-eight', 1.5, 0.002)).toThrow(/Число шагов/);
    expect(() => simulate('figure-eight', 10, -0.002)).toThrow(/Шаг времени/);
    const bad = structuredClone(initial);
    bad[0].position.x = NaN;
    expect(() => stepSystem(bad, 0.002)).toThrow(/конечн/);
    const colliding: Body[] = [
      { mass: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      { mass: 1, position: { x: MIN_SEPARATION / 2, y: 0 }, velocity: { x: 0, y: 0 } },
    ];
    expect(() => stepSystem(colliding, 0.002)).toThrow(/Тесное сближение/);
  });
});
