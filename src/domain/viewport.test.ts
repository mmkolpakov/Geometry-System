import { describe, expect, it } from 'vitest';
import { PRESETS, simulate } from './nbody';
import { createViewport, frameCadence, VIEW_BOUNDS } from './viewport';

describe('fixed scientific viewport', () => {
  it('keeps every allowed comparison trajectory in the same preset view', () => {
    for (const preset of PRESETS) {
      const viewport = createViewport(preset.id);
      for (let delta = 0; delta <= 10; delta += 1) {
        const simulation = simulate(preset.id, 5000, .004, delta / 10000);
        expect(simulation.halted).toBe(false);
        for (const point of simulation.trails.flat()) {
          expect(Math.abs(point.x)).toBeLessThan(VIEW_BOUNDS[preset.id].x);
          expect(Math.abs(point.y)).toBeLessThan(VIEW_BOUNDS[preset.id].y);
          const display = viewport.point(point);
          expect(display.x).toBeGreaterThanOrEqual(65);
          expect(display.x).toBeLessThanOrEqual(535);
          expect(display.y).toBeGreaterThanOrEqual(57);
          expect(display.y).toBeLessThanOrEqual(387);
        }
      }
    }
  });

  it('maps an unchanged world point identically before and after comparing', () => {
    for (const preset of PRESETS) {
      const position = simulate(preset.id, 5000, .004).samples[0].bodies[0].position;
      const before = createViewport(preset.id).point(position);
      for (let delta = 1; delta <= 10; delta += 1) {
        const compared = simulate(preset.id, 5000, .004, delta / 10000);
        expect(createViewport(preset.id).point(compared.samples[0].bodies[0].position)).toEqual(before);
      }
    }
  });

  it('reports retained frame cadence rather than the query interval', () => {
    const simulation = simulate('figure-eight', 5000, .004);
    expect(frameCadence(simulation.samples)).toBeCloseTo(.036, 14);
    expect(simulation.samples.at(-1)!.time - simulation.samples.at(-2)!.time).toBeCloseTo(.020, 14);
    expect(frameCadence([{time:0}])).toBe(0);
  });
});
