#!/usr/bin/env python3
"""Compare the actual TypeScript integrator with an independent SciPy reference.

Requires Python with numpy/scipy and Node >= 22.18 (native TypeScript stripping).
Run from any directory:
    python scripts/validate_nbody.py
    python scripts/validate_nbody.py --output docs/acceptance/numerical-reference.md

The reference RHS and initial values are defined independently in this file.
The tested states come from src/domain/nbody.ts using the installed odex
package. No application or scientific model files are modified.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys

try:
    import numpy as np
    import scipy
    from scipy.integrate import solve_ivp
except ImportError as error:
    raise SystemExit("Reference validation requires numpy and scipy: " + str(error)) from error


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src/domain/nbody.ts"
GEOMETRY = ROOT / "src/domain/geometry.ts"
TIMES = (0.5, 1.0)
STEPS = (0.004, 0.002)


def reference_initial() -> np.ndarray:
    """Time reversal of the author-published figure-eight initial state, G=m=1."""
    positions = np.array([
        [-0.97000436, 0.24308753],
        [0.97000436, -0.24308753],
        [0.0, 0.0],
    ], dtype=float)
    velocities = np.array([
        [0.466203685, 0.43236573],
        [0.466203685, 0.43236573],
        [-0.93240737, -0.86473146],
    ], dtype=float)
    return np.concatenate((positions.ravel(), velocities.ravel()))


def rhs(_time: float, state: np.ndarray) -> np.ndarray:
    """Newtonian ODE, G=m=1; no force capping and no softening."""
    positions = state[:6].reshape(3, 2)
    velocities = state[6:].reshape(3, 2)
    accelerations = np.zeros((3, 2))
    # Ordered pairs intentionally differ from the pairwise TS implementation.
    for i in range(3):
        for j in range(3):
            if i == j:
                continue
            displacement = positions[j] - positions[i]
            distance = np.linalg.norm(displacement)
            accelerations[i] += displacement / distance**3
    return np.concatenate((velocities.ravel(), accelerations.ravel()))


def energy(state: np.ndarray) -> float:
    positions = state[:6].reshape(3, 2)
    velocities = state[6:].reshape(3, 2)
    kinetic = 0.5 * np.sum(velocities**2)
    potential = -sum(np.linalg.norm(positions[j] - positions[i]) ** -1
                     for i in range(3) for j in range(i + 1, 3))
    return float(kinetic + potential)


def angular_momentum(state: np.ndarray) -> float:
    p = state[:6].reshape(3, 2)
    v = state[6:].reshape(3, 2)
    return float(np.sum(p[:, 0] * v[:, 1] - p[:, 1] * v[:, 0]))


def typed_state(bodies: list[dict]) -> np.ndarray:
    return np.array(
        [body["position"][axis] for body in bodies for axis in ("x", "y")]
        + [body["velocity"][axis] for body in bodies for axis in ("x", "y")],
        dtype=float,
    )


def source_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def actual_typescript_results() -> dict:
    code = r"""
