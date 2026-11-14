import type { Body, Vector2 } from './nbody';

export const OBSERVER: Readonly<Vector2> = { x: 0, y: -4 };

/** Fixed inertial observer; unit luminosities, instantaneous directions, no eclipses. */
export function observe(bodies: Body[], observer: Vector2 = OBSERVER) {
  if (![observer.x, observer.y].every(Number.isFinite)) throw new Error('Наблюдателю нужны конечные координаты.');
  const stars = bodies.map(({ position }) => {
    const dx = position.x - observer.x, dy = position.y - observer.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 1e-9) throw new Error('Наблюдатель совпал с источником или координаты некорректны.');
    return { distance, azimuth: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, flux: 1 / distance ** 2 };
  });
  return { stars, totalFlux: stars.reduce((sum, star) => sum + star.flux, 0) };
}
