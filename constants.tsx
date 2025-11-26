


// Common math used by both the Universe Grid and the Celestial Objects
// to ensure they deform in perfect unison.
export const CURVATURE_COMMON = `
  uniform float uTime;
  uniform float uOmega;
  uniform float uChaos;
  uniform float uChaosSpeed;
  uniform float uExaggeration;
  
  // Gravity Wells
  uniform vec2 uGravPos[6];
  uniform float uGravMass[6];
  uniform float uSunMass;

  // Sync with JS getSurfaceZ
  float getChaosZ(vec2 pos, float time) {
      float z = 0.0;
      z += sin(pos.x * 0.5 + time) * sin(pos.y * 0.5 + time) * 0.5;
      z += sin(pos.x * 1.5 - time * 0.5) * 0.25;
      z += cos(pos.y * 1.5 + time * 0.5) * 0.25;
      z += sin(length(pos) * 3.0 - time * 2.0) * 0.1;
      return z;
  }

  float getCurvature(vec2 pos) {
      vec2 localPos = pos;
      vec2 centered = pos / 10.0; // Assume roughly -10 to 10 range
      float distSq = dot(centered, centered);
      float z = 0.0;

      // 1. FLRW Metric
      if (uOmega > 1.02) {
          float factor = (uOmega - 1.0) * 2.0 * uExaggeration;
          z -= factor * (distSq * 2.0);
      } else if (uOmega < 0.98) {
          float factor = (1.0 - uOmega) * 2.0 * uExaggeration;
          z += factor * (centered.x * centered.x - centered.y * centered.y) * 2.0;
      }

      // 2. Chaos Mode
      if (uChaos > 0.5) {
          float time = uTime * uChaosSpeed;
          z += getChaosZ(localPos, time) * uExaggeration;
      }
      
      // 3. Gravity Wells (Mass Distortion)
      // WIDER WELLS: Use 0.2 coeff in exponent to prevent sharp dips breaking rings
      
      // Planets
      for(int i = 0; i < 6; i++) {
          if (uGravMass[i] > 0.0) {
              float d = distance(pos, uGravPos[i]);
              z -= uGravMass[i] * exp(-d * d * 0.1); 
          }
      }
      
      // Sun
      if (uSunMass > 0.0) {
          float d = length(pos);
          z -= uSunMass * exp(-d * d * 0.05);
      }

      return z;
  }
`;

export const UNIVERSE_VERTEX_SHADER = `
  ${CURVATURE_COMMON}

  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Apply curvature to the flat plane
    float zOffset = getCurvature(pos.xy);
    pos.z += zOffset;

    vElevation = pos.z;
    
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vViewPosition = viewPosition.xyz;

    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const UNIVERSE_FRAGMENT_SHADER = `
  #extension GL_OES_standard_derivatives : enable
  
  uniform float uTime;
  uniform float uGridVisible;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uColorMode; // 0.0 = Scientific, 1.0 = Cosmic

  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vViewPosition;

  void main() {
    // 1. Grid Logic (Anti-aliased)
    float gridStrength = 0.0;
    if (uGridVisible > 0.5) {
        float scale = 20.0;
        // fwidth is standard in modern GLSL
        vec2 grid = abs(fract(vUv * scale - 0.5) - 0.5) / fwidth(vUv * scale);
        float line = min(grid.x, grid.y);
        gridStrength = 1.0 - min(line, 1.0);
    }

    // 2. Lighting / Shading
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 normal = normalize(cross(fdx, fdy));
    vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
    float diff = max(dot(normal, lightDir), 0.0);
    
    vec3 finalColor = vec3(0.0);
    float alpha = uOpacity;

    if (uColorMode < 0.5) {
        // --- SCIENTIFIC MODE ---
        // Height-based heatmap
        vec3 deepColor = uColor * 0.4;
        vec3 highColor = uColor * 1.8 + vec3(0.2); 
        float heightFactor = smoothstep(-3.0, 3.0, vElevation);
        vec3 baseColor = mix(deepColor, highColor, heightFactor);
        finalColor = baseColor * (diff * 0.7 + 0.3);
        
        // White grid
        if (uGridVisible > 0.5) {
            finalColor = mix(finalColor, vec3(1.0), gridStrength * 0.8);
        }
    } else {
        // --- COSMIC MODE ---
        // Dark void, Neon Grid
        vec3 gridColor = vec3(0.0, 1.0, 1.0); // Cyan
        if (uColor.r > 0.5) gridColor = vec3(1.0, 0.2, 0.5); // Pink/Red if curvature extreme
        
        // Base is dark void
        vec3 voidColor = vec3(0.01, 0.01, 0.05);
        finalColor = voidColor;

        // Glowing Grid
        if (uGridVisible > 0.5) {
            finalColor += gridColor * gridStrength * 2.0;
        }
        
        // Slight height tint
        finalColor += uColor * 0.1 * smoothstep(-5.0, 5.0, vElevation);
        
        // Adjust alpha for transparency
        alpha = uOpacity * 0.8 + gridStrength * 0.5;
    }

    // Vignette
    float dist = distance(vUv, vec2(0.5));
    alpha *= smoothstep(0.5, 0.45, dist);

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Updated Atmosphere Shader - Uses World Space Curvature
export const ATMOSPHERE_VERTEX_SHADER = `
${CURVATURE_COMMON}
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  // 1. Get World Position
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  
  // 2. Map World X / -Z to Universe Plane
  vec2 planeCoords = vec2(worldPos.x, -worldPos.z);
  
  // 3. Calculate Curvature
  float zOffset = getCurvature(planeCoords);
  
  // 4. Apply to World Y (Universe Z)
  worldPos.y += zOffset;

  vec4 viewPosition = viewMatrix * worldPos;
  vViewPosition = viewPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const ATMOSPHERE_FRAGMENT_SHADER = `
varying vec3 vNormal;
varying vec3 vViewPosition;
uniform vec3 uAtmosphereColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    
    // Fresnel Effect
    float fresnel = dot(normal, viewDir);
    fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
    fresnel = pow(fresnel, 2.5); 
    
    gl_FragColor = vec4(uAtmosphereColor, fresnel * 0.8);
}
`;

// --- NEW SUN SURFACE SHADERS (World Space Aware) ---

export const SUN_SURFACE_VERTEX_SHADER = `
${CURVATURE_COMMON}
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    
    // 1. World Pos
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vec2 planeCoords = vec2(worldPos.x, -worldPos.z);
    
    // 2. Curvature
    float zOffset = getCurvature(planeCoords);
    
    // 3. Apply to World Y
    worldPos.y += zOffset;
    
    vPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const SUN_SURFACE_FRAGMENT_SHADER = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;

// 3D Noise Function
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

// Fractal Brownian Motion
float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.02;
    f += 0.2500 * noise(p); p *= 2.03;
    f += 0.1250 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f;
}

void main() {
    // 1. Base Gradient (Center bright, edges darker)
    vec3 viewDir = normalize(cameraPosition - vPos); 
    
    // 2. Animated Plasma Noise
    float t = uTime * 0.5;
    float n = fbm(vPos * 0.8 + vec3(0.0, 0.0, t));
    
    // 3. Color Mapping
    vec3 colorDark = vec3(0.8, 0.2, 0.0); // Red/Orange
    vec3 colorBright = vec3(1.2, 0.8, 0.1); // Bright Yellow/White
    
    vec3 finalColor = mix(colorDark, colorBright, n + 0.2);
    finalColor *= 1.5;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
