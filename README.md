# Kontur · Контур · 界线

Six interactive experiments about geometry and three-body motion, prompted by Liu Cixin’s trilogy. Change a parameter, inspect the numbers, and compare your prediction with the result. Formulas, model assumptions and sources are available alongside each experiment.

The app is available in **Russian and Simplified Chinese**. This README is in English; there is no English interface. Most research and acceptance documents linked below are in Russian.

## Choose a starting point

| What brings you here? | Try this |
| --- | --- |
| Curious about geometry or space | Start with experiment 01. Resize a triangle on the plane, then on the sphere. Compare the angle sums before opening the formulas. |
| Read the books or watched Netflix or Tencent | Choose a question you recognise. Book context opens only after a spoiler warning; the scientific experiment works without it. The scenes and orbits are educational models, not reconstructions of either adaptation. |
| Preparing a lesson or discussion | Ask for a prediction and change one parameter. In the three-body lab, pause, step and reset the motion; share a link to reproduce a chosen state. |
| Reviewing the mathematics or code | Open the formula view and sources. Inspect units, initial conditions, both trajectories’ energy diagnostics and the independent numerical comparison. |

In the app, the guided route is **Маршрут / 探索路径**, the free laboratory is **Лаборатория / 实验室**, and model references are **Основания / 模型与依据**.

## The six experiments

| # | Question | What you can check |
| --- | --- | --- |
| 01 | Why can a shortest path look curved? | Compare the plane and sphere; separate geometry on a surface from its screen projection. |
| 02 | Can a triangle have three right angles? | Set the spherical triangle to its maximum size: three 90° angles add to 270°. |
| 03 | Can an infinite plane fit inside a circle? | Explore the Poincaré disk, then rotate two 3D points to see what a projection hides. |
| 04 | Must three attracting bodies move irregularly? | Run the special Lagrange triangle solution and inspect directions and relative irradiance at a fixed observer. |
| 05 | Can three equal masses repeat a shared path? | Run the figure-eight solution and compare a periodic mathematical orbit with its numerical approximation. |
| 06 | What changes when the initial velocity changes? | Compare nearby initial states at the same model time, with trajectory separation and energy diagnostics. |

## Run locally

Use **Node.js 22.12 or newer**. The repository’s `.nvmrc` selects Node 22.

```sh
git clone https://github.com/mmkolpakov/Geometry-System.git
cd Geometry-System
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The app runs in the browser without an account, API key, backend or database.

A shared URL preserves the selected model, parameters, language and saved frame. Marks for lessons answered correctly stay in that browser’s local storage; individual answers and these marks are not included in the link. Spoiler disclosure is local to the current view and is not shared or stored. The app contains no analytics tracker.

## Build and check

```sh
npx playwright install chromium
npm run check
```

`check` runs TypeScript, unit tests, the production build and end-to-end tests. Playwright starts a production preview on port 4173. On Linux, `npx playwright install --with-deps chromium` also installs required system libraries. To use an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

For a production preview without the full test run:

```sh
npm run build
npm run preview -- --port 4173
```

The static output is in `dist/`. See the [deployment and rollback guide](docs/deployment.md) for GitHub Pages and archive deployment. Versioned downloads will be listed on the [v1.0.0 release page](https://github.com/mmkolpakov/Geometry-System/releases/tag/v1.0.0) after publication; this README does not yet point to a verified hosted demo.

## What the models mean

Geometry uses two-dimensional spaces of constant curvature. These experiments do not determine the shape of the Universe or model relativistic spacetime. Three-body motion uses Newtonian point masses in dimensionless units; the observer is fixed, with no planet, eclipses or climate model. The projection experiment changes the view of 3D points, not the dimension of physical space.

ODEX handles numerical integration, d3-geo supplies spherical operations, and gl-matrix supplies rotations. Close approaches or excessive energy drift stop a run. A small energy drift alone does not establish coordinate accuracy; visible trajectory separation alone does not establish chaos. The [scientific contract](docs/research/science.md) and [numerical comparison](docs/acceptance/numerical-reference.md) give the assumptions and checks.

## Find the evidence or contribute

| Purpose | Documents |
| --- | --- |
| Plan a session | [Seven-minute demonstration](docs/demo.md), [roles and tasks](docs/research/acceptance-personas.md) |
| Trace a book motif to a model | [Literary and scientific traceability](docs/research/traceability.md), [spoiler policy](docs/research/spoiler-policy.md) |
| Understand the audience and language choices | [Book and adaptation evidence](docs/research/audience-popularity.md), [design system](docs/research/design-system.md), [Chinese adaptation](docs/research/localization.md) |
| Review this release | [RAPID decision](docs/acceptance/rapid-decision.md), [science](docs/acceptance/rapid-science.md), [UX](docs/acceptance/rapid-ux.md), [teaching scenarios](docs/acceptance/rapid-teaching.md) |
| Change or maintain the code | [Kanban and acceptance rules](docs/process.md), [backlog](docs/backlog.md), [dependencies](docs/research/dependencies.md), [maintenance review](docs/research/maintenance-cost.md) |

Release acceptance uses **RAPID**: one recommendation owner, one decision owner, independent science and UX reviewers, and implementation and audience inputs. The linked reports record expert checks performed by agents. They do not report user interviews, measured learning outcomes, native-language editing or tests on physical mobile devices and screen readers. A [participant-study template](docs/acceptance/audience-pilot.md) remains available for future research.

Code is organised by responsibility: `src/domain/` contains model calculations, `src/features/` the experiments, `src/content/` the lessons and translations, and `src/state/` URL validation and local progress. Keep scientific changes tied to an assumption, a source and a reproducible check.

Licensed under [MIT](LICENSE). Dependency notices are generated into `dist/THIRD_PARTY_NOTICES.txt` during the build. Kontur is an independent educational project, not an official adaptation of the books or television series.
