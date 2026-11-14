/**
 * Intrinsic constant-curvature geometry. Rendering never supplies measurements.
 *
 * Curvature radius R = 1. Angles are returned in degrees, lengths in R units,
 * areas in R². Hyperbolic normalization: ds² = 4 |dz|² / (1 - |z|²)².
 * See docs/models.md for definitions, sources and model boundaries.
 */
import { geoArea, geoDistance, geoInterpolate } from 'd3-geo';

export type GeometryKind = 'flat' | 'sphere' | 'hyperbolic';
export type Point2 = { x: number; y: number };
export type Point3 = { x: number; y: number; z: number };

export interface TriangleGeometry {
  kind: GeometryKind;
  /** Intrinsic coordinates; unit 3D vectors on the sphere, 2D coordinates otherwise. */
  vertices: Point2[] | Point3[];
  /** Projected display coordinates in [-1,1], x right and y down. */
  paths: Point2[][];
  /** Angles at vertices 0, 1, 2 in degrees. */
  angles: number[];
  angleSum: number;
  area: number;
  curvature: number;
  /** Side i connects vertex i to vertex (i + 1) % 3. */
  sideLengths: number[];
  /** Display boundary; a sphere silhouette or the excluded ideal boundary of the disk. */
  outline?: Point2[];
}

const DEGREES = 180 / Math.PI;
const SEGMENTS = 64;
const SQRT3 = Math.sqrt(3);

function clampCos(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** d3-geo takes longitude/latitude in degrees, not Cartesian unit vectors. */
function geographic(point: Point3): [number, number] {
  return [Math.atan2(point.y, point.x) * DEGREES, Math.asin(clampCos(point.z)) * DEGREES];
}

function cartesian([longitude, latitude]: [number, number]): Point3 {
  const lambda = longitude / DEGREES;
  const phi = latitude / DEGREES;
  return { x: Math.cos(phi) * Math.cos(lambda), y: Math.cos(phi) * Math.sin(lambda), z: Math.sin(phi) };
}

/** Delegate great-circle interpolation to d3-geo; preserve exact endpoints. */
function sphereArc(a: Point3, b: Point3): (fraction: number) => Point3 {
  const interpolate = geoInterpolate(geographic(a), geographic(b));
  return fraction => fraction === 0 ? { ...a } : fraction === 1 ? { ...b } : cartesian(interpolate(fraction));
}

/** Orthographic view along (1,1,1), an orthonormal screen basis. */
function projectSphere(point: Point3): Point2 {
  return {
    x: (point.x - point.y) / Math.sqrt(2),
    y: (point.x + point.y - 2 * point.z) / Math.sqrt(6),
  };
}

function subtract(a: Point2, b: Point2): Point2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function complexMultiply(a: Point2, b: Point2): Point2 {
  return { x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x };
}

function complexDivide(a: Point2, b: Point2): Point2 {
  const normSquared = b.x * b.x + b.y * b.y;
  return {
    x: (a.x * b.x + a.y * b.y) / normSquared,
    y: (a.y * b.x - a.x * b.y) / normSquared,
  };
}

/** Disk isometry φ_a(z) = (z-a)/(1-conj(a)z), sending a to the origin. */
function diskToOrigin(point: Point2, origin: Point2): Point2 {
  const product = complexMultiply({ x: origin.x, y: -origin.y }, point);
  return complexDivide(subtract(point, origin), { x: 1 - product.x, y: -product.y });
}

function diskFromOrigin(point: Point2, origin: Point2): Point2 {
  const product = complexMultiply({ x: origin.x, y: -origin.y }, point);
  return complexDivide(
    { x: point.x + origin.x, y: point.y + origin.y },
    { x: 1 + product.x, y: product.y },
  );
}

function angle2(a: Point2, b: Point2): number {
  return Math.atan2(Math.abs(a.x * b.y - a.y * b.x), a.x * b.x + a.y * b.y);
}

function circleOutline(): Point2[] {
  return Array.from({ length: SEGMENTS * 2 + 1 }, (_, index) => {
    const angle = (index * Math.PI * 2) / (SEGMENTS * 2);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

function triangleVertices(radius: number): Point2[] {
  return [
    { x: 0, y: -radius },
    { x: (SQRT3 * radius) / 2, y: radius / 2 },
    { x: (-SQRT3 * radius) / 2, y: radius / 2 },
  ];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Produce a symmetric, nondegenerate teaching triangle.
 * Finite size is clamped to the supported [.25,1] UI interval. NaN/Infinity
 * are rejected instead of being silently presented as valid measurements.
 * Sphere size=1 is the exact octant (90° + 90° + 90°).
 */
export function createTriangle(kind: GeometryKind, size: number): TriangleGeometry {
  if (!Number.isFinite(size)) throw new RangeError('Triangle size must be finite.');
  const boundedSize = Math.max(0.25, Math.min(1, size));

  if (kind === 'sphere') {
    const center: Point3 = { x: 1 / SQRT3, y: 1 / SQRT3, z: 1 / SQRT3 };
    const axes: Point3[] = [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    const vertices = axes.map(axis => sphereArc(center, axis)(boundedSize));
    const coordinates = vertices.map(geographic);
    const sideLengths = coordinates.map((point, index) => geoDistance(point, coordinates[(index + 1) % 3]));
    const radians = vertices.map((_, index) => {
      const adjacentA = sideLengths[index];
      const adjacentB = sideLengths[(index + 2) % 3];
      const opposite = sideLengths[(index + 1) % 3];
      return Math.acos(clampCos((Math.cos(opposite) - Math.cos(adjacentA) * Math.cos(adjacentB))
        / (Math.sin(adjacentA) * Math.sin(adjacentB))));
    });
    const angles = radians.map(angle => angle * DEGREES);
    const orientedArea = geoArea({ type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] });
    // This preset always bounds a small convex region inside a hemisphere.
    // d3 respects ring winding, so choose that region rather than its complement.
    const area = Math.min(orientedArea, 4 * Math.PI - orientedArea);
    return {
      kind,
      vertices,
      paths: vertices.map((point, index) => {
        const interpolate = sphereArc(point, vertices[(index + 1) % 3]);
        return Array.from({ length: SEGMENTS + 1 }, (_, step) => projectSphere(interpolate(step / SEGMENTS)));
      }),
      angles,
      angleSum: sum(angles),
      area,
      curvature: 1,
      sideLengths,
      outline: circleOutline(),
    };
  }

  if (kind === 'flat') {
    const vertices = triangleVertices(boundedSize * 0.75);
    const radians = vertices.map((point, index) => angle2(
      subtract(vertices[(index + 1) % 3], point),
      subtract(vertices[(index + 2) % 3], point),
    ));
    const angles = radians.map(angle => angle * DEGREES);
    const [a, b, c] = vertices;
    return {
      kind,
      vertices,
      paths: vertices.map((point, index) => [{ ...point }, { ...vertices[(index + 1) % 3] }]),
      angles,
      angleSum: sum(angles),
      area: Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2,
      curvature: 0,
      sideLengths: vertices.map((point, index) => {
        const delta = subtract(vertices[(index + 1) % 3], point);
        return Math.hypot(delta.x, delta.y);
      }),
    };
  }

  if (kind === 'hyperbolic') {
    const vertices = triangleVertices(boundedSize * 0.8);
    const radians = vertices.map((point, index) => angle2(
      diskToOrigin(vertices[(index + 1) % 3], point),
      diskToOrigin(vertices[(index + 2) % 3], point),
    ));
    const angles = radians.map(angle => angle * DEGREES);
    const sideLengths = vertices.map((point, index) => {
      const destination = diskToOrigin(vertices[(index + 1) % 3], point);
      return 2 * Math.atanh(Math.hypot(destination.x, destination.y));
    });
    const paths = vertices.map((point, index) => {
      const target = vertices[(index + 1) % 3];
      const destination = diskToOrigin(target, point);
      const radius = Math.hypot(destination.x, destination.y);
      return Array.from({ length: SEGMENTS + 1 }, (_, step) => {
        // Preserve endpoints exactly and use equal intrinsic arclength steps.
        if (step === 0) return { ...point };
        if (step === SEGMENTS) return { ...target };
        const scale = Math.tanh((step / SEGMENTS) * Math.atanh(radius)) / radius;
        return diskFromOrigin({ x: destination.x * scale, y: destination.y * scale }, point);
      });
    });
    return {
      kind,
      vertices,
      paths,
      angles,
      angleSum: sum(angles),
      area: Math.PI - sum(radians),
      curvature: -1,
      sideLengths,
      outline: circleOutline(),
    };
  }

  throw new RangeError(`Unknown geometry: ${String(kind)}`);
}
