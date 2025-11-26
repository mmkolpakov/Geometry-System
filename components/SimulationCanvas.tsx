
import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Float } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationState } from '../types';
import { UNIVERSE_FRAGMENT_SHADER, UNIVERSE_VERTEX_SHADER, CURVATURE_COMMON } from '../constants';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface SimulationCanvasProps {
  state: SimulationState;
  setZoom: (zoom: number) => void;
}

// --- MATH HELPERS (CPU) ---
// Kept in sync with CURVATURE_COMMON in GLSL

const getSurfaceZ = (x: number, y: number, state: SimulationState, time: number) => {
    const EXAGGERATION = 2.0;
    const nx = x / 10.0;
    const ny = y / 10.0;
    const distSq = nx*nx + ny*ny;
    
    let z = 0.0;

    // 1. FLRW Curvature Logic
    if (state.omega > 1.02) {
         const factor = (state.omega - 1.0) * 2.0 * EXAGGERATION;
         z -= factor * (distSq * 2.0); 
    } else if (state.omega < 0.98) {
         const factor = (1.0 - state.omega) * 2.0 * EXAGGERATION;
         z += factor * (nx*nx - ny*ny) * 2.0;
    }
    
    // 2. Chaos Mode Logic
    if (state.chaosMode) {
         const t = time * state.chaosSpeed;
         let chaos = Math.sin(x * 0.5 + t) * Math.sin(y * 0.5 + t) * 0.5;
         chaos += Math.sin(x * 1.5 - t * 0.5) * 0.25;
         chaos += Math.cos(y * 1.5 + t * 0.5) * 0.25;
         const len = Math.sqrt(x*x + y*y);
         chaos += Math.sin(len * 0.3 - t * 2.0) * 0.1;
         
         z += chaos * EXAGGERATION;
    }
    
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

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[20, 20, 256, 256]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={UNIVERSE_VERTEX_SHADER}
        fragmentShader={UNIVERSE_FRAGMENT_SHADER}
        transparent
        side={THREE.DoubleSide}
        uniforms={uniforms}
      />
    </mesh>
  );
};

// --- CURVED MATERIAL WRAPPER ---
// Injects the physics engine into standard materials so they bend with space
const CurvedMesh: React.FC<{
  state: SimulationState;
  position: [number, number, number];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scale?: number | [number, number, number];
  rotation?: [number, number, number];
}> = ({ state, position, geometry, material, scale = 1, rotation = [0,0,0] }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const uniformsRef = useRef<any>({});
    
    // Create a clone of the material to avoid sharing side-effects
    const customMaterial = useMemo(() => {
        const mat = material.clone();
        
        mat.onBeforeCompile = (shader) => {
            // Inject Uniforms
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uOmega = { value: state.omega };
            shader.uniforms.uChaos = { value: 0 };
            shader.uniforms.uChaosSpeed = { value: 1 };
            shader.uniforms.uExaggeration = { value: 2.0 };
            
            // Save reference to update loop
            uniformsRef.current = shader.uniforms;

            // Inject Functions
            shader.vertexShader = `
                ${CURVATURE_COMMON}
                ${shader.vertexShader}
            `;

            // Inject Vertex Displacement
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vec4 worldPosForCheck = modelMatrix * vec4(position, 1.0);
                
                // CRITICAL FIX: Coordinate Mapping
                // Universe Group rotated -90 X.
                // World X = Universe X
                // World Z = -Universe Y
                vec2 universePlaneCoords = vec2(worldPosForCheck.x, -worldPosForCheck.z);
                
                float curvZ = getCurvature(universePlaneCoords);
                transformed.z += curvZ;
                `
            );
        };
        return mat;
    }, [geometry]); 

    // Sync Uniforms
    useFrame((rootState, delta) => {
        if (uniformsRef.current.uTime) {
            uniformsRef.current.uTime.value += delta;
            uniformsRef.current.uOmega.value = state.omega;
            uniformsRef.current.uChaos.value = state.chaosMode ? 1.0 : 0.0;
            uniformsRef.current.uChaosSpeed.value = state.chaosSpeed;
        }
    });

    return (
        <mesh 
            ref={meshRef} 
            position={position} 
            rotation={new THREE.Euler(...rotation)}
            scale={scale}
            geometry={geometry}
            material={customMaterial}
            castShadow
            receiveShadow
        />
    );
};

// --- GEOMETRIC SHAPES ---

const TriangleOverlay: React.FC<{ state: SimulationState }> = ({ state }) => {
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const SEGMENTS_PER_EDGE = Math.floor(30 + state.precision * 70); 

    const geometry = useMemo(() => {
      const geo = new THREE.BufferGeometry();
      const vertexCount = (100 * 3) + 1; 
      const vertices = new Float32Array(vertexCount * 3); 
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

        const drawEdge = (start: THREE.Vector2, end: THREE.Vector2) => {
            for (let i = 0; i < SEGMENTS_PER_EDGE; i++) {
                const t = i / SEGMENTS_PER_EDGE;
                const x = THREE.MathUtils.lerp(start.x, end.x, t);
                const y = THREE.MathUtils.lerp(start.y, end.y, t);
                const z = getSurfaceZ(x, y, state, time);
                positions[ptr++] = x;
                positions[ptr++] = y;
                positions[ptr++] = z + 0.1;
            }
        };

        drawEdge(p1, p2);
        drawEdge(p2, p3);
        drawEdge(p3, p1);
        const zClosing = getSurfaceZ(p1.x, p1.y, state, time);
        positions[ptr++] = p1.x;
        positions[ptr++] = p1.y;
        positions[ptr++] = zClosing + 0.1;
        
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
    
    // We use a high-res cone (4 radial segments = pyramid) so it bends
    const segmentsHeight = Math.floor(10 + state.precision * 40);
    const geometry = new THREE.ConeGeometry(2, 3, 4, segmentsHeight, true);
    
    // Wireframe material
    const material = new THREE.MeshBasicMaterial({ 
        color: state.colorTheme === 'cosmic' ? '#f472b6' : '#6366f1', 
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });

    return (
        <CurvedMesh 
            state={state}
            position={[5, -5, 0]} // Positioned to not overlap triangle
            rotation={[Math.PI / 2, 0, 0]} // Stand upright relative to plane
            geometry={geometry}
            material={material}
        />
    )
}

// --- SOLAR SYSTEM ---

interface PlanetData {
    name: string;
    distance: number;
    radius: number;
    color: string;
    speed: number;
    hasRing?: boolean;
}

const PLANETS: PlanetData[] = [
  { name: 'Sun', distance: 0, radius: 1.2, color: '#FDB813', speed: 0 },
  { name: 'Mercury', distance: 2.0, radius: 0.15, color: '#A5A5A5', speed: 1.5 },
  { name: 'Venus', distance: 3.0, radius: 0.25, color: '#E39C4E', speed: 1.2 },
  { name: 'Earth', distance: 4.5, radius: 0.25, color: '#4F4CB0', speed: 1.0 },
  { name: 'Mars', distance: 6.0, radius: 0.2, color: '#C1440E', speed: 0.8 },
  { name: 'Jupiter', distance: 8.5, radius: 0.7, color: '#C99039', speed: 0.5 },
  { name: 'Saturn', distance: 11.5, radius: 0.6, color: '#EAD6B8', speed: 0.4, hasRing: true },
  { name: 'Uranus', distance: 14.5, radius: 0.4, color: '#D1E7E7', speed: 0.3 },
  { name: 'Neptune', distance: 17.0, radius: 0.4, color: '#5B5DDF', speed: 0.2 },
];

const OrbitPath: React.FC<{ radius: number, state: SimulationState }> = ({ radius, state }) => {
    const segments = Math.floor(64 + state.precision * 128);
    // Torus acts as a thick ring/orbit line that can bend
    const geometry = useMemo(() => new THREE.TorusGeometry(radius, 0.02, 8, segments), [radius, segments]);
    const material = useMemo(() => new THREE.MeshBasicMaterial({ 
        color: state.colorTheme === 'cosmic' ? '#ffffff' : '#ffffff', 
        transparent: true, 
        opacity: state.colorTheme === 'cosmic' ? 0.1 : 0.2 
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

const Planet: React.FC<{ data: PlanetData; state: SimulationState }> = ({ data, state }) => {
    const groupRef = useRef<THREE.Group>(null);
    
    // High resolution geometry for smooth curvature
    const segments = Math.floor(24 + state.precision * 40);
    const geometry = useMemo(() => new THREE.SphereGeometry(data.radius, segments, segments), [data.radius, segments]);
    const material = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: data.color, 
        emissive: data.name === 'Sun' ? data.color : '#000000',
        emissiveIntensity: data.name === 'Sun' ? (state.colorTheme === 'cosmic' ? 5 : 2) : 0,
        roughness: 0.5 
    }), [data.color, data.name, state.colorTheme]);

    const ringGeometry = useMemo(() => new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.2, segments * 2), [data.radius, segments]);
    const ringMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: '#Ceb898', side: THREE.DoubleSide, transparent: true, opacity: 0.8 
    }), []);

    useFrame((_, delta) => {
        if (groupRef.current && data.speed > 0) {
            groupRef.current.rotation.z += data.speed * 0.2 * delta;
        }
    });

    return (
        <>
            {state.showTrajectories && data.distance > 0 && (
                <OrbitPath radius={data.distance} state={state} />
            )}
            <group ref={groupRef}>
                <CurvedMesh 
                    state={state}
                    position={[data.distance, 0, 0]} 
                    geometry={geometry}
                    material={material}
                />
                {data.hasRing && (
                    <CurvedMesh
                        state={state}
                        position={[data.distance, 0, 0]}
                        geometry={ringGeometry}
                        material={ringMaterial}
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
             // Maintain direction, change distance
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

const AntController: React.FC<{ state: SimulationState }> = ({ state }) => {
    const antPos = useRef({ x: 0, y: -9 }); 
    const vec = useMemo(() => new THREE.Vector3(), []);
    
    useFrame((rootState, delta) => {
        if (!state.antMode) return;
        const camera = rootState.camera;
        const time = rootState.clock.elapsedTime;
        
        antPos.current.y += 2.0 * delta; 
        if (antPos.current.y > 9) antPos.current.y = -9; 

        const x = antPos.current.x;
        const y = antPos.current.y;
        const z = getSurfaceZ(x, y, state, time);
        
        // Simple "Camera follows surface" logic
        camera.position.lerp(vec.set(x, z + 1.0, -y), 0.1);
        
        const lookY = y + 2.0;
        const lookZ = getSurfaceZ(x, lookY, state, time);
        camera.lookAt(x, lookZ + 0.5, -lookY);
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
        <AntController state={state} />
        
        <ambientLight intensity={state.colorTheme === 'cosmic' ? 0.05 : 0.2} />
        <pointLight position={[0, 0, 5]} intensity={2.0} color="#FDB813" />
        <pointLight position={[20, 50, 20]} intensity={state.colorTheme === 'cosmic' ? 0.2 : 0.5} />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        <group rotation={[-Math.PI / 2, 0, 0]}>
            <UniverseMesh state={state} />
            <TriangleOverlay state={state} />
            <PyramidOverlay state={state} />
            <SolarSystem state={state} />
        </group>
      </Canvas>
    </div>
  );
};
