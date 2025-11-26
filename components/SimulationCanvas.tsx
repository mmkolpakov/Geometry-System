
import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationState } from '../types';
import { 
    UNIVERSE_FRAGMENT_SHADER, 
    UNIVERSE_VERTEX_SHADER, 
    CURVATURE_COMMON,
    ATMOSPHERE_VERTEX_SHADER,
    ATMOSPHERE_FRAGMENT_SHADER,
    SUN_SURFACE_VERTEX_SHADER,
    SUN_SURFACE_FRAGMENT_SHADER
} from '../constants';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface SimulationCanvasProps {
  state: SimulationState;
  setZoom: (zoom: number) => void;
}

// --- DATA ---

interface PlanetData {
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

const PLANETS: PlanetData[] = [
  // Sun is handled separately
  { name: 'Mercury', radius: 0.15, color: '#A5A5A5', orbit: { a: 3.0, e: 0.205, speed: 1.5 }, mass: 0.2 },
  { name: 'Venus', radius: 0.25, color: '#E39C4E', orbit: { a: 4.5, e: 0.007, speed: 1.2 }, atmosphere: '#ffcc99', mass: 0.4 },
  { name: 'Earth', radius: 0.28, color: '#4F4CB0', orbit: { a: 6.5, e: 0.017, speed: 1.0 }, atmosphere: '#4facfe', mass: 0.5 },
  { name: 'Mars', radius: 0.22, color: '#C1440E', orbit: { a: 8.5, e: 0.094, speed: 0.8 }, mass: 0.3 },
  { name: 'Jupiter', radius: 0.8, color: '#C99039', orbit: { a: 12.0, e: 0.049, speed: 0.5 }, mass: 1.2 },
  { name: 'Saturn', radius: 0.7, color: '#EAD6B8', orbit: { a: 16.0, e: 0.056, speed: 0.35 }, hasRing: true, mass: 1.0 },
];

const getEllipsePos = (angle: number, a: number, e: number) => {
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e;
    const x = a * Math.cos(angle) - c;
    const y = b * Math.sin(angle);
    return new THREE.Vector3(x, y, 0);
};

// Helper to get all current planet positions for the Physics/Gravity engine
const getPlanetPositions = (time: number) => {
    const positions: THREE.Vector2[] = [];
    const masses: number[] = [];
    
    PLANETS.forEach(p => {
        const angle = time * p.orbit.speed * 0.5; // Sync with Planet component
        const pos = getEllipsePos(angle, p.orbit.a, p.orbit.e);
        positions.push(new THREE.Vector2(pos.x, pos.y));
        masses.push(p.mass);
    });
    return { positions, masses };
};

// --- MATH HELPERS (CPU) ---

const getSurfaceZ = (x: number, y: number, state: SimulationState, time: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    
    const EXAGGERATION = 2.0;
    const nx = x / 10.0;
    const ny = y / 10.0;
    const distSq = nx*nx + ny*ny;
    
    let z = 0.0;
    const omega = Number.isFinite(state.omega) ? state.omega : 1.0;

    // 1. FLRW Curvature Logic
    if (omega > 1.02) {
         const factor = (omega - 1.0) * 2.0 * EXAGGERATION;
         z -= factor * (distSq * 2.0); 
    } else if (omega < 0.98) {
         const factor = (1.0 - omega) * 2.0 * EXAGGERATION;
         z += factor * (nx*nx - ny*ny) * 2.0;
    }
    
    // 2. Chaos Mode Logic
    if (state.chaosMode) {
         const speed = Number.isFinite(state.chaosSpeed) ? state.chaosSpeed : 1.0;
         const t = time * speed;
         let chaos = Math.sin(x * 0.5 + t) * Math.sin(y * 0.5 + t) * 0.5;
         chaos += Math.sin(x * 1.5 - t * 0.5) * 0.25;
         chaos += Math.cos(y * 1.5 + t * 0.5) * 0.25;
         const len = Math.sqrt(x*x + y*y);
         chaos += Math.sin(len * 0.3 - t * 2.0) * 0.1;
         
         z += chaos * EXAGGERATION;
    }

    // 3. Gravity Wells (CPU Side for Ant Camera)
    if (state.enableGravity) {
        // Planets
        const { positions, masses } = getPlanetPositions(time);
        for(let i=0; i<positions.length; i++) {
            const dx = x - positions[i].x;
            const dy = y - positions[i].y;
            const dSq = dx*dx + dy*dy;
            const m = masses[i] * (0.5 + state.precision * 0.5); 
            if (m > 0) {
                // Wide well coeff 0.1 to match shader
                z -= m * Math.exp(-dSq * 0.1);
            }
        }
        
        // Sun (0,0)
        const dSqSun = x*x + y*y;
        // Sun Mass approx 1.5 relative to planets for visual
        const sunMass = 1.5 * (0.5 + state.precision * 0.5);
        z -= sunMass * Math.exp(-dSqSun * 0.05);
    }
    
    if (isNaN(z)) return 0;
    return z;
};

// --- COMPONENTS ---

const UniverseMesh: React.FC<{ state: SimulationState }> = ({ state }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const EXAGGERATION = 2.0;

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
      
      // Update Gravity Wells
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

// --- CURVED MATERIAL WRAPPER ---
// Uses World Space displacement to handle rotated objects (like Rings) correctly
const CurvedMesh: React.FC<{
  state: SimulationState;
  position?: [number, number, number];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scale?: number | [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
  as?: 'mesh' | 'points' | 'line';
  children?: React.ReactNode;
}> = ({ state, position = [0,0,0], geometry, material, scale = 1, rotation = [0,0,0], renderOrder, as = 'mesh', children }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const uniformsRef = useRef<any>({});
    
    const customMaterial = useMemo(() => {
        const mat = material.clone();
        
        mat.onBeforeCompile = (shader) => {
            // Inject Uniforms
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uOmega = { value: state.omega };
            shader.uniforms.uChaos = { value: 0 };
            shader.uniforms.uChaosSpeed = { value: 1 };
            shader.uniforms.uExaggeration = { value: 2.0 };
            shader.uniforms.uGravPos = { value: new Array(6).fill(new THREE.Vector2(0,0)) };
            shader.uniforms.uGravMass = { value: new Array(6).fill(0.0) };
            shader.uniforms.uSunMass = { value: 0.0 };
            
            uniformsRef.current = shader.uniforms;

            // Inject Functions
            shader.vertexShader = `
                ${CURVATURE_COMMON}
                ${shader.vertexShader}
            `;

            // Inject WORLD SPACE Displacement
            // We intercept <project_vertex> to apply offset to WorldPosition.y
            // We rename worldPosition to curvedWorldPos to avoid redefinition conflicts
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
    }, [geometry]); 

    useFrame((rootState) => {
        if (uniformsRef.current.uTime) {
            const time = rootState.clock.elapsedTime;
            uniformsRef.current.uTime.value = time;
            uniformsRef.current.uOmega.value = state.omega;
            uniformsRef.current.uChaos.value = state.chaosMode ? 1.0 : 0.0;
            uniformsRef.current.uChaosSpeed.value = state.chaosSpeed;

            // Update Gravity Wells
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

// --- GEOMETRIC SHAPES ---

const VolumetricGrid: React.FC<{ state: SimulationState }> = ({ state }) => {
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

const TriangleOverlay: React.FC<{ state: SimulationState }> = ({ state }) => {
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

const PyramidOverlay: React.FC<{ state: SimulationState }> = ({ state }) => {
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
        depthTest: false, // DISABLE DEPTH TEST to prevent clipping by the grid
        side: THREE.DoubleSide,
    }), [state.colorTheme]);

    return (
        <CurvedMesh 
            state={state}
            position={[5, -5, 0]} 
            rotation={[Math.PI / 2, 0, 0]} 
            geometry={geometry}
            material={material}
            renderOrder={999} // Force render on top
        />
    )
}

const OrbitPath: React.FC<{ planet: PlanetData, state: SimulationState }> = ({ planet, state }) => {
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
            position={[0,0,0]}
            geometry={geometry}
            material={material}
        />
    );
};

const Sun: React.FC<{ state: SimulationState }> = ({ state }) => {
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
                materialRef.current.uniforms.uGravMass.value = masses.map(m => m * (0.5 + state.precision * 0.5));
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
};

// A dynamic PointLight that follows the Sun's Z-displacement
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

// Wrapper to animate the Moon
const MoonContainer: React.FC<{ state: SimulationState }> = ({ state }) => {
    const groupRef = useRef<THREE.Group>(null);
    const orbitRadius = 0.8;
    
    useFrame((rootState, delta) => {
        if (groupRef.current) {
            // Animate local position of the moon
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
    
    // Orbit Line
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
            
            <CurvedMesh state={state} geometry={orbitLineGeometry} material={orbitLineMaterial} as="line" />
        </>
    )
}


const Planet: React.FC<{ data: PlanetData; state: SimulationState }> = ({ data, state }) => {
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

        // 1. Move the SYSTEM Group along the orbit (Translation)
        // CRITICAL: We use exact same math as getPlanetPositions for perfect Gravity Well sync
        if (systemGroupRef.current) {
             const angle = time * data.orbit.speed * 0.5;
             const pos = getEllipsePos(angle, data.orbit.a, data.orbit.e);
             systemGroupRef.current.position.set(pos.x, pos.y, 0);
        }
        
        // 2. Rotate the BODY Group (Axial Spin)
        if (bodyGroupRef.current) {
            bodyGroupRef.current.rotation.z = time; // Simple spin
        }
    });

    const ringGeometry = useMemo(() => {
        // Updated resolution for flexible curvature (128 radial, 16 phi)
        return new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.2, 128, 16);
    }, [data.radius]);
    
    const ringMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: '#Ceb898', side: THREE.DoubleSide, transparent: true, opacity: 0.8 
    }), []);

    // ATMOSPHERE - Manually injecting curvature via ShaderMaterial prop in constants.tsx
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

    // Update Atmosphere Uniforms
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
                 atmosphereMaterial.uniforms.uGravMass.value = masses.map(m => m * (0.5 + state.precision * 0.5));
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
                
                {/* 1. PLANET BODY (Rotates) */}
                <group ref={bodyGroupRef}>
                    <CurvedMesh 
                        state={state} 
                        geometry={geometry} 
                        material={material} 
                    />
                </group>

                {/* 2. NON-ROTATING CHILDREN (Attached to System) */}

                {/* Atmosphere */}
                {data.atmosphere && atmosphereMaterial && (
                     <mesh geometry={atmoGeometry} material={atmosphereMaterial} />
                )}

                {/* Moon - Attached to System, so it translates with Earth but doesn't spin wildly */}
                {data.name === 'Earth' && <MoonContainer state={state} />}

                {/* Ring - Uses CurvedMesh to bend, attached to System (usually rings don't spin with surface visually) */}
                {data.hasRing && (
                    <CurvedMesh 
                        state={state}
                        geometry={ringGeometry}
                        material={ringMaterial}
                        rotation={[Math.PI/4, 0, 0]} // Tilt the ring slightly
                    />
                )}
            </group>
        </>
    )
}

const SolarSystem: React.FC<{ state: SimulationState }> = ({ state }) => {
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
}

const CameraController: React.FC<{ state: SimulationState, setZoom: (z: number) => void }> = ({ state, setZoom }) => {
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
                    enableZoom={true}
                    enableRotate={true}
                    maxPolarAngle={Math.PI / 1.5}
                    minDistance={5}
                    maxDistance={50}
                    onChange={onControlsChange}
                />
            )}
        </>
    );
};

const EarthViewController: React.FC<{ state: SimulationState }> = ({ state }) => {
    useFrame((rootState) => {
        if (!state.antMode) return;
        const time = rootState.clock.elapsedTime;
        const earth = PLANETS.find(p => p.name === 'Earth');
        if (!earth) return;

        // Orbit Logic (Matches Planet Logic)
        const angle = time * earth.orbit.speed * 0.5;
        const pos = getEllipsePos(angle, earth.orbit.a, earth.orbit.e);
        
        // Physics Height
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

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ state, setZoom }) => {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ 
            antialias: true, 
            powerPreference: "high-performance",
        }}
      >
        <CameraController state={state} setZoom={setZoom} />
        <EarthViewController state={state} />
        
        <ambientLight intensity={state.colorTheme === 'cosmic' ? 0.2 : 0.4} />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        <group rotation={[-Math.PI / 2, 0, 0]}>
            <UniverseMesh state={state} />
            <VolumetricGrid state={state} />
            <TriangleOverlay state={state} />
            <PyramidOverlay state={state} />
            <SolarSystem state={state} />
        </group>
      </Canvas>
    </div>
  );
};
