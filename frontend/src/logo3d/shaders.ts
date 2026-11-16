/**
 * Shaders GLSL del logo SONUS 3D.
 * Se mantienen como strings en un módulo aparte para no mezclar GLSL con la lógica de React.
 */

/** Esfera principal: degradado morado intenso a centro claro + rugosidad micro-granular realista. */
export const sphereVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying vec3 vObjPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vObjPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mv.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

export const sphereFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uBass;
  uniform float uEnergy;
  uniform float uHover;
  uniform vec3 uLightDir; // en espacio de vista, normalizada
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying vec3 vObjPos;
  varying vec2 vUv;

  // Ruido 3D procedural determinista para relieve sin costuras UV
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float roughnessHeight(vec3 p) {
    float macro = noise3(p * 13.0) * 0.56;
    float meso  = noise3(p * 34.0 + 4.3) * 0.28;
    float micro = noise3(p * 92.0 - 9.1) * 0.16;
    return macro + meso + micro;
  }

  void main() {
    vec3 n = normalize(vNormalView);
    vec3 v = normalize(vViewPos);
    vec3 l = normalize(uLightDir);

    // Perturbación de normal en espacio de objeto -> vista para rugosidad física realista
    float eps = 0.012;
    float h0 = roughnessHeight(vObjPos);
    float hx = roughnessHeight(vObjPos + vec3(eps, 0.0, 0.0)) - h0;
    float hy = roughnessHeight(vObjPos + vec3(0.0, eps, 0.0)) - h0;
    float hz = roughnessHeight(vObjPos + vec3(0.0, 0.0, eps)) - h0;
    vec3 objGrad = vec3(hx, hy, hz) / eps;
    vec3 roughNormal = normalize(n - (normalMatrix * objGrad) * 0.095);

    float facing = clamp(dot(n, v), 0.0, 1.0);
    float diffRough = clamp(dot(roughNormal, l), 0.0, 1.0);

    // Degradado pedido: morado fuerte/profundo en el borde hacia un centro más claro y luminoso
    vec3 rimPurple   = vec3(0.11, 0.018, 0.27); // morado fuerte oscuro en perímetro
    vec3 deepViolet  = vec3(0.36, 0.085, 0.72); // morado vibrante intermedio
    vec3 centerLight = vec3(0.77, 0.50, 0.99);  // centro del círculo más claro
    vec3 coreBloom   = vec3(0.91, 0.78, 1.00);  // destello suave central

    float centerMask = smoothstep(0.10, 0.96, facing);
    vec3 col = mix(rimPurple, deepViolet, smoothstep(0.04, 0.62, facing));
    col = mix(col, centerLight, pow(centerMask, 1.45) * (0.72 + 0.16 * diffRough));
    col = mix(col, coreBloom, pow(facing, 4.2) * (0.34 + 0.18 * uHover + uEnergy * 0.14));

    // Micro-oclusión y grano fino satinado de la textura rugosa
    float grainShadow = mix(0.84, 1.08, h0);
    col *= grainShadow;

    // Especular satinado rugoso + brillo difuso en crestas de rugosidad
    vec3 halfVec = normalize(l + v);
    float specBroad = pow(max(dot(roughNormal, halfVec), 0.0), 11.0);
    float specTight = pow(max(dot(roughNormal, halfVec), 0.0), 34.0);
    col += vec3(0.76, 0.58, 1.0) * (specBroad * 0.12 + specTight * 0.14);

    // Borde fresnel cian-violeta sutil acoplado a graves
    float fres = pow(1.0 - facing, 3.4);
    col += vec3(0.36, 0.55, 1.0) * fres * (0.07 + uBass * 0.36);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Halo exterior (esfera ligeramente mayor, cara interna, aditivo). */
export const haloVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mv.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

export const haloFragment = /* glsl */ `
  precision highp float;
  uniform float uBass;
  uniform float uHover;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  void main() {
    vec3 n = normalize(vNormalView);
    vec3 v = normalize(vViewPos);
    float rim = clamp(-dot(n, v), 0.0, 1.0);
    float falloff = smoothstep(0.05, 0.52, rim);
    float a = (falloff * falloff) * (0.18 + uBass * 0.36 + uHover * 0.14);
    vec3 c = mix(vec3(0.42, 0.14, 0.88), vec3(0.58, 0.44, 1.0), clamp(uBass * 0.9 + uHover * 0.25, 0.0, 1.0));
    gl_FragColor = vec4(c, a * 0.44);
  }
`;

/** Pista de circuito: gradiente espacial fiel al emblema SONUS + pulso sutil de datos. */
export const traceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocalPos;
  void main() {
    vUv = uv;
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const traceFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uPhase;
  uniform float uSpeed;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  void main() {
    // Gradiente radial espacial idéntico al logo SONUS:
    // centro-inferior cian hielo (#a6f3ff) -> lavanda medio (#b396ff) -> púrpura exterior (#7d48df)
    float distCenter = length(vLocalPos.xy - vec2(0.0, -0.14));
    vec3 innerCyan   = vec3(0.66, 0.95, 1.00);
    vec3 midLavender = vec3(0.71, 0.59, 0.99);
    vec3 outerPurple = vec3(0.50, 0.30, 0.88);

    vec3 base = mix(innerCyan, midLavender, smoothstep(0.18, 0.52, distCenter));
    base = mix(base, outerPurple, smoothstep(0.50, 0.90, distCenter));

    float head = fract(uTime * uSpeed + uPhase);
    float d = abs(vUv.x - head);
    d = min(d, 1.0 - d);
    float packet = smoothstep(0.14, 0.0, d);

    float brightness = 0.94 + uEnergy * 0.22 + uTreble * 0.18;
    vec3 col = base * brightness + vec3(0.68, 0.96, 1.0) * packet * (0.18 + uTreble * 0.65);
    gl_FragColor = vec4(col, 1.0);
  }
`;
