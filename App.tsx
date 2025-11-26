
import React, { useState } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { Controls } from './components/Controls';
import { SimulationState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>({
    omega: 1.0,
    chaosMode: false,
    chaosSpeed: 1.0,
    precision: 0.5,
    showGeometry: true,
    show3DFigure: false,
    showCelestial: true,
    showTrajectories: true,
    colorTheme: 'scientific',
    antMode: false,
    zoom: 1,
  });

  const updateState = (partial: Partial<SimulationState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };
  
  const setZoom = (z: number) => {
      // Clamp values strictly to prevent NaN or extreme zooms
      if (!isFinite(z)) return;
      const clamped = Math.min(Math.max(z, 0.2), 3.0);
      setState(prev => ({...prev, zoom: clamped}));
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <SimulationCanvas state={state} setZoom={setZoom} />
      <Controls state={state} updateState={updateState} />
    </div>
  );
};

export default App;
