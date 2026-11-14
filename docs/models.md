# Models and numerical methods

Kontur uses small, explicit models for six interactive experiments. The geometry and motion calculations are independent of the SVG views. Measurements come from model coordinates, not screen pixels.

## Constant-curvature geometry

The geometry lab uses curvature radius R = 1. Lengths are in units of R, areas in R², and the interface displays angles in degrees. The size control selects a symmetric triangle; it is not a general drawing tool.

| Space | Metric | Curvature |
| --- | --- | --- |
| Euclidean plane | ds² = dx² + dy² | K = 0 |
| Sphere | ds² = dθ² + sin²θ dφ² | K = +1 |
| Poincaré disk, x² + y² < 1 | ds² = 4(dx² + dy²) / (1 − x² − y²)² | K = −1 |

For these simple geodesic triangles, α + β + γ − π = K A, with angles in radians and area A. On the sphere, sides follow short great-circle arcs. The maximum-size preset is an octant: each angle is π/2, the sum is 3π/2 (270°), and the area is π/2. The Euclidean sum remains π.

The Poincaré disk is conformal: local angles match the drawing, while distances do not. Its circular boundary is excluded and lies infinitely far away in the model metric. Geodesics are diameters or circle arcs orthogonal to the boundary. These two-dimensional models do not determine the shape of the Universe or model relativistic spacetime.

[d3-geo](https://d3js.org/d3-geo/math) supplies spherical distance, interpolation and area. The disk adapter and geometric measurements are in [`src/domain/geometry.ts`](../src/domain/geometry.ts). References: [spherical triangles](https://mathworld.wolfram.com/SphericalTriangle.html), [Poincaré disk](https://mathworld.wolfram.com/PoincareHyperbolicDisk.html), [Gauss–Bonnet theorem](https://mathworld.wolfram.com/Gauss-BonnetFormula.html).

## Three-body motion

The lab has three equal point masses, m = 1, with G = 1 and motion restricted to a plane. Units are dimensionless. For body i:

```text
dr_i/dt = v_i
dv_i/dt = Σ(j ≠ i) m_j (r_j − r_i) / |r_j − r_i|³
E = ½ Σ_i m_i |v_i|² − Σ_(i < j) m_i m_j / |r_j − r_i|
```

The presets are the rotating equilateral Lagrange solution, a figure-eight orbit, and an asymmetric initial state. Exact initial coordinates and velocities are in [`createSystem`](../src/domain/nbody.ts). The comparison adds Δvₓ to the first body’s initial velocity, then subtracts the mean position and velocity to restore the barycentric frame. Bodies with the same index are compared at the same time:

```text
RMS(t) = √(Σ_i |r_i(t) − r′_i(t)|² / 3)
energy drift = (E(t) − E(0)) / |E(0)|
```

[ODEX](https://github.com/littleredcomputer/odex-js) performs adaptive Gragg–Bulirsch–Stoer integration with absolute and relative tolerances of 10⁻⁹ and maximum internal step 0.05. The UI calculates t = 0…20, requests output every 0.004, and retains every ninth result plus the final sample. “Step” advances one retained frame, usually 0.036 model-time units; it does not select the integrator’s internal step.

A separation below 0.03 or absolute relative energy drift above 1% stops the run. There is no collision, merger or gravitational softening model. A small energy drift does not establish coordinate accuracy, and separation of nearby trajectories over this interval does not by itself establish chaos. The special periodic presets do not describe every three-body system.

The figure-eight values follow [Richard Montgomery’s published initial conditions](https://people.ucsc.edu/~rmont/NbdyB.html), with all velocities reversed to traverse the same orbit backward. The existence proof is [Chenciner and Montgomery, *Annals of Mathematics*](https://annals.math.princeton.edu/articles/12364). [Alain Chenciner’s overview](https://www.scholarpedia.org/article/Three_body_problem) describes the broader problem. Local numerical checks are in [`nbody.test.ts`](../src/domain/nbody.test.ts).

## Fixed observer

The observer is fixed at q = (0, −4) in the barycentric inertial frame. For each source, the azimuth is atan2(x − qₓ, y − qᵧ), measured from +y toward +x and wrapped to [0°, 360°). Relative irradiance is F = Σ_i 1/|r_i − q|², normalized so one source at unit distance contributes 1.

Sources have equal constant luminosity, with isotropic propagation through three-dimensional free space; only their motion is planar. Light-travel time, absorption, stellar radii, eclipses, an orbiting planet and climate are omitted. The angular display is a diagram of directions, not a photograph of the sky. See [`observer.ts`](../src/domain/observer.ts).

## Projection

Two stationary points A = (0, 0, −1) and B = (0, 0, 1) are rotated about the y-axis through θ, then projected by π(x, y, z) = (x, y). Their three-dimensional distance stays 2; their projected separation is 2|sin θ|.

[gl-matrix](https://glmatrix.net/) supplies the rotation. The calculation illustrates loss of depth in an image; it does not change the dimension of the original space or model a physical dimensional collapse. See [`DimensionDemo.tsx`](../src/features/DimensionDemo.tsx).