import { createSystem, stepSystem, simulate, diagnostics, NUMERICS } from './src/domain/nbody.ts';
import { createTriangle } from './src/domain/geometry.ts';
const results = [];
for (const time of [0.5, 1]) {
  for (const dt of [0.004, 0.002]) {
    let bodies = createSystem('figure-eight');
    for (let i = 0; i < Math.round(time / dt); i++) bodies = stepSystem(bodies, dt);
    const simulation = simulate('figure-eight', Math.round(time / dt), dt);
    results.push({ time, dt, bodies, diagnostic: diagnostics(bodies), simulation });
  }
}
const geometry = {};
for (const kind of ['flat', 'sphere', 'hyperbolic']) geometry[kind] = createTriangle(kind, 1);
console.log(JSON.stringify({ initial: createSystem('figure-eight'), results, geometry, numerics: NUMERICS }));
"""
    completed = subprocess.run(
        ["node", "--input-type=module", "--eval", code],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    return json.loads(completed.stdout)


def validate() -> tuple[str, bool]:
    before = {"nbody": source_digest(TARGET), "geometry": source_digest(GEOMETRY)}
    actual = actual_typescript_results()
    initial = reference_initial()
    if not np.allclose(typed_state(actual["initial"]), initial, rtol=0, atol=1e-15):
        raise AssertionError("TypeScript initial conditions differ from the independent reference.")

    coarse_reference = solve_ivp(rhs, (0, 1), initial, method="DOP853", t_eval=TIMES,
                                 rtol=1e-12, atol=1e-14, max_step=0.005)
    fine_reference = solve_ivp(rhs, (0, 1), initial, method="DOP853", t_eval=TIMES,
                               rtol=3e-14, atol=3e-15, max_step=0.0025)
    if not coarse_reference.success or not fine_reference.success:
        raise AssertionError("SciPy reference integration did not complete.")
    reference_delta = float(np.max(np.abs(coarse_reference.y - fine_reference.y)))
    reference_energy = max(abs(energy(fine_reference.y[:, i]) - energy(initial)) / abs(energy(initial))
                           for i in range(len(TIMES)))
    rows = []
    production_rows = []
    all_ok = reference_delta < 1e-10
    for result in actual["results"]:
        time = result["time"]
        dt = result["dt"]
        state = typed_state(result["bodies"])
        reference = fine_reference.y[:, TIMES.index(time)]
        position_error = float(np.max(np.linalg.norm((state[:6] - reference[:6]).reshape(3, 2), axis=1)))
        velocity_error = float(np.max(np.linalg.norm((state[6:] - reference[6:]).reshape(3, 2), axis=1)))
        relative_energy = abs(energy(state) - energy(initial)) / abs(energy(initial))
        momentum = float(np.linalg.norm(state[6:].reshape(3, 2).sum(axis=0)))
        angular_drift = abs(angular_momentum(state) - angular_momentum(initial))
        simulation = result["simulation"]
        production_state = typed_state(simulation["bodies"])
        route_delta = float(np.max(np.abs(production_state - state)))
        production_position_error = float(np.max(np.linalg.norm((production_state[:6] - reference[:6]).reshape(3, 2), axis=1)))
        production_velocity_error = float(np.max(np.linalg.norm((production_state[6:] - reference[6:]).reshape(3, 2), axis=1)))
        production_energy_error = abs(energy(production_state) - energy(initial)) / abs(energy(initial))
        route_matches = route_delta < 1e-7
        route_matches = route_matches and not simulation["halted"] and abs(simulation["time"] - time) < 1e-12
        all_ok = all_ok and route_matches and relative_energy < 1e-7 and momentum < 1e-8 and angular_drift < 1e-8
        all_ok = all_ok and max(position_error, velocity_error, production_position_error, production_velocity_error) < 1e-7
        all_ok = all_ok and production_energy_error < 1e-7
        rows.append(
            f"| {time:.1f} | {dt:.3f} | {position_error:.6e} | {velocity_error:.6e} | "
            f"{relative_energy:.6e} | {momentum:.3e} | {angular_drift:.3e} | {route_delta:.3e} | {'да' if route_matches else 'НЕТ'} |"
        )
        production_rows.append(f"| {time:.1f} | {dt:.3f} | {production_position_error:.6e} | {production_velocity_error:.6e} | {production_energy_error:.6e} |")
    interval_differences = []
    for time in TIMES:
        coarse = next(item for item in actual["results"] if item["time"] == time and item["dt"] == STEPS[0])
        fine = next(item for item in actual["results"] if item["time"] == time and item["dt"] == STEPS[1])
        difference = typed_state(coarse["simulation"]["bodies"]) - typed_state(fine["simulation"]["bodies"])
        position_delta = float(np.max(np.linalg.norm(difference[:6].reshape(3, 2), axis=1)))
        velocity_delta = float(np.max(np.linalg.norm(difference[6:].reshape(3, 2), axis=1)))
        interval_differences.append(f"| {time:.1f} | {position_delta:.6e} | {velocity_delta:.6e} |")
        all_ok = all_ok and max(position_delta, velocity_delta) < 1e-7

    geometry_rows = []
    for kind, triangle in actual["geometry"].items():
        geometry_rows.append(f"| {kind} | {triangle['angleSum']:.9f}° | {triangle['area']:.9f} | {triangle['curvature']} |")
    all_ok = all_ok and abs(actual["geometry"]["sphere"]["angleSum"] - 270) < 1e-10
    all_ok = all_ok and abs(actual["geometry"]["sphere"]["area"] - np.pi / 2) < 1e-10
    after = {"nbody": source_digest(TARGET), "geometry": source_digest(GEOMETRY)}
    if before != after:
        raise AssertionError("Model source changed during validation; rerun on the new revision.")
    node_version = subprocess.run(["node", "--version"], text=True, capture_output=True, check=True).stdout.strip()
    report = f"""# Независимая численная проверка

Статус: **{'PASS' if all_ok else 'FAIL'}**. Проверка запускает фактический `src/domain/nbody.ts` с готовым решателем `odex` через Node и сравнивает его с независимо записанной правой частью ньютоновских уравнений в SciPy DOP853. Проверяются две разные численные библиотеки, а не две копии одного интегратора.

## Воспроизведение

```bash
python scripts/validate_nbody.py --output docs/acceptance/numerical-reference.md
```

Требуются Node с поддержкой удаления TypeScript-типов, NumPy и SciPy. Скрипт возвращает ненулевой код при нарушении проверенных критериев. Текущая среда: Python {platform.python_version()}, NumPy {np.__version__}, SciPy {scipy.__version__}, Node {node_version}.

