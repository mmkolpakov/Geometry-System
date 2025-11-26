import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationState } from '../types';
import { CurvedMesh } from './CurvedMesh';
import { UNIVERSE_VERTEX_SHADER, UNIVERSE_FRAGMENT_SHADER } from '../constants';
import { getPlanetPositions, getSurfaceZ, EXAGGERATION } from '../utils/physics';

export const UniverseMesh: React.FC<{ state: SimulationState }> = ({ state }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOmega: { value: state.omega },
      uChaos: { value: state.chaosMode ? 1.0 : 0.0 },
      uChaosSpeed: { value: state.chaosSpeed },
      uExaggeration: { value: EXAGGERATION },
      uGridVisible: { value: 1.0 },
      uColor: { value: new THREE.Color('#4f46e5') },
      uOpacity: { value: 0.6 },
      uColorMode: { value: 0.0 },
      uGravPos: { value: new Array(6).fill(new THREE.Vector2(0,0)) },
      uGravMass: { value: new Array(6).fill(0.0) },
      uSunMass: { value: 0.0 }
    }),
    []
  );

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uOmega.value = state.omega;
      materialRef.current.uniforms.uChaos.value = state.chaosMode ? 1.0 : 0.0;
      materialRef.current.uniforms.uChaosSpeed.value = state.chaosSpeed;
      materialRef.current.uniforms.uColorMode.value = state.colorTheme === 'cosmic' ? 1.0 : 0.0;

      if (state.omega < 0.98) materialRef.current.uniforms.uColor.value.set('#ef4444');
      else if (state.omega > 1.02) materialRef.current.uniforms.uColor.value.set('#3b82f6');
      else materialRef.current.uniforms.uColor.value.set('#10b981');
    }
  }, [state]);

  useFrame((rootState) => {
    if (materialRef.current) {
      const time = rootState.clock.elapsedTime;
      materialRef.current.uniforms.uTime.value = time;

      const { positions, masses } = getPlanetPositions(time);
      materialRef.current.uniforms.uGravPos.value = positions;

      if (state.enableGravity) {
          materialRef.current.uniforms.uGravMass.value = masses.map(m => m * (0.5 + state.precision * 0.5));
          materialRef.current.uniforms.uSunMass.value = 1.5 * (0.5 + state.precision * 0.5);
      } else {
          materialRef.current.uniforms.uGravMass.value = new Array(6).fill(0.0);
          materialRef.current.uniforms.uSunMass.value = 0.0;
      }
    }
  });

  if (!state.showUniverseGrid) return null;

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[60, 60, 256, 256]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={UNIVERSE_VERTEX_SHADER}
        fragmentShader={UNIVERSE_FRAGMENT_SHADER}
        transparent
        side={THREE.DoubleSide}
        uniforms={uniforms}
        polygonOffset={true}
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
};

export const VolumetricGrid: React.FC<{ state: SimulationState }> = ({ state }) => {
    if (!state.showVolumetricGrid) return null;

    const geometry = useMemo(() => {
        const points = [];
        const range = 40;
        const step = 4;
        for (let x = -range; x <= range; x += step) {
            for (let y = -range; y <= range; y += step) {
                for (let z = -10; z <= 10; z += 5) {
                    if (z === 0) continue; 
                    points.push(x, y, z); 
                }
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        return geo;
    }, []);

    const material = useMemo(() => new THREE.PointsMaterial({
        color: state.colorTheme === 'cosmic' ? '#22d3ee' : '#6366f1',
        size: 0.15,
        transparent: true,
        opacity: 0.5
    }), [state.colorTheme]);

    return (
        <CurvedMesh 
            state={state}
            geometry={geometry}
            material={material}
            as="points"
        />
    )
}

export const TriangleOverlay: React.FC<{ state: SimulationState }> = ({ state }) => {
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const MAX_SEGMENTS = 150;
    const SEGMENTS_PER_EDGE = Math.min(Math.floor(30 + state.precision * 70), MAX_SEGMENTS);

    const geometry = useMemo(() => {
      const geo = new THREE.BufferGeometry();
      const maxVerts = (MAX_SEGMENTS * 3 + 10) * 3; 
      const vertices = new Float32Array(maxVerts * 3); 
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      return geo;
    }, []);

    useFrame((rootState) => {
        if (!geometryRef.current) return;
        const posAttr = geometryRef.current.getAttribute('position');
        if (!posAttr) return;
        
        const positions = posAttr.array as Float32Array;
        const time = rootState.clock.elapsedTime;
        const p1 = new THREE.Vector2(0, 3);
        const p2 = new THREE.Vector2(-3, -2);
        const p3 = new THREE.Vector2(3, -2);
        let ptr = 0;
        const MAX_PTR = positions.length;

        const drawEdge = (start: THREE.Vector2, end: THREE.Vector2) => {
            for (let i = 0; i < SEGMENTS_PER_EDGE; i++) {
                if (ptr >= MAX_PTR - 3) break;
                const t = i / SEGMENTS_PER_EDGE;
                const x = THREE.MathUtils.lerp(start.x, end.x, t);
                const y = THREE.MathUtils.lerp(start.y, end.y, t);
                const z = getSurfaceZ(x, y, state, time);
                
                if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
                    positions[ptr++] = x;
                    positions[ptr++] = y;
                    positions[ptr++] = z + 0.1;
                }
            }
        };

        drawEdge(p1, p2);
        drawEdge(p2, p3);
        drawEdge(p3, p1);
        const zClosing = getSurfaceZ(p1.x, p1.y, state, time);
        if (ptr < MAX_PTR - 3 && Number.isFinite(zClosing)) {
            positions[ptr++] = p1.x;
            positions[ptr++] = p1.y;
            positions[ptr++] = zClosing + 0.1;
        }
        
        posAttr.needsUpdate = true;
        geometryRef.current.setDrawRange(0, ptr / 3);
    });

    if (!state.showGeometry) return null;
    return (
        <line>
            <primitive object={geometry} attach="geometry" ref={geometryRef} />
            <lineBasicMaterial color={state.colorTheme === 'cosmic' ? '#22d3ee' : '#fbbf24'} linewidth={3} />
        </line>
    )
}

export const PyramidOverlay: React.FC<{ state: SimulationState }> = ({ state }) => {
    if (!state.show3DFigure) return null;
    
    const geometry = useMemo(() => {
        const segmentsHeight = Math.floor(10 + state.precision * 40);
        return new THREE.ConeGeometry(2, 3, 4, segmentsHeight, true);
    }, [state.precision]);
    
    const material = useMemo(() => new THREE.MeshBasicMaterial({ 
        color: state.colorTheme === 'cosmic' ? '#f472b6' : '#6366f1', 
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        depthTest: true, 
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1 // Pull towards camera slightly
    }), [state.colorTheme]);

    return (
        <CurvedMesh 
            state={state}
            position={[5, -5, 0]} 
            rotation={[Math.PI / 2, 0, 0]} 
            geometry={geometry}
            material={material}
        />
    )
}