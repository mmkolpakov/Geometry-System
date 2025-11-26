import * as THREE from 'three';
import { SimulationState } from '../types';

// --- CONSTANTS ---
export const EXAGGERATION = 2.0;
export const GRAVITY_WELL_WIDTH = 0.1; // Coeff for planet gravity wells
export const SUN_GRAVITY_WIDTH = 0.05; // Coeff for sun gravity well
export const UNIVERSE_SCALE = 10.0; // Denominator for grid scaling

// --- TYPES ---
export interface PlanetData {
    name: string;
    radius: number;
    color: string;
    orbit: {
        a: number; // Semi-major axis
        e: number; // Eccentricity
        speed: number;
    };
    hasRing?: boolean;
    atmosphere?: string;
    mass: number; // For gravity wells
}

// --- DATA SOURCE ---
export const PLANETS: PlanetData[] = [
  { name: 'Mercury', radius: 0.15, color: '#A5A5A5', orbit: { a: 3.0, e: 0.205, speed: 1.5 }, mass: 0.2 },
  { name: 'Venus', radius: 0.25, color: '#E39C4E', orbit: { a: 4.5, e: 0.007, speed: 1.2 }, atmosphere: '#ffcc99', mass: 0.4 },
  { name: 'Earth', radius: 0.28, color: '#4F4CB0', orbit: { a: 6.5, e: 0.017, speed: 1.0 }, atmosphere: '#4facfe', mass: 0.5 },
  { name: 'Mars', radius: 0.22, color: '#C1440E', orbit: { a: 8.5, e: 0.094, speed: 0.8 }, mass: 0.3 },
  { name: 'Jupiter', radius: 0.8, color: '#C99039', orbit: { a: 12.0, e: 0.049, speed: 0.5 }, mass: 1.2 },
  { name: 'Saturn', radius: 0.7, color: '#EAD6B8', orbit: { a: 16.0, e: 0.056, speed: 0.35 }, hasRing: true, mass: 1.0 },
];

// --- MATH HELPERS ---

/**
 * Calculates the 2D position on an elliptical orbit based on Keplerian parameters.
 */
export const getEllipsePos = (angle: number, a: number, e: number): THREE.Vector3 => {
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e; // Focal distance
    const x = a * Math.cos(angle) - c;
    const y = b * Math.sin(angle);
    return new THREE.Vector3(x, y, 0);
};

/**
 * Calculates the positions and masses of all planets at a given time.
 * Used for Gravity Wells in both CPU (Ant Camera) and GPU (Vertex Shader).
 */
export const getPlanetPositions = (time: number) => {
    const positions: THREE.Vector2[] = [];
    const masses: number[] = [];
    
    PLANETS.forEach(p => {
        const angle = time * p.orbit.speed * 0.5;
        const pos = getEllipsePos(angle, p.orbit.a, p.orbit.e);
        positions.push(new THREE.Vector2(pos.x, pos.y));
        masses.push(p.mass);
    });
    return { positions, masses };
};

/**
 * Calculates the Z-height (Curvature) of the universe at specific coordinates.
 * Implements FLRW metric, Chaos noise, and Gravity Wells.
 */
export const getSurfaceZ = (x: number, y: number, state: SimulationState, time: number): number => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    
    const nx = x / UNIVERSE_SCALE;
    const ny = y / UNIVERSE_SCALE;
    const distSq = nx*nx + ny*ny;
    
    let z = 0.0;
    const omega = Number.isFinite(state.omega) ? state.omega : 1.0;

    // 1. FLRW Metric
    if (omega > 1.02) {
         // Spherical (Closed)
         const factor = (omega - 1.0) * 2.0 * EXAGGERATION;
         z -= factor * (distSq * 2.0); 
    } else if (omega < 0.98) {
         // Hyperbolic (Open)
         const factor = (1.0 - omega) * 2.0 * EXAGGERATION;
         z += factor * (nx*nx - ny*ny) * 2.0;
    }
    
    // 2. Chaos Mode (Early Universe / Gravitational Waves)
    if (state.chaosMode) {
         const speed = Number.isFinite(state.chaosSpeed) ? state.chaosSpeed : 1.0;
         const t = time * speed;
         
         // Multi-layered sine noise
         let chaos = Math.sin(x * 0.5 + t) * Math.sin(y * 0.5 + t) * 0.5;
         chaos += Math.sin(x * 1.5 - t * 0.5) * 0.25;
         chaos += Math.cos(y * 1.5 + t * 0.5) * 0.25;
         const len = Math.sqrt(x*x + y*y);
         chaos += Math.sin(len * 0.3 - t * 2.0) * 0.1;
         
         z += chaos * EXAGGERATION;
    }

    // 3. Gravity Wells (Mass Distortion)
    if (state.enableGravity) {
        // Planets
        const { positions, masses } = getPlanetPositions(time);
        for(let i=0; i<positions.length; i++) {
            const dx = x - positions[i].x;
            const dy = y - positions[i].y;
            const dSq = dx*dx + dy*dy;
            const m = masses[i] * (0.5 + state.precision * 0.5); 
            if (m > 0) {
                z -= m * Math.exp(-dSq * GRAVITY_WELL_WIDTH);
            }
        }
        
        // Sun (at 0,0)
        const dSqSun = x*x + y*y;
        const sunMass = 1.5 * (0.5 + state.precision * 0.5);
        z -= sunMass * Math.exp(-dSqSun * SUN_GRAVITY_WIDTH);
    }
    
    if (isNaN(z)) return 0;
    return z;
};