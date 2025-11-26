import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { SimulationState } from '../types';
import { getEllipsePos, getSurfaceZ, PLANETS } from '../utils/physics';

interface CameraControllerProps {
    state: SimulationState;
    setZoom: (z: number) => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({ state, setZoom }) => {
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const cameraRef = useRef<THREE.Camera>(null);

    useEffect(() => {
        if (!controlsRef.current || !cameraRef.current) return;
        if (!state.antMode) {
             const cam = cameraRef.current as THREE.PerspectiveCamera;
             const dist = 18 / state.zoom;
             const currentDir = new THREE.Vector3().copy(cam.position).sub(controlsRef.current.target).normalize();
             if (currentDir.lengthSq() < 0.01) currentDir.set(0, 1, 1).normalize();
             cam.position.copy(currentDir.multiplyScalar(dist).add(controlsRef.current.target));
             cam.updateProjectionMatrix();
        }
    }, [state.zoom, state.antMode]);

    const onControlsChange = () => {
        if (!controlsRef.current || !cameraRef.current || state.antMode) return;
        const cam = cameraRef.current as THREE.PerspectiveCamera;
        const dist = cam.position.distanceTo(controlsRef.current.target);
        const uiZoom = 18 / dist;
        if (Math.abs(uiZoom - state.zoom) > 0.1) setZoom(uiZoom);
    };

    return (
        <>
            {!state.antMode ? (
                <PerspectiveCamera
                    ref={cameraRef as any}
                    makeDefault
                    position={[0, 15, 15]}
                    fov={50}
                />
            ) : (
                <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={60} />
            )}

            {!state.antMode && (
                <OrbitControls
                    ref={controlsRef}
                    maxPolarAngle={Math.PI / 1.5}
                    minDistance={5}
                    maxDistance={50}
                    onChange={onControlsChange}
                />
            )}
        </>
    );
};

export const EarthViewController: React.FC<{ state: SimulationState }> = ({ state }) => {
    useFrame((rootState) => {
        if (!state.antMode) return;
        const time = rootState.clock.elapsedTime;
        const earth = PLANETS.find(p => p.name === 'Earth');
        if (!earth) return;

        // Orbit Logic
        const angle = time * earth.orbit.speed * 0.5;
        const pos = getEllipsePos(angle, earth.orbit.a, earth.orbit.e);

        // Physics Height (CPU)
        const z = getSurfaceZ(pos.x, pos.y, state, time);

        // World Coordinates (Flip Y to -Z due to scene rotation [-PI/2, 0, 0])
        const worldX = pos.x;
        const worldZ = -pos.y;
        const worldY = z;

        // Tangent (Forward Direction)
        const b = earth.orbit.a * Math.sqrt(1 - earth.orbit.e * earth.orbit.e);
        const dx = -earth.orbit.a * Math.sin(angle);
        const dy = b * Math.cos(angle);
        const tanU = new THREE.Vector2(dx, dy).normalize();

        // Tangent in World Space
        const tanWorld = new THREE.Vector3(tanU.x, 0, -tanU.y);

        // Position Camera above Earth
        const heightOffset = 0.5;
        rootState.camera.position.set(worldX, worldY + heightOffset, worldZ);

        // Look Forward along Orbit
        const target = new THREE.Vector3(worldX, worldY + heightOffset, worldZ).add(tanWorld);

        // Look ahead 1.0 unit to pitch camera correctly with slope
        const lookAheadDist = 1.0;
        const nextX = pos.x + tanU.x * lookAheadDist;
        const nextY = pos.y + tanU.y * lookAheadDist;
        const nextZ = getSurfaceZ(nextX, nextY, state, time);
        target.set(nextX, nextZ + heightOffset, -nextY);

        rootState.camera.lookAt(target);
    });
    return null;
}