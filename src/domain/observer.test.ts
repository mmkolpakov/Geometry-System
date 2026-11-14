import { describe, expect, it } from 'vitest';
import { observe } from './observer';

const body = (x: number, y: number) => ({ mass: 1, position: { x, y }, velocity: { x: 0, y: 0 } });
describe('fixed observer', () => {
  it('measures azimuth from +y clockwise through +x', () => {
    const result = observe([body(0, 1), body(1, 0), body(0, -1), body(-1, 0)], { x: 0, y: 0 });
    expect(result.stars.map(star => star.azimuth)).toEqual([0, 90, 180, 270]);
  });
  it('obeys inverse square dilution and adds independent unit sources', () => {
    const result = observe([body(0, 1), body(0, 2)], { x: 0, y: 0 });
    expect(result.stars.map(star => star.flux)).toEqual([1, 0.25]);
    expect(result.totalFlux).toBe(1.25);
  });
  it('is invariant under a common translation and never changes dynamics', () => {
    const bodies = [body(1, 2), body(-2, 1)];
    const before = structuredClone(bodies);
    const result = observe(bodies);
    expect(observe(bodies.map(b => body(b.position.x + 4, b.position.y + 2)), { x: 4, y: -2 })).toEqual(result);
    expect(bodies).toEqual(before);
  });
  it('rejects a singular or nonfinite observation', () => {
    expect(() => observe([body(0, -4)])).toThrow(/совпал/);
    expect(() => observe([body(Infinity, 0)])).toThrow(/некорректны/);
    expect(() => observe([], { x: NaN, y: 0 })).toThrow(/конечные/);
  });
});
