/* Shaders WebGL para el Núcleo Cristalizado SONUS (estilo Crystalized Ball).
 * Incluye esfera dieléctrica de cristal con borde eléctrico crepitante,
 * bruma volumétrica interior, halo exterior y partículas de polvo reactivas a voz y cursor. */

export const crystalSphereVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const crystalSphereFragment = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uSpeak;
  uniform float uEnergy;
  uniform float uBass;
  uniform float uImpulse;
  uniform vec2 uPointer;

  varying vec3 vNormalW;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
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

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.05 + vec3(1.7, 9.2, 4.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 2.8);
    float sharpRim = pow(1.0 - ndv, 5.2);

    // Flujo eléctrico crepitante en el borde del cristal
    float speed = 0.45 + uSpeak * 1.15 + uEnergy * 0.75 + uHover * 0.5;
    vec3 p = normalize(vLocalPos) * 3.4;
    float n1 = fbm(p + vec3(uTime * speed * 0.45, -uTime * speed * 0.3, uTime * 0.22));
    float n2 = fbm(p * 1.9 - vec3(uTime * speed * 0.65, uTime * 0.35, -uTime * speed * 0.4));
    float crackle = smoothstep(0.46, 0.84, abs(n1 - n2) * 2.4 + n1 * 0.35);

    // Llamarada direccional hacia el cursor al hacer hover
    vec3 pointerDir = normalize(vec3(uPointer.x, uPointer.y, 0.55));
    float cursorHeat = pow(clamp(dot(N, pointerDir), 0.0, 1.0), 3.0) * (0.35 + uHover * 1.15);

    // Base de vidrio oscuro translúcido + refracción interna sutil
    vec3 glassCore = mix(vec3(0.02, 0.03, 0.09), vec3(0.07, 0.05, 0.22), n1 * 0.7);
    vec3 cyan = vec3(0.0, 0.85, 1.0);
    vec3 violet = vec3(0.55, 0.24, 1.0);
    vec3 magenta = vec3(1.0, 0.21, 0.83);
    vec3 bioGreen = vec3(0.0, 0.96, 0.63);

    vec3 rimPalette = mix(violet, cyan, smoothstep(0.25, 0.85, n1));
    rimPalette = mix(rimPalette, magenta, clamp(cursorHeat * 0.7 + uSpeak * 0.35, 0.0, 0.85));
    rimPalette = mix(rimPalette, bioGreen, clamp(uSpeak * 0.22 * crackle, 0.0, 0.4));

    float electricAmp = 0.85 + uSpeak * 0.95 + uHover * 0.65 + uEnergy * 0.7 + uImpulse * 1.1 + uBass * 0.45;
    vec3 electricRim = rimPalette * (fresnel * 1.1 + sharpRim * 1.9 * (0.55 + crackle * 1.35)) * electricAmp;

    // Reflejo especular de cristal superior-izquierdo
    vec3 L = normalize(vec3(-0.45, 0.65, 0.85));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 80.0);
    vec3 specCol = vec3(0.78, 0.96, 1.0) * spec * 0.75;

    // Caústicas internas sutiles
    float caustic = pow(n2, 3.0) * (0.25 + uSpeak * 0.45 + uEnergy * 0.35);
    vec3 col = glassCore + electricRim + specCol + cyan * caustic * 0.45;

    float alpha = clamp(0.18 + fresnel * 0.76 + sharpRim * 0.35 + spec * 0.5 + crackle * fresnel * 0.3, 0.16, 0.98);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const crystalHazeVertex = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vNormalW;
  varying vec3 vViewPos;

  void main() {
    vLocalPos = position;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const crystalHazeFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSpeak;
  uniform float uHover;
  uniform float uEnergy;
  uniform float uImpulse;

  varying vec3 vLocalPos;
  varying vec3 vNormalW;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewPos);
    float centerGlow = pow(clamp(dot(N, V), 0.0, 1.0), 1.65);

    float swirl = sin(vLocalPos.x * 4.2 + uTime * (0.7 + uSpeak * 1.6)) *
                  cos(vLocalPos.y * 4.0 - uTime * (0.55 + uSpeak * 1.2)) *
                  sin(vLocalPos.z * 3.8 + uTime * 0.5);
    float nebula = smoothstep(-0.35, 0.75, swirl);

    vec3 c1 = vec3(0.16, 0.08, 0.42);
    vec3 c2 = vec3(0.0, 0.78, 1.0);
    vec3 c3 = vec3(1.0, 0.21, 0.83);

    vec3 col = mix(c1, c2, nebula * 0.65);
    col = mix(col, c3, clamp(uSpeak * 0.42 + uHover * 0.3 + uImpulse * 0.5, 0.0, 0.75) * (1.0 - nebula * 0.4));

    float boost = 0.28 + uSpeak * 0.45 + uHover * 0.22 + uEnergy * 0.35 + uImpulse * 0.55;
    gl_FragColor = vec4(col * boost, centerGlow * (0.24 + uSpeak * 0.22 + uHover * 0.12));
  }
`;

export const crystalHaloVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewPos;

  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const crystalHaloFragment = /* glsl */ `
  uniform float uSpeak;
  uniform float uHover;
  uniform float uBass;
  uniform float uImpulse;

  varying vec3 vNormalW;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewPos);
    float rim = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 3.2);
    vec3 col = mix(vec3(0.55, 0.24, 1.0), vec3(0.0, 0.85, 1.0), 0.5 + 0.5 * uSpeak);
    col = mix(col, vec3(1.0, 0.21, 0.83), uHover * 0.4 + uImpulse * 0.45);
    float alpha = rim * (0.34 + uSpeak * 0.38 + uHover * 0.24 + uBass * 0.28 + uImpulse * 0.45);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const crystalDustVertex = /* glsl */ `
  attribute vec4 aSeed; // x: fase, y: velocidad, z: escala, w: mezcla de color
  uniform float uTime;
  uniform float uSpeak;
  uniform float uHover;
  uniform float uEnergy;
  uniform float uImpulse;
  uniform float uPixelRatio;
  uniform vec2 uPointer;

  varying float vTwinkle;
  varying float vDepth;
  varying float vColorMix;

  void main() {
    float phase = aSeed.x;
    float spd = aSeed.y;
    float baseScale = aSeed.z;
    vColorMix = aSeed.w;

    // Actividad de voz / audio / hover: cuando habla, las partículas se aceleran y remolinan
    float voiceDrive = uSpeak * (0.72 + 0.28 * sin(uTime * 10.5 + phase * 3.0));
    float activity = clamp(voiceDrive + uHover * 0.6 + uEnergy * 0.7 + uImpulse * 1.1, 0.0, 2.2);

    // Rotación tipo vórtice dentro de la esfera cristalizada
    float swirlAngle = uTime * (0.14 + spd * 0.16 + activity * (0.85 + spd * 0.65)) + phase;
    float ca = cos(swirlAngle);
    float sa = sin(swirlAngle);

    vec3 pos = position;
    // Remolino orbital en XZ y ligera elevación helicoidal en Y cuando habla o hay hover
    pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;
    pos.y += sin(uTime * (0.7 + spd * 0.8 + activity * 2.4) + phase) * (0.035 + activity * 0.11);
    pos.x += cos(uTime * (0.6 + spd * 0.6 + activity * 2.1) + phase * 1.7) * (0.025 + activity * 0.09);

    // Atracción / estela sutil hacia el cursor al hacer hover
    pos.xy += uPointer * (0.14 * uHover * (0.5 + 0.5 * sin(phase)));

    // Expansión radial pulsante con la voz o el clic
    float pulse = 1.0 + voiceDrive * 0.14 * sin(uTime * 13.0 + phase * 5.0) + uImpulse * 0.18;
    pos *= pulse;

    // Mantener partículas contenidas dentro del cristal
    float maxR = 0.94;
    float len = length(pos);
    if (len > maxR) {
      pos *= maxR / len;
    }

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Indicadores de profundidad: partículas al fondo son más pequeñas y tenues
    float depthNorm = clamp((-mvPos.z - 2.2) / 3.5, 0.0, 1.0);
    vDepth = 1.0 - depthNorm * 0.65;

    // Parpadeo orgánico intensificado al hablar
    float twSpeed = 1.6 + activity * 4.8;
    vTwinkle = 0.52 + 0.48 * sin(uTime * twSpeed + phase * 6.2831);

    float sizePx = (14.0 + baseScale * 18.0) * (0.85 + activity * 0.55) * uPixelRatio;
    gl_PointSize = clamp(sizePx / max(1.0, -mvPos.z), 2.0, 34.0);
  }
`;

export const crystalDustFragment = /* glsl */ `
  uniform float uSpeak;
  uniform float uHover;
  uniform float uImpulse;

  varying float vTwinkle;
  varying float vDepth;
  varying float vColorMix;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // Núcleo brillante suave + halo cristalino
    float core = exp(-d * d * 24.0);
    float glow = smoothstep(0.5, 0.0, d);

    vec3 cyan = vec3(0.0, 0.90, 1.0);
    vec3 violet = vec3(0.62, 0.35, 1.0);
    vec3 magenta = vec3(1.0, 0.25, 0.85);
    vec3 bioGreen = vec3(0.0, 0.96, 0.65);

    vec3 col = mix(cyan, violet, vColorMix);
    if (vColorMix > 0.72) {
      col = mix(col, magenta, (vColorMix - 0.72) / 0.28);
    }
    col = mix(col, bioGreen, clamp(uSpeak * 0.28, 0.0, 0.35));
    col = mix(col, vec3(1.0), core * 0.75);

    float alpha = (glow * 0.65 + core * 0.85) * vTwinkle * vDepth * (0.68 + uSpeak * 0.35 + uHover * 0.2 + uImpulse * 0.35);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
