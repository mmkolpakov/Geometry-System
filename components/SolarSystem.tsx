import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationState } from '../types';
import { CurvedMesh } from './CurvedMesh';
import { getEllipsePos, getPlanetPositions, PLANETS, PlanetData, getSurfaceZ } from '../utils/physics';
import {
    SUN_SURFACE_VERTEX_SHADER,
    SUN_SURFACE_FRAGMENT_SHADER,
    ATMOSPHERE_VERTEX_SHADER,
    ATMOSPHERE_FRAGMENT_SHADER
} from '../constants';

// --- SUB-COMPONENTS ---

const OrbitPath: React.FC<{ planet: PlanetData, state: SimulationState }> = React.memo(({ planet, state }) => {
    const { a, e } = planet.orbit;
    const pointsCount = Math.floor(64 + state.precision * 128);

    const geometry = useMemo(() => {
        if (a === 0) return new THREE.BufferGeometry();

        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= pointsCount; i++) {
            const angle = (i / pointsCount) * Math.PI * 2;
            pts.push(getEllipsePos(angle, a, e));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        curve.closed = true;
        return new THREE.TubeGeometry(curve, pointsCount, 0.03, 8, true);
    }, [a, e, pointsCount]);

    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: state.colorTheme === 'cosmic' ? '#ffffff' : '#888888',
        transparent: true,
        opacity: state.colorTheme === 'cosmic' ? 0.15 : 0.3
    }), [state.colorTheme]);

    return (
        <CurvedMesh
            state={state}
            geometry={geometry}
            material={material}
        />
    );
});

const MoonContainer: React.FC<{ state: SimulationState }> = ({ state }) => {
    const groupRef = useRef<THREE.Group>(null);
    const orbitRadius = 0.8;

    useFrame((rootState) => {
        if (groupRef.current) {
            const time = rootState.clock.elapsedTime;
            const speed = 2.0;
            groupRef.current.position.set(
                Math.cos(time * speed) * orbitRadius,
                Math.sin(time * speed) * orbitRadius,
                0
            );
        }
    });

    const geometry = useMemo(() => new THREE.SphereGeometry(0.08, 16, 16), []);
    const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.8 }), []);

    // Moon Orbit Line
    const orbitLineGeometry = useMemo(() => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius, 0));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
    }, []);
    const orbitLineMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.6, transparent: true }), []);

    return (
        <>
            <group ref={groupRef}>
                <CurvedMesh state={state} geometry={geometry} material={material} />
            </group>
            {state.showTrajectories && (<CurvedMesh state={state} geometry={orbitLineGeometry} material={orbitLineMaterial} as="line"/>)}
        </>
    )
}

const Planet: React.FC<{ data: PlanetData; state: SimulationState }> = React.memo(({ data, state }) => {
    const systemGroupRef = useRef<THREE.Group>(null);
    const bodyGroupRef = useRef<THREE.Group>(null);

    const segments = Math.floor(32 + state.precision * 32);
    const geometry = useMemo(() => new THREE.SphereGeometry(data.radius, segments, segments), [data.radius, segments]);
    const material = useMemo(() => new THREE.MeshStandardMaterial({
        color: data.color,
        roughness: 0.4,
        metalness: 0.2,
    }), [data.color]);

    useFrame((rootState) => {
        const time = rootState.clock.elapsedTime;
        if (systemGroupRef.current) {
             const angle = time * data.orbit.speed * 0.5;
             const pos = getEllipsePos(angle, data.orbit.a, data.orbit.e);
             systemGroupRef.current.position.set(pos.x, pos.y, 0);
        }
        if (bodyGroupRef.current) {
            bodyGroupRef.current.rotation.z = time;
        }
    });

    const ringGeometry = useMemo(() => {
        return new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.2, 128, 16);
    }, [data.radius]);

    const ringMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#Ceb898', side: THREE.DoubleSide, transparent: true, opacity: 0.8
    }), []);

    // Atmosphere Uniform Update Logic
    const atmosphereMaterial = useMemo(() => {
        if (!data.atmosphere) return null;
        return new THREE.ShaderMaterial({
            vertexShader: ATMOSPHERE_VERTEX_SHADER,
            fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
            uniforms: {
                uAtmosphereColor: { value: new THREE.Color(data.atmosphere) },
                uTime: { value: 0 },
                uOmega: { value: state.omega },
                uChaos: { value: 0 },
                uChaosSpeed: { value: 1 },
                uExaggeration: { value: 2.0 },
                uGravPos: { value: new Array(6).fill(new THREE.Vector2(0,0)) },
                uGravMass: { value: new Array(6).fill(0.0) },
                uSunMass: { value: 0.0 }
            },
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }, [data.atmosphere]);

    useFrame((rootState) => {
        if (atmosphereMaterial) {
            const time = rootState.clock.elapsedTime;
            atmosphereMaterial.uniforms.uTime.value = time;
            atmosphereMaterial.uniforms.uOmega.value = state.omega;
            atmosphereMaterial.uniforms.uChaos.value = state.chaosMode ? 1.0 : 0.0;
            atmosphereMaterial.uniforms.uChaosSpeed.value = state.chaosSpeed;
            const { positions, masses } = getPlanetPositions(time);
            atmosphereMaterial.uniforms.uGravPos.value = positions;

            if (state.enableGravity) {
                 atmosphereMaterial.uniforms.uGravMass.value = masses.map((m) => m * (0.5 + state.precision * 0.5));
                 atmosphereMaterial.uniforms.uSunMass.value = 1.5 * (0.5 + state.precision * 0.5);
            } else {
                 atmosphereMaterial.uniforms.uGravMass.value = new Array(6).fill(0.0);
                 atmosphereMaterial.uniforms.uSunMass.value = 0.0;
            }
        }
    });

    const atmoGeometry = useMemo(() => new THREE.SphereGeometry(data.radius * 1.2, 32, 32), [data.radius]);

    return (
        <>
            {state.showTrajectories && data.orbit.a > 0 && (
                <OrbitPath planet={data} state={state} />
            )}
            <group ref={systemGroupRef}>
                <group ref={bodyGroupRef}>
                    <CurvedMesh state={state} geometry={geometry} material={material} />
                </group>

                {data.atmosphere && atmosphereMaterial && (
                     <mesh geometry={atmoGeometry} material={atmosphereMaterial} />
                )}

                {data.name === 'Earth' && <MoonContainer state={state} />}

                {data.hasRing && (
                    <CurvedMesh
                        state={state}
                        geometry={ringGeometry}
                        material={ringMaterial}
                        rotation={[Math.PI/4, 0, 0]}
                    />
                )}
            </group>
        </>
    )
});

