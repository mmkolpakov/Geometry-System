import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, Loader } from '@react-three/drei';
import { SimulationState } from '../types';
import { SolarSystem } from './SolarSystem';
import { UniverseMesh, VolumetricGrid, TriangleOverlay, PyramidOverlay } from './UniverseRenderers';
import { CameraController, EarthViewController } from './CameraControllers';

interface SimulationCanvasProps {
  state: SimulationState;
  setZoom: (zoom: number) => void;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ state, setZoom }) => {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
            antialias: true
        }}
      >
        <Suspense fallback={null}>
            <CameraController state={state} setZoom={setZoom} />
            <EarthViewController state={state} />

            <ambientLight intensity={state.colorTheme === 'cosmic' ? 0.2 : 0.4} />

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            <group rotation={[-Math.PI / 2, 0, 0]}>
                {/* Structural Elements */}
                <UniverseMesh state={state} />
                <VolumetricGrid state={state} />

                {/* Geometry Overlays */}
                <TriangleOverlay state={state} />
                <PyramidOverlay state={state} />

                {/* Celestial Bodies */}
                <SolarSystem state={state} />
            </group>
        </Suspense>
      </Canvas>
      <Loader />
    </div>
  );
};