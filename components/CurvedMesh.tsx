import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationState } from '../types';
import { CURVATURE_COMMON } from '../constants';
import { getPlanetPositions } from '../utils/physics';

interface CurvedMeshProps {
  state: SimulationState;
  position?: [number, number, number];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scale?: number | [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
  as?: 'mesh' | 'points' | 'line';
  children?: React.ReactNode;
}

/**
 * Higher-Order Component that patches any material with Spacetime Curvature logic.
 * Ensures objects (Planets, Rings, Grids) deform visually based on the FLRW metric and Gravity Wells.
 */
export const CurvedMesh: React.FC<CurvedMeshProps> = ({ 
    state, 
    position = [0,0,0], 
    geometry, 
    material, 
    scale = 1, 
    rotation = [0,0,0], 
    renderOrder, 
    as = 'mesh', 
    children 
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const uniformsRef = useRef<any>({});
    
    const customMaterial = useMemo(() => {
        const mat = material.clone();
        
        mat.onBeforeCompile = (shader) => {
            // 1. Inject Uniforms
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uOmega = { value: state.omega };
            shader.uniforms.uChaos = { value: 0 };
            shader.uniforms.uChaosSpeed = { value: 1 };
            shader.uniforms.uExaggeration = { value: 2.0 };
            shader.uniforms.uGravPos = { value: new Array(6).fill(new THREE.Vector2(0,0)) };
            shader.uniforms.uGravMass = { value: new Array(6).fill(0.0) };
            shader.uniforms.uSunMass = { value: 0.0 };
            
            uniformsRef.current = shader.uniforms;

            // 2. Inject Helper Functions (Curvature Math)
            shader.vertexShader = `
                ${CURVATURE_COMMON}
                ${shader.vertexShader}
            `;

            // 3. Inject WORLD SPACE Displacement logic
            // We intercept <project_vertex> to apply offset to WorldPosition.y (Universe Z)
            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `
                vec4 curvedWorldPos = modelMatrix * vec4( transformed, 1.0 );
                
                // Map World Coords to Universe Plane Coords
                // Universe Plane is rotated -90 deg X.
                // Plane X = World X
                // Plane Y = World -Z
                vec2 universePlaneCoords = vec2(curvedWorldPos.x, -curvedWorldPos.z);
                
                float curvZ = getCurvature(universePlaneCoords);
                
                // Apply Curvature to World Y (Universe Height)
                curvedWorldPos.y += curvZ;
                
                vec4 mvPosition = viewMatrix * curvedWorldPos;
                gl_Position = projectionMatrix * mvPosition;
                `
            );
        };
        return mat;
    }, [geometry]); // Re-create if geometry changes (rare)

    useFrame((rootState) => {
        if (uniformsRef.current.uTime) {
            const time = rootState.clock.elapsedTime;
            
            // Sync Uniforms
            uniformsRef.current.uTime.value = time;
            uniformsRef.current.uOmega.value = state.omega;
            uniformsRef.current.uChaos.value = state.chaosMode ? 1.0 : 0.0;
            uniformsRef.current.uChaosSpeed.value = state.chaosSpeed;

            // Sync Gravity Wells
            const { positions, masses } = getPlanetPositions(time);
            uniformsRef.current.uGravPos.value = positions;
            
            if (state.enableGravity) {
                uniformsRef.current.uGravMass.value = masses.map(m => m * (0.5 + state.precision * 0.5));
                uniformsRef.current.uSunMass.value = 1.5 * (0.5 + state.precision * 0.5);
            } else {
                uniformsRef.current.uGravMass.value = new Array(6).fill(0.0);
                uniformsRef.current.uSunMass.value = 0.0;
            }
        }
    });

    const Component = as as any;

    return (
        <Component 
            ref={meshRef} 
            position={position} 
            rotation={new THREE.Euler(...rotation)}
            scale={scale}
            geometry={geometry}
            material={customMaterial}
            renderOrder={renderOrder}
            castShadow
            receiveShadow
        >
          {children}
        </Component>
    );
};