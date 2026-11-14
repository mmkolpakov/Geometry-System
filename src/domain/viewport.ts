import type { PresetId, Vector2 } from './nbody';

/**
 * Fixed view for each teaching preset over t∈[0,20], Δvx∈{0,.0001,…,.001}.
 * The bounds include every retained trajectory point with margin; the sweep test
 * deliberately fails if a preset, horizon or allowed perturbation changes.
 * Comparison never changes the mapping of a physical point to screen pixels.
 */
export const VIEW_BOUNDS: Record<PresetId, Readonly<{ x: number; y: number }>> = {
  'figure-eight': { x: 1.2, y: 0.45 },
  triangle: { x: 1.85, y: 3 },
  chaotic: { x: 5.9, y: 6.2 },
};

export function createViewport(preset: PresetId) {
  const bounds = VIEW_BOUNDS[preset];
  const scale = Math.min(235 / bounds.x, 165 / bounds.y);
  return {
    scale,
    point: (point: Vector2) => ({ x: 300 + point.x * scale, y: 222 - point.y * scale }),
  };
}

/** Cadence of the retained playback frames, distinct from solver query spacing. */
export function frameCadence(samples: ReadonlyArray<{ time: number }>): number {
  return samples.length > 1 ? samples[1].time - samples[0].time : 0;
}
