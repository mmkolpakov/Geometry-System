# 🌌 Cosmos Curvature Lab

**Interactive visualization of spacetime curvature based on General Relativity and FLRW metrics.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-18-blue)
![TypeScript](https://img.shields.io/badge/typescript-5-blue)

## 🔭 Overview

**Cosmos Curvature Lab** is a scientific educational tool designed to visualize how the mass-energy density of the universe (Ω) affects its geometry. It implements the Friedmann–Lemaître–Robertson–Walker (FLRW) metric alongside Keplerian orbital mechanics and General Relativistic visual effects.

Unlike simple embedding diagrams, this project simulates a "living" universe with:
- **Dynamic Metric**: Switch between Euclidean (Flat), Hyperbolic (Open), and Spherical (Closed) geometries in real-time.
- **Chaos Era**: Simulate primordial gravitational waves and spacetime ripples.
- **Gravity Wells**: Visualize how massive bodies (Sun, Jupiter) locally distort the fabric of space.

## 🎯 Features

*   **FLRW Metric Visualization**:
    *   **Ω = 1**: Flat space (Euclidean geometry, triangle sum = 180°).
    *   **Ω < 1**: Open space (Hyperbolic/Saddle geometry, triangle sum < 180°).
    *   **Ω > 1**: Closed space (Spherical geometry, triangle sum > 180°).
*   **Realistic Solar System**:
    *   Keplerian elliptical orbits (eccentricity supported).
    *   Physical deformation of planets/rings based on curvature.
    *   Volumetric solar corona and atmospheric scattering (Fresnel).
*   **View Modes**:
    *   **God View**: Orbit controls with zoom.
    *   **Earth View**: First-person perspective riding Earth's orbit.
*   **Visual Layers**:
    *   2D Geodesic Triangles.
    *   3D Volumetric Grids.
    *   Orbital Trajectories.
    *   Scientific vs. Cosmic visual themes.

## 🚀 Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/cosmos-curvature-lab.git
    cd cosmos-curvature-lab
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start development server**
    ```bash
    npm run dev
    ```

## 🎮 Controls

| Parameter | Description |
| :--- | :--- |
| **Density (Ω)** | Controls the global curvature (0.5 to 1.5). |
| **Chaos Mode** | Enables time-dependent perturbations (Early Universe). |
| **Gravity** | Toggles local mass distortions around planets. |
| **Precision** | Adjusts mesh resolution (Vertex count). |
| **Earth View** | Locks camera to Earth's tangent vector. |

## 📖 Physics Model

The simulation relies on a custom vertex shader implementation of the FLRW metric embedding:

### 1. Global Curvature (FLRW)
The embedding height `z` is calculated as function of radius `r`:

- **Spherical (Ω > 1)**: `z(r) ≈ ±√(R² - r²)`
- **Hyperbolic (Ω < 1)**: `z(r) ≈ arccosh(r)`

### 2. Local Gravity Wells
Massive bodies create local dips defined by Gaussian wells:

`z_local = -∑ M_i · e^(-k · d_i²)`

### 3. Keplerian Orbits
Planets follow parametric elliptical paths:

```
x = a · cos(E) - c
y = b · sin(E)
```

## 🛠️ Tech Stack

- **Core**: React 18, TypeScript, Vite
- **3D Engine**: Three.js, @react-three/fiber, @react-three/drei
- **Styling**: Tailwind CSS
- **Shaders**: Custom GLSL (Vertex/Fragment)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.