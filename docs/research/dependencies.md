# Reuse decisions · 14 November 2026

The product owns its educational scenarios, model choices, safeguards and presentation. Existing maintained numerical and geometry software owns reusable algorithms. Source size is a maintenance cost, not a measure of scientific value.

## Adopted: ODEX for numerical integration

- Package: `odex@3.0.0-rc.4`, BSD-2-Clause, no runtime dependencies. The registry version was checked on 14 November 2026; the package was last published in 2023. It is explicitly pinned because it is a release candidate, not presented as a newly released stable version.
- [Official project](https://github.com/littleredcomputer/odex-js): a TypeScript port of Hairer and Wanner's Gragg–Bulirsch–Stoer ODEX solver. Supports error tolerances and dense interpolation. The published npm tarball is authoritative for the v3 API; the default GitHub branch still documents the v2 API.
- Runtime: one solver instance per trajectory, 12 state components, absolute and relative tolerance `1e-9`, maximum internal step `0.05`. The browser requests samples on a separate grid. At most 600 snapshots are retained for playback.
- The adapter retains Newton's force law, initial presets, units, energy/momentum diagnostics, finite-value checks, a separation guard at `0.03`, and a 1% energy-error guard. There is no softening, custom numerical stepper, WebAssembly build or backend service.
- `dt` in `simulate(preset, count, dt)` is an **output interval**, not the ODEX internal integration step. `stepSystem` advances by the requested time interval using ODEX; it does not implement a second numerical engine.
- ODEX is not symplectic. The product makes no claim of exact long-time conservation or mathematical proof from plotted trajectories. DOP853 (SciPy) is an independent verification reference; invariants, analytic special solutions and tolerance convergence remain tests.
- A derivative-stage close approach can stop the computation conservatively. This is a protective model limit, not a physical collision classification.

Before substitution, `src/domain/nbody.ts` contained 263 lines, including a custom velocity-Verlet method. The ODEX adapter has 136 lines: **127 fewer lines, about 48% less application-owned source**. This counts line reduction, not minification. The corresponding tests remain and were adjusted to adaptive integration; they do not assert the old solver's second-order behavior.

## Adopted: d3-geo for spherical geometry

[Official spherical math API](https://d3js.org/d3-geo/math) supplies great-circle interpolation (`geoInterpolate`), angular distance (`geoDistance`) and spherical area (`geoArea`). It is an algorithm library that fits the existing accessible SVG renderer without introducing a second UI tree. Coordinates are converted explicitly between Cartesian unit vectors and longitude/latitude in degrees. Area uses steradians; unit-sphere lengths use radians. Tests check the octant and polygon orientation.

## Evaluated: Complex.js for Poincaré arithmetic

[Official project](https://github.com/rawify/Complex.js) supplies tested complex arithmetic, conjugation, norm and division. It is not installed in this release: the Poincaré adapter needs only two short real-coordinate operations, so a further numeric representation and conversion layer would not reduce the application code. Complex.js is a candidate if future experiments require broader complex arithmetic; it is not itself a complete hyperbolic-geometry engine.

## Evaluated alternatives

| Library | Verified capability | Decision for this release |
| --- | --- | --- |
| [REBOUND](https://rebound.hanno-rein.de/) | Established N-body library; multiple integrators, diagnostics and collision/close-encounter workflows. [Official browser examples](https://rebound.hanno-rein.de/c_examples/simplest/) compile C with Emscripten/WASM. | Valuable research reference. A custom WASM build and bridge would increase release plumbing for three point masses; no verified drop-in npm API was found. Reconsider for longer integrations or specialist modes. |
| [JSXGraph](https://jsxgraph.org/docs/) 1.14.3 | Interactive geometry, 3D objects, controls and accessibility features. [GEO extension](https://jsxgraph.org/extensions/geo/) includes spherical triangles with intrinsic angles/areas. | Suitable for a future free-construction board. Current product has constrained experiments with native accessible controls; adding a second board renderer and its lifecycle would not replace the Poincaré model or all product UI. GEO is a separate first-version extension and includes geographic data unnecessary for this lab. |
| [Source Academy nbody](https://source-academy.github.io/nbody/api/) 0.2.0 | Browser JS/TS N-body library; installation couples Three.js, Plotly and teaching controls. | More rendering/UI dependency surface than needed for an SVG experiment; prefer a narrow ODE engine. |
| [@tangent.to/ode](https://github.com/tangent-to/ode) | Browser ESM RK45, dense output, events and stiff solvers; tests compare with SciPy. | Promising, but a younger library with less release history. ODEX is the smaller scoped replacement for the current requirements. |

All external assets needed at runtime are bundled. Deployment does not depend on scientific SaaS, API keys, live CDNs, the GitHub API or a notebook server. Notices for incorporated dependencies are included in the production build.
