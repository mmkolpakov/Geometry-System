import { Solver } from 'odex/src/odex.js';

/** Newtonian point masses, G = 1. ODEX owns adaptive integration and interpolation. */
export type Vector2 = { x: number; y: number };
export type Body = { mass: number; position: Vector2; velocity: Vector2 };
export type PresetId = 'figure-eight' | 'triangle' | 'chaotic';
export const NUMERICS = { solver: 'ODEX / Gragg–Bulirsch–Stoer', absoluteTolerance: 1e-9, relativeTolerance: 1e-9 } as const;
export const MIN_SEPARATION = 0.03;
export const MAX_TIME_STEP = 0.05;
export const PRESETS: ReadonlyArray<{ id: PresetId; name: string; description: string }> = [
  { id: 'figure-eight', name: 'Восьмёрка', description: 'Периодическая орбита трёх равных масс. Редкое упорядоченное решение.' },
  { id: 'triangle', name: 'Треугольник Лагранжа', description: 'Три равные массы вращаются, сохраняя равносторонний треугольник.' },
  { id: 'chaotic', name: 'Неустойчивая тройка', description: 'Несимметричные начальные условия. Сравните близкие траектории.' },
];

function finite(values: number[]): void {
  if (!values.every(Number.isFinite)) throw new Error('Требуются конечные численные значения.');
}
const encode = (bodies: Body[]) => bodies.flatMap(b => [b.position.x, b.position.y, b.velocity.x, b.velocity.y]);
const decode = (y: number[], masses: number[]): Body[] => masses.map((mass, i) => ({
  mass, position: { x: y[4 * i], y: y[4 * i + 1] }, velocity: { x: y[4 * i + 2], y: y[4 * i + 3] },
}));
function validate(bodies: Body[]): void {
  if (bodies.length < 2 || bodies.some(b => !b.position || !b.velocity || !(b.mass > 0))) throw new Error('Нужны хотя бы два тела с положительными массами.');
  finite([...encode(bodies), ...bodies.map(b => b.mass)]);
}
function distance(dx: number, dy: number): number {
  const r = Math.hypot(dx, dy);
  if (r < MIN_SEPARATION) throw new Error('Тесное сближение: расстояние меньше 0,03. Предел этой модели достигнут.');
  return r;
}

/** Published figure-eight values; perturbation changes vx, then restores the barycentric frame. */
export function createSystem(preset: PresetId, perturbation = 0): Body[] {
  finite([perturbation]);
  if (Math.abs(perturbation) > 0.5) throw new Error('Возмущение скорости должно быть в пределах ±0,5.');
  let rows: number[][];
  if (preset === 'figure-eight') rows = [
    [-0.97000436, 0.24308753, 0.466203685, 0.43236573],
    [0.97000436, -0.24308753, 0.466203685, 0.43236573],
    [0, 0, -0.93240737, -0.86473146],
  ];
  else if (preset === 'triangle') rows = [0, 1, 2].map(i => {
    const angle = Math.PI / 2 + i * 2 * Math.PI / 3;
    return [Math.cos(angle), Math.sin(angle), -(3 ** (-0.25)) * Math.sin(angle), 3 ** (-0.25) * Math.cos(angle)];
  });
  else if (preset === 'chaotic') rows = [
    [-1, 0, -0.02279533, 0.61125779], [1, 0, -0.32719660, -0.92109464], [0.1, 1.2, 0.34999193, 0.30983685],
  ];
  else throw new Error('Неизвестный набор начальных условий.');
  rows[0][2] += perturbation;
  const center = [0, 1, 2, 3].map(axis => rows.reduce((sum, row) => sum + row[axis], 0) / 3);
  return decode(rows.flatMap(row => row.map((value, axis) => value - center[axis])), [1, 1, 1]);
}

function solver(bodies: Body[], tolerance: number): Solver {
  validate(bodies);
  finite([tolerance]);
  if (tolerance < 1e-13 || tolerance > 1e-3) throw new Error('Допуск должен быть от 10⁻¹³ до 10⁻³.');
  return new Solver((_time, y) => {
    finite(y);
    const derivative = y.map((_, i) => i % 4 < 2 ? y[i + 2] : 0);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const dx = y[4 * j] - y[4 * i], dy = y[4 * j + 1] - y[4 * i + 1];
      const r3 = distance(dx, dy) ** 3;
      derivative[4 * i + 2] += bodies[j].mass * dx / r3;
      derivative[4 * i + 3] += bodies[j].mass * dy / r3;
      derivative[4 * j + 2] -= bodies[i].mass * dx / r3;
      derivative[4 * j + 3] -= bodies[i].mass * dy / r3;
    }
    finite(derivative);
    return derivative;
  }, bodies.length * 4, { absoluteTolerance: tolerance, relativeTolerance: tolerance, maxStepSize: MAX_TIME_STEP, maxSteps: 100_000 });
}

/** Advance by dt using ODEX, not a single internal integration step. Input stays unchanged. */
export function stepSystem(bodies: Body[], dt: number, tolerance: number = NUMERICS.absoluteTolerance): Body[] {
  finite([dt]);
  if (dt === 0 || Math.abs(dt) > MAX_TIME_STEP) throw new Error('Шаг времени должен быть ненулевым и не превышать 0,05.');
  const result = solver(bodies, tolerance).solve(0, encode(bodies), dt, () => {});
  return decode(result.y, bodies.map(b => b.mass));
}

export function diagnostics(bodies: Body[]): { energy: number; momentum: number; angularMomentum: number; minDistance: number } {
  validate(bodies);
  let energy = 0, px = 0, py = 0, angularMomentum = 0, minDistance = Infinity;
  for (let i = 0; i < bodies.length; i++) {
    const { mass, position: p, velocity: v } = bodies[i];
    energy += mass * (v.x ** 2 + v.y ** 2) / 2;
    px += mass * v.x; py += mass * v.y;
    angularMomentum += mass * (p.x * v.y - p.y * v.x);
    for (let j = i + 1; j < bodies.length; j++) {
      const r = distance(p.x - bodies[j].position.x, p.y - bodies[j].position.y);
      minDistance = Math.min(minDistance, r);
      energy -= mass * bodies[j].mass / r;
    }
  }
  const result = { energy, momentum: Math.hypot(px, py), angularMomentum, minDistance };
  finite(Object.values(result));
  return result;
}

export type SimulationResult = {
  bodies: Body[]; trails: Vector2[][]; samples: { time: number; bodies: Body[]; energy: number }[];
  initialEnergy: number; energyDrift: number; time: number; halted: boolean; reason?: string;
};

/** dt controls the output grid only. ODEX adapts internal steps; <=600 frames are retained. */
export function simulate(preset: PresetId, steps: number, dt: number, perturbation = 0, tolerance: number = NUMERICS.absoluteTolerance): SimulationResult {
  if (!Number.isInteger(steps) || steps < 0 || steps > 100_000) throw new Error('Число шагов вывода должно быть целым от 0 до 100000.');
  finite([dt]);
  if (dt <= 0 || dt > MAX_TIME_STEP) throw new Error('Шаг времени вывода должен быть больше 0 и не превышать 0,05.');
  const initial = createSystem(preset, perturbation);
  const initialEnergy = diagnostics(initial).energy, masses = initial.map(b => b.mass);
  const evaluate = solver(initial, tolerance).integrate(0, encode(initial));
  const samples = [{ time: 0, bodies: initial, energy: initialEnergy }];
  let halted = false, reason: string | undefined;
  const stride = Math.max(1, Math.ceil(steps / 599));
  try {
    for (let index = 1; index <= steps; index++) {
      const bodies = decode(evaluate(index * dt), masses);
      const energy = diagnostics(bodies).energy;
      if (Math.abs((energy - initialEnergy) / (Math.abs(initialEnergy) || 1)) > 0.01) throw new Error('Погрешность энергии превысила 1%. Предел точности расчёта достигнут.');
      if (index % stride === 0 || index === steps) samples.push({ time: index * dt, bodies, energy });
    }
  } catch (error) {
    halted = true;
    reason = error instanceof Error ? error.message : 'Численная ошибка.';
  } finally { evaluate(); }
  // On stop, retained frame, time and metrics refer to exactly the same state.
  const last = samples[samples.length - 1];
  return {
    bodies: last.bodies, trails: masses.map((_, i) => samples.map(s => s.bodies[i].position)), samples, initialEnergy,
    energyDrift: (last.energy - initialEnergy) / (Math.abs(initialEnergy) || 1), time: last.time, halted, ...(reason ? { reason } : {}),
  };
}
