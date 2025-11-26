
// Common math used by both the Universe Grid and the Celestial Objects
// to ensure they deform in perfect unison.
export const CURVATURE_COMMON = `
  uniform float uTime;
  uniform float uOmega;
  uniform float uChaos;
  uniform float uChaosSpeed;
  uniform float uExaggeration;

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

      if (uOmega > 1.02) {
          float factor = (uOmega - 1.0) * 2.0 * uExaggeration;
          z -= factor * (distSq * 2.0);
      } else if (uOmega < 0.98) {
          float factor = (1.0 - uOmega) * 2.0 * uExaggeration;
          z += factor * (centered.x * centered.x - centered.y * centered.y) * 2.0;
      }

      if (uChaos > 0.5) {
          float time = uTime * uChaosSpeed;
          z += getChaosZ(localPos, time) * uExaggeration;
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