- SHA-256 `src/domain/nbody.ts`: `{before['nbody']}`.
- SHA-256 `src/domain/geometry.ts`: `{before['geometry']}`.
- `G = m₁ = m₂ = m₃ = 1`; координаты и скорости безразмерны.
- Проверяемый решатель: `odex@3.0.0-rc.4`, Gragg–Bulirsch–Stoer; абсолютный и относительный допуски `10⁻⁹`. Его внутренние шаги адаптивны. `0.004/0.002` ниже — интервалы вывода, а не фиксированные шаги интегратора.
- Начальные значения восьмёрки независимо переписаны со [страницы Richard Montgomery](https://people.ucsc.edu/~rmont/NbdyB.html), затем **все скорости обращены** для соответствия пресету приложения. Это обращённое по времени то же решение, а не другой закон движения. Исходные десятичные числа округлены.
- Основной эталон: DOP853, `rtol=3e-14`, `atol=3e-15`, `max_step=0.0025`. Контроль: `rtol=1e-12`, `atol=1e-14`, `max_step=0.005`.
- Максимальное покомпонентное расхождение двух настроек эталона: `{reference_delta:.6e}`; максимум относительного дрейфа энергии эталона в проверенных точках: `{reference_energy:.6e}`.
- Документация [SciPy solve_ivp](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) рекомендует DOP853 для высокой точности в нежёстких задачах. Это независимый алгоритм, а не сертификат достоверности всех последующих орбит.

## Сверка фактического интегратора

Ошибки положений и скоростей — максимум евклидовой нормы по трём телам относительно эталона, в нормированных единицах. Дрейфы измерены от общего начального состояния. Таблица показывает маршрут последовательных `stepSystem`. Production-маршрут `simulate` независимо сверяется с тем же DOP853 и с пошаговым маршрутом; последний может отличаться в пределах допуска из-за другого разбиения интервала. Нельзя требовать побитового совпадения разных разбиений адаптивного решателя.

| t | Интервал | max ‖δr‖ | max ‖δv‖ | Модуль δE/E₀ | Норма P | Модуль δL | Разница маршрутов | simulate в допуске |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
{chr(10).join(rows)}

Прямые ошибки production-маршрута `simulate` относительно того же эталона:

| t | Интервал | max ‖δr‖ | max ‖δv‖ | Модуль δE/E₀ |
| --- | --- | --- | --- | --- |
{chr(10).join(production_rows)}

Критерии этого прогона: абсолютная ошибка положения/скорости < `10⁻⁷` для обоих маршрутов; относительный дрейф энергии < `10⁻⁷`; норма импульса и дрейф углового момента < `10⁻⁸`; эталоны согласуются до `10⁻¹⁰`; разница маршрутов < `10⁻⁷`.

## Независимость от интервала вывода

Разница production-результатов при интервалах вывода `0.004` и `0.002` на одном физическом времени. Критерий < `10⁻⁷`. Отношение «4» здесь не ожидается: `odex` адаптивен, а изменение частоты вывода не меняет порядок готового решателя.

| t | max ‖δr‖ между интервалами | max ‖δv‖ между интервалами |
| --- | --- | --- |
{chr(10).join(interval_differences)}

## Проверка геометрических утверждений

Контрольные значения фактической `createTriangle(kind, 1)`:

| Модель | Сумма углов | Площадь | K |
| --- | --- | --- | --- |
{chr(10).join(geometry_rows)}

Сферический пресет — октант, независимо известные значения 270° и π/2. `d3-geo@3.1.1` рассчитывает дуги, расстояния и площадь сферы; адаптер выводит углы из длин. Полный набор `src/domain/geometry.test.ts` дополнительно сверяет тригонометрические законы, ортогональность гиперболических дуг границе, равномерность шагов по внутренней длине и диапазон размеров. Этот скрипт не заменяет запуск Vitest.

## Границы доказанного

- Сравнение координат проведено только при t=0.5 и t=1 для пресета восьмёрки и двух интервалов вывода. Оно не доказывает точность на всём двадцатисекундном горизонте приложения, для тесных сближений или для произвольных начальных условий.
- Сохранение энергии не гарантирует точности фаз/координат. Порог остановки 1% в приложении — защитный эвристический предел, а не научный допуск точности.
- Этот прогон не доказывает хаотичность пресета, экспоненциальный рост возмущений или устойчивость на бесконечном времени.
- `GeometryLab` указывает ортографическую проекцию сферы, метрику диска Пуанкаре и ограниченность космологической интерпретации. Метод, допуски и интервал вывода в `ThreeBodyLab` должны соответствовать `odex`; это проверяется отдельно от численного протокола. Этот документ не является визуальной приёмкой браузера.
- Учебная сцена трёх тел — не реконструкция Трисоляриса. Гравитация ньютоновская, пространство евклидово, тела точечные; климат, размеры звёзд, планета и релятивистские эффекты не моделируются.
"""
    return report, bool(all_ok)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write a Markdown report instead of printing it.")
    arguments = parser.parse_args()
    report, success = validate()
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(report, encoding="utf-8")
        print(f"{'PASS' if success else 'FAIL'}: {arguments.output}")
    else:
        print(report)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