const Sun: React.FC<{ state: SimulationState }> = React.memo(({ state }) => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const geometry = useMemo(() => new THREE.SphereGeometry(2.0, 64, 64), []);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uOmega: { value: state.omega },
        uChaos: { value: state.chaosMode ? 1.0 : 0.0 },
        uChaosSpeed: { value: state.chaosSpeed },
        uExaggeration: { value: 2.0 },
        uGravPos: { value: new Array(6).fill(new THREE.Vector2(0,0)) },
        uGravMass: { value: new Array(6).fill(0.0) },
        uSunMass: { value: 0.0 }
    }), []);

    useEffect(() => {
        if(materialRef.current) {
            materialRef.current.uniforms.uOmega.value = state.omega;
            materialRef.current.uniforms.uChaos.value = state.chaosMode ? 1.0 : 0.0;
            materialRef.current.uniforms.uChaosSpeed.value = state.chaosSpeed;
        }
    }, [state]);

    useFrame((rootState) => {
        if (materialRef.current) {
            const time = rootState.clock.elapsedTime;
            materialRef.current.uniforms.uTime.value = time;
             const { positions, masses } = getPlanetPositions(time);
            materialRef.current.uniforms.uGravPos.value = positions;

            if (state.enableGravity) {
                materialRef.current.uniforms.uGravMass.value = masses.map((m) => m * (0.5 + state.precision * 0.5));
                materialRef.current.uniforms.uSunMass.value = 1.5 * (0.5 + state.precision * 0.5);
            } else {
                materialRef.current.uniforms.uGravMass.value = new Array(6).fill(0.0);
                materialRef.current.uniforms.uSunMass.value = 0.0;
            }
        }
    });

    return (
        <mesh position={[0,0,0]}>
            <primitive object={geometry} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={SUN_SURFACE_VERTEX_SHADER}
                fragmentShader={SUN_SURFACE_FRAGMENT_SHADER}
                uniforms={uniforms}
            />
        </mesh>
    );
});

// Dynamic light source tracking the Sun's Z-position
const CurvedPointLight: React.FC<{ state: SimulationState }> = ({ state }) => {
    const lightRef = useRef<THREE.PointLight>(null);
    useFrame((rootState) => {
        if (!lightRef.current) return;
        const time = rootState.clock.elapsedTime;
        const z = getSurfaceZ(0, 0, state, time);
        lightRef.current.position.set(0, 0, z);
    });

    return (
        <pointLight
            ref={lightRef}
            distance={100}
            decay={0}
            intensity={3.5}
            color="#FFF5E0"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
        />
    );
};

export const SolarSystem: React.FC<{ state: SimulationState }> = React.memo(({ state }) => {
    if (!state.showCelestial) return null;
    return (
        <>
            <CurvedPointLight state={state} />
            <Sun state={state} />
            {PLANETS.map((p) => (
                <Planet key={p.name} data={p} state={state} />
            ))}
        </>
    )
});