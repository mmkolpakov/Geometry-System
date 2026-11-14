import {
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  SYSTEM_BODIES,
  systemTrails,
  type SystemBody,
  type SystemId,
  type SystemSnapshot,
} from "../domain/systems";

export type SystemCameraView = "tilted" | "top";
interface SystemRenderState {
  snapshot: SystemSnapshot;
  selectedId: string;
  focused: boolean;
  curvature: boolean;
}
interface RendererInputs {
  system: SystemId;
  physical: boolean;
  host: RefObject<HTMLDivElement | null>;
  label: RefObject<HTMLDivElement | null>;
  live: RefObject<SystemRenderState>;
  setSelectedId: Dispatch<SetStateAction<string>>;
  setUnavailable: Dispatch<SetStateAction<boolean>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
}

const bodyRadius = (body: SystemBody, system: SystemId, physical: boolean) =>
  system === "solar" && physical
    ? ((body.radiusKm ?? 6371) / 149597870.7) * 0.32
    : body.kind === "star"
      ? body.id === "sun"
        ? 0.8
        : 0.58
      : body.id === "jupiter"
        ? 0.48
        : body.id === "saturn"
          ? 0.4
          : ["uranus", "neptune"].includes(body.id)
            ? 0.31
            : body.id === "earth"
              ? 0.27
              : 0.22;
const point = (
  x: number,
  y: number,
  z: number,
  system: SystemId,
  physical: boolean,
) => {
  const radius = Math.hypot(x, y, z),
    scale =
      system === "solar"
        ? physical
          ? 0.32
          : radius
            ? (1.15 + 2.55 * Math.log1p(radius)) / radius
            : 1
        : 1.7;
  return new THREE.Vector3(x * scale, z * scale, -y * scale);
};

const surfaceFiles: Partial<Record<string, string>> = {
  earth: "earth.png",
  mars: "mars.jpg",
  jupiter: "jupiter.jpg",
  saturn: "saturn.jpg",
};

function planetTexture(body: SystemBody) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = body.color;
  ctx.fillRect(0, 0, 256, 128);
  if (body.id === "test-planet") {
    ctx.fillStyle = "#497f66";
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(
        (i * 67 + 23) % 256,
        20 + ((i * 29) % 94),
        10 + (i % 4) * 4,
        5 + (i % 3) * 4,
        i,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#e9f1e7";
    ctx.fillRect(0, 0, 256, 7);
    ctx.fillRect(0, 122, 256, 6);
  } else {
    ctx.fillStyle = "#485055";
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      ctx.arc((i * 79) % 256, (i * 41) % 128, 1 + (i % 5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!,
    gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.15, "#fff1b9");
  gradient.addColorStop(0.32, "#ffb84388");
  gradient.addColorStop(1, "#ff9b0000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function useSystemRenderer({
  system,
  physical,
  host,
  label,
  live,
  setSelectedId,
  setUnavailable,
  setPlaying,
}: RendererInputs) {
  const api = useRef<{ camera: (view: SystemCameraView) => void } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    const container = host.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#060d19");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 0.02;
    controls.maxDistance = 75;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enableDamping = true;
    let view: SystemCameraView = "tilted";
    let followingId: string | undefined;
    const setCamera = (next: SystemCameraView) => {
      view = next;
      followingId = undefined;
      controls.minDistance = 0.02;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
        radius = system === "solar" ? 10.7 : 8.1;
      const distance =
        radius *
        Math.max(
          Math.hypot(1 / (tangent * camera.aspect), view === "top" ? 0 : 0.8),
          (view === "top" ? 1 : 0.6) / tangent + (view === "top" ? 0 : 0.8),
        );
      camera.position.set(
        0,
        view === "top" ? distance : distance * 0.6,
        view === "top" ? 0.01 : distance * 0.8,
      );
      controls.target.set(0, 0, 0);
      controls.update();
    };
    setCamera("tilted");
    api.current = { camera: setCamera };
    scene.add(new THREE.AmbientLight("#8296c9", 0.8));
    const textures: THREE.Texture[] = [],
      bodies = new Map<string, THREE.Mesh>(),
      paths = new Map<string, THREE.Line>(),
      radii = new Map(
        SYSTEM_BODIES[system].map((body) => [
          body.id,
          bodyRadius(body, system, physical),
        ]),
      );
    const haloTexture = glowTexture();
    textures.push(haloTexture);
    const loader = new THREE.TextureLoader();
    const skyTexture = loader.load("./textures/stars.jpg");
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTexture;
    scene.backgroundIntensity = 0.17;
    textures.push(skyTexture);
    for (const body of SYSTEM_BODIES[system]) {
      const radius = radii.get(body.id)!;
      const file = surfaceFiles[body.id];
      const surface = file
        ? loader.load(`./textures/${file}`)
        : body.kind === "planet"
          ? planetTexture(body)
          : null;
      if (surface) surface.colorSpace = THREE.SRGBColorSpace;
      const material =
        body.kind === "star"
          ? new THREE.MeshBasicMaterial({ color: body.color })
          : new THREE.MeshStandardMaterial({
              map: surface,
              roughness: 1,
              metalness: 0,
            });
      if (material instanceof THREE.MeshStandardMaterial && material.map)
        textures.push(material.map);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 40, 24),
        material,
      );
      mesh.userData.id = body.id;
      scene.add(mesh);
      bodies.set(body.id, mesh);
      if (body.kind === "star") {
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: haloTexture,
            color: body.color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        glow.scale.setScalar(radius * 5);
        mesh.add(glow);
        const light = new THREE.PointLight(
          system === "solar" ? "#fff8ef" : body.color,
          system === "solar" ? 6 : 12,
          0,
          1,
        );
        mesh.add(light);
      }
      if (body.id === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.35, radius * 2.1, 80),
          new THREE.MeshStandardMaterial({
            color: "#c5ad83",
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
            roughness: 1,
          }),
        );
        ring.rotation.x = -Math.PI / 2.5;
        mesh.add(ring);
      }
    }
    for (const trail of systemTrails(system)) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        trail.points.map((p) => point(p.x, p.y, p.z ?? 0, system, physical)),
      );
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: SYSTEM_BODIES[system].find((body) => body.id === trail.id)!
            .color,
          transparent: true,
          opacity: system === "solar" ? 0.22 : 0.45,
        }),
      );
      scene.add(line);
      paths.set(trail.id, line);
    }
    const starPositions = new Float32Array(900);
    for (let i = 0; i < starPositions.length; i += 3) {
      const angle = i * 2.399,
        z = (((i * 41) % 997) / 997 - 0.5) * 2,
        r = 42;
      starPositions[i] = r * Math.sqrt(1 - z * z) * Math.cos(angle);
      starPositions[i + 1] = r * z;
      starPositions[i + 2] = r * Math.sqrt(1 - z * z) * Math.sin(angle);
    }
    scene.add(
      new THREE.Points(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.BufferAttribute(starPositions, 3),
        ),
        new THREE.PointsMaterial({
          color: "#a6b9d2",
          size: 0.065,
          transparent: true,
          opacity: 0.62,
        }),
      ),
    );
    const selection = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.75, 64),
      new THREE.MeshBasicMaterial({
        color: "#d6f4ed",
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    selection.renderOrder = 4;
    scene.add(selection);
    const gridSize = 23,
      divisions = 46;
    const gridGeometry = new THREE.PlaneGeometry(
      gridSize,
      gridSize,
      divisions,
      divisions,
    );
    gridGeometry.rotateX(-Math.PI / 2);
    const gridBase = Float32Array.from(
      gridGeometry.attributes.position.array as ArrayLike<number>,
    );
    const grid = new THREE.Mesh(
      gridGeometry,
      new THREE.MeshBasicMaterial({
        color: "#668ca1",
        wireframe: true,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    grid.visible = false;
    scene.add(grid);
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      setCamera(view);
    });
    resize.observe(container);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects([...bodies.values()], false)[0];
      if (hit) setSelectedId(hit.object.userData.id);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const lost = (event: Event) => {
      event.preventDefault();
      setUnavailable(true);
      setPlaying(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.setAnimationLoop(() => {
      const state = live.current.snapshot;
      state.bodies.forEach((body) =>
        bodies
          .get(body.id)!
          .position.copy(
            point(
              body.position.x,
              body.position.y,
              body.position.z ?? 0,
              system,
              physical,
            ),
          ),
      );
      if (system === "triple")
        paths.forEach((line) =>
          line.geometry.setDrawRange(0, Math.floor(state.time / 0.05) + 1),
        );
      const active =
        bodies.get(live.current.selectedId) ??
        bodies.get(system === "solar" ? "earth" : "test-planet")!;
      if (live.current.focused) {
        if (followingId !== active.userData.id) {
          const r = radii.get(active.userData.id)!;
          controls.minDistance = r * 1.2;
          camera.position
            .copy(active.position)
            .add(new THREE.Vector3(r * 6, r * 3, r * 6));
          controls.target.copy(active.position);
          camera.near = Math.max(0.0000001, r * 0.1);
          camera.updateProjectionMatrix();
          followingId = active.userData.id;
        }
        const shift = active.position.clone().sub(controls.target);
        camera.position.add(shift);
        controls.target.copy(active.position);
      } else if (followingId) {
        setCamera(view);
      }
      grid.visible = live.current.curvature;
      if (grid.visible) {
        const positions = gridGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = gridBase[i * 3],
            z = gridBase[i * 3 + 2];
          let depth = 0;
          state.bodies
            .filter((body) => body.kind === "star")
            .forEach((body) => {
              const q = point(
                body.position.x,
                body.position.y,
                body.position.z ?? 0,
                system,
                physical,
              );
              depth += 1.1 / Math.sqrt((x - q.x) ** 2 + (z - q.z) ** 2 + 0.35);
            });
          positions.setY(i, -0.5 - Math.min(depth, 3));
        }
        positions.needsUpdate = true;
      }
      selection.position.copy(active.position);
      selection.quaternion.copy(camera.quaternion);
      selection.scale.setScalar((radii.get(active.userData.id)! * 1.3) / 0.74);
      controls.update();
      renderer.render(scene, camera);
      if (label.current) {
        const projected = active.position.clone().project(camera),
          halfWidth = label.current.offsetWidth / 2 + 12,
          top = label.current.offsetHeight * 2 + 12;
        label.current.style.left = `${Math.max(halfWidth, Math.min(container.clientWidth - halfWidth, ((projected.x + 1) * container.clientWidth) / 2))}px`;
        label.current.style.top = `${Math.max(top, Math.min(container.clientHeight - 12, ((1 - projected.y) * container.clientHeight) / 2))}px`;
        label.current.style.visibility =
          projected.z > 1 ||
          Math.abs(projected.x) > 1.1 ||
          Math.abs(projected.y) > 1.1
            ? "hidden"
            : "visible";
      }
    });
    return () => {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Points
        ) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        } else if (object instanceof THREE.Sprite) object.material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [
    system,
    physical,
    host,
    label,
    live,
    setSelectedId,
    setUnavailable,
    setPlaying,
  ]);
  return api;
}
