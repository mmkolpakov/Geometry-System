import { describe, it, expect } from 'vitest';
import { getSurfaceZ, getEllipsePos } from './physics';
import { SimulationState } from '../types';

// Mock State
const mockState: SimulationState = {
    omega: 1.0,
    chaosMode: false,
    chaosSpeed: 1.0,
    precision: 0.5,
    enableGravity: false,
    showUniverseGrid: true,
    showGeometry: true,
    show3DFigure: false,
    showCelestial: true,
    showTrajectories: true,
    showVolumetricGrid: false,
    colorTheme: 'scientific',
    antMode: false,
    zoom: 1
};

describe('Physics Utils', () => {
    describe('getEllipsePos', () => {
        it('should calculate correct position at angle 0', () => {
            // a=10, e=0 (circle)
            const pos = getEllipsePos(0, 10, 0);
            expect(pos.x).toBeCloseTo(10);
            expect(pos.y).toBeCloseTo(0);
        });

        it('should calculate correct position at angle PI', () => {
            // a=10, e=0
            const pos = getEllipsePos(Math.PI, 10, 0);
            expect(pos.x).toBeCloseTo(-10);
            expect(pos.y).toBeCloseTo(0);
        });

        it('should handle eccentricity', () => {
            // a=10, e=0.5
            // c = a*e = 5
            // x = a*cos(0) - c = 10 - 5 = 5
            const pos = getEllipsePos(0, 10, 0.5);
            expect(pos.x).toBeCloseTo(5);
        });
    });

    describe('getSurfaceZ', () => {
        it('should return 0 for flat universe (Omega=1)', () => {
            const z = getSurfaceZ(5, 5, mockState, 0);
            expect(z).toBeCloseTo(0);
        });

        it('should return 0 when inputs are invalid', () => {
            const z = getSurfaceZ(NaN, 0, mockState, 0);
            expect(z).toBe(0);
        });

        it('should return positive curvature for Open Universe (Omega < 1)', () => {
            // Hyperbolic/Saddle
            const openState = { ...mockState, omega: 0.5 };
            // Formula involves (x^2 - y^2)
            // at x=10, y=0 -> z should be positive
            const z = getSurfaceZ(10, 0, openState, 0);
            expect(z).toBeGreaterThan(0);
        });
    });
});