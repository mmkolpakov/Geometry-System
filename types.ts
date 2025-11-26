
export enum UniverseType {
  Open = 'Open (Hyperbolic)',
  Flat = 'Flat (Euclidean)',
  Closed = 'Closed (Spherical)',
}

export interface SimulationState {
  omega: number; // Density parameter
  chaosMode: boolean;
  chaosSpeed: number;
  precision: number; // 0.0 to 1.0
  showGeometry: boolean;
  show3DFigure: boolean; // New: Tetrahedron/Pyramid
  showCelestial: boolean;
  showTrajectories: boolean; // New: Orbit lines
  colorTheme: 'scientific' | 'cosmic'; // New: Visual Style
  antMode: boolean;
  zoom: number;
}

export interface Scientist {
  id: string;
  name: string;
  dates: string;
  contribution: string;
  quote: string;
}

export const SCIENTISTS: Scientist[] = [
  {
    id: 'euclid',
    name: 'Euclid of Alexandria',
    dates: 'Mid-4th century BC',
    contribution: 'Father of Geometry. Established the axioms of flat space where parallel lines never meet and the sum of triangle angles is exactly 180°.',
    quote: "There is no royal road to geometry."
  },
  {
    id: 'lobachevsky',
    name: 'Nikolai Lobachevsky',
    dates: '1792–1856',
    contribution: 'Pioneer of Hyperbolic Geometry. Demonstrated that space can be negatively curved (saddle-shaped), where triangle angles sum to less than 180°.',
    quote: "There is no branch of mathematics, however abstract, which may not some day be applied to phenomena of the real world."
  },
  {
    id: 'riemann',
    name: 'Bernhard Riemann',
    dates: '1826–1866',
    contribution: 'Developed Riemannian Geometry (Elliptic). Laid the groundwork for curved space with positive curvature, where parallel lines meet.',
    quote: "The value of a science consists in the number of ideas which it sets into motion."
  },
  {
    id: 'einstein',
    name: 'Albert Einstein',
    dates: '1879–1955',
    contribution: 'General Relativity. Showed that gravity is not a force, but the curvature of spacetime caused by mass and energy (Ω).',
    quote: "Look deep into nature, and then you will understand everything better."
  }
];
