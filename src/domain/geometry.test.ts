import { describe, expect, it } from 'vitest';
import { createTriangle, type GeometryKind, type Point2, type Point3 } from './geometry';

const DEGREES = 180 / Math.PI;

describe('constant-curvature teaching triangles', () => {
  it('recovers the independently known spherical octant at size=1', () => {
    const triangle = createTriangle('sphere', 1);
    expect(triangle.vertices).toEqual([
      { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 },
    ]);
    triangle.angles.forEach(angle => expect(angle).toBeCloseTo(90, 12));
    triangle.sideLengths.forEach(length => expect(length).toBeCloseTo(Math.PI / 2, 12));
    expect(triangle.angleSum).toBeCloseTo(270, 12);
    expect(triangle.area).toBeCloseTo(Math.PI / 2, 12);
  });

  it.each([0.25, 0.5, 0.75, 1])('matches the Euclidean equilateral reference at size=%s', size => {
    const triangle = createTriangle('flat', size);
    const side = Math.sqrt(3) * size * 0.75;
    triangle.sideLengths.forEach(length => expect(length).toBeCloseTo(side, 12));
    triangle.angles.forEach(angle => expect(angle).toBeCloseTo(60, 12));
    expect(triangle.angleSum).toBeCloseTo(180, 12);
    expect(triangle.area).toBeCloseTo((Math.sqrt(3) / 4) * side ** 2, 12);
    expect(triangle.curvature).toBe(0);
  });

  it.each([0.25, 0.5, 0.75, 1])('matches the spherical law of cosines independently at size=%s', size => {
    const triangle = createTriangle('sphere', size);
    // Vertices lie at equal angular distance α from the (1,1,1) axis,
    // separated by 120° of azimuth. Derive side length, then interior angle.
    const alpha = size * Math.acos(1 / Math.sqrt(3));
    const cosSide = Math.cos(alpha) ** 2 - Math.sin(alpha) ** 2 / 2;
    const side = Math.acos(cosSide);
    const angle = Math.acos(cosSide / (1 + cosSide));
    triangle.sideLengths.forEach(length => expect(length).toBeCloseTo(side, 12));
    triangle.angles.forEach(value => expect(value).toBeCloseTo(angle * DEGREES, 12));
    expect(triangle.area).toBeCloseTo(3 * angle - Math.PI, 12);
    expect(triangle.angleSum).toBeGreaterThan(180);
    expect(triangle.curvature).toBe(1);
  });

  it.each([0.25, 0.5, 0.75, 1])('matches hyperbolic distance and cosine-law references at size=%s', size => {
    const triangle = createTriangle('hyperbolic', size);
    const radius = size * 0.8;
    // acosh formula uses the Euclidean chord between equal-radius vertices.
    const chordSquared = 3 * radius ** 2;
    const coshSide = 1 + (2 * chordSquared) / (1 - radius ** 2) ** 2;
    const side = Math.acosh(coshSide);
    const angle = Math.acos(coshSide / (coshSide + 1));
    triangle.sideLengths.forEach(length => expect(length).toBeCloseTo(side, 11));
    triangle.angles.forEach(value => expect(value).toBeCloseTo(angle * DEGREES, 11));
    expect(triangle.area).toBeCloseTo(Math.PI - 3 * angle, 11);
    expect(triangle.angleSum).toBeGreaterThan(0);
    expect(triangle.angleSum).toBeLessThan(180);
    expect(triangle.curvature).toBe(-1);
  });

  it('samples hyperbolic sides on circles orthogonal to the ideal boundary', () => {
    const triangle = createTriangle('hyperbolic', 0.9);
    const vertices = triangle.vertices as Point2[];
    triangle.paths.forEach((path, side) => {
      const a = vertices[side];
      const b = vertices[(side + 1) % 3];
      // Orthogonal circle: |center|² = radius²+1 and
      // 2 center·a = |a|²+1. Solve its center from the two endpoints.
      const rhsA = (a.x ** 2 + a.y ** 2 + 1) / 2;
      const rhsB = (b.x ** 2 + b.y ** 2 + 1) / 2;
      const determinant = a.x * b.y - a.y * b.x;
      const center = {
        x: (rhsA * b.y - a.y * rhsB) / determinant,
        y: (a.x * rhsB - rhsA * b.x) / determinant,
      };
      const radiusSquared = center.x ** 2 + center.y ** 2 - 1;
      path.forEach(point => {
        expect((point.x - center.x) ** 2 + (point.y - center.y) ** 2).toBeCloseTo(radiusSquared, 10);
        expect(Math.hypot(point.x, point.y)).toBeLessThan(1);
      });
      expect(path[0]).toEqual(a);
      expect(path.at(-1)).toEqual(b);
    });
  });

  it('samples equal hyperbolic arclength intervals rather than equal screen chords', () => {
    const triangle = createTriangle('hyperbolic', 1);
    const distance = (a: Point2, b: Point2) => Math.acosh(1 + 2 * (
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    ) / ((1 - a.x ** 2 - a.y ** 2) * (1 - b.x ** 2 - b.y ** 2)));
    triangle.paths.forEach((path, index) => {
      const expected = triangle.sideLengths[index] / (path.length - 1);
      for (let step = 1; step < path.length; step++) {
        expect(distance(path[step - 1], path[step])).toBeCloseTo(expected, 10);
      }
    });
  });

  it.each<GeometryKind>(['flat', 'sphere', 'hyperbolic'])('keeps %s outputs finite, bounded and symmetric throughout the UI range', kind => {
    for (let index = 0; index <= 30; index++) {
      const triangle = createTriangle(kind, 0.25 + index / 40);
      expect(triangle.area).toBeGreaterThan(0);
      triangle.angles.forEach(angle => {
        expect(Number.isFinite(angle)).toBe(true);
        expect(angle).toBeCloseTo(triangle.angles[0], 10);
      });
      triangle.sideLengths.forEach(length => expect(length).toBeCloseTo(triangle.sideLengths[0], 10));
      triangle.paths.flat().forEach(point => {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
        expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1 + 1e-12);
      });
      if (kind === 'sphere') {
        (triangle.vertices as Point3[]).forEach(vertex =>
          expect(Math.hypot(vertex.x, vertex.y, vertex.z)).toBeCloseTo(1, 12),
        );
      }
    }
  });

  it('increases spherical excess and hyperbolic deficit as the triangle grows', () => {
    const sizes = [0.25, 0.4, 0.6, 0.8, 1];
    for (let index = 1; index < sizes.length; index++) {
      expect(createTriangle('sphere', sizes[index]).angleSum)
        .toBeGreaterThan(createTriangle('sphere', sizes[index - 1]).angleSum);
      expect(createTriangle('hyperbolic', sizes[index]).angleSum)
        .toBeLessThan(createTriangle('hyperbolic', sizes[index - 1]).angleSum);
    }
  });

  it('rejects nonfinite inputs and contains finite inputs outside the supported UI interval', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => createTriangle('sphere', value)).toThrow(RangeError);
    }
    expect(createTriangle('flat', -10)).toEqual(createTriangle('flat', 0.25));
    expect(createTriangle('hyperbolic', 10)).toEqual(createTriangle('hyperbolic', 1));
    expect(() => createTriangle('invalid' as GeometryKind, 1)).toThrow(RangeError);
  });
});
