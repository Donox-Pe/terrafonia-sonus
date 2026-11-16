import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  getCloudDeckCanvas,
  getEarthBaseAssets,
  getEarthVisualOrigin,
  registerCloudTexture,
  subscribeNasaBlueMarble,
  type EarthVisualOrigin,
} from "../analysis/earthTexture";
import { renderEarthCrustForGlobe } from "../analysis/syntheticEicRenderer";
import type { LayerToggles, SoundSignature } from "../types/soundSignature";

export interface EarthGlobe3DProps {
  signature: SoundSignature;
  layers: LayerToggles;
  playing: boolean;
  reducedMotion: boolean;
  rotationOffset: { yaw: number; pitch: number };
  zoomFactor?: number;
  onVisualOriginChange?: (origin: EarthVisualOrigin) => void;
  className?: string;
}

const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vTangentWorld;
varying vec3 vBitangentWorld;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalWorld = normalize(mat3(modelMatrix) * normal);

  // Base tangente aproximada en esfera Y-up para micro-relieve de relieve topográfico
  vec3 upRef = abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tanLocal = normalize(cross(upRef, normal));
  vec3 bitanLocal = cross(normal, tanLocal);
  vTangentWorld = normalize(mat3(modelMatrix) * tanLocal);
  vBitangentWorld = normalize(mat3(modelMatrix) * bitanLocal);

  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const EARTH_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform sampler2D uCloudMap;
uniform float uCloudOffsetU;
uniform float uCloudOpacity;
uniform vec2 uTexelSize;

varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vTangentWorld;
varying vec3 vBitangentWorld;
varying vec3 vViewDir;

float lum(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 albedo = texture2D(uMap, vUv).rgb;
  vec3 nBase = normalize(vNormalWorld);
  vec3 v = normalize(vViewDir);

  // Micro-relieve topográfico (cordilleras en tierra, suavizado sobre agua)
  float oceanMask = smoothstep(0.015, 0.18, albedo.b - max(albedo.r, albedo.g));
  float landMask = 1.0 - oceanMask;

  float hL = lum(texture2D(uMap, vUv - vec2(uTexelSize.x, 0.0)).rgb);
  float hR = lum(texture2D(uMap, vUv + vec2(uTexelSize.x, 0.0)).rgb);
  float hD = lum(texture2D(uMap, vUv - vec2(0.0, uTexelSize.y)).rgb);
  float hU = lum(texture2D(uMap, vUv + vec2(0.0, uTexelSize.y)).rgb);

  float bumpScale = landMask * 1.45;
  vec3 n = normalize(
    nBase
    + normalize(vTangentWorld) * ((hL - hR) * bumpScale)
    + normalize(vBitangentWorld) * ((hD - hU) * bumpScale)
  );

  // Luz solar realista estilo NASA Eyes on the Earth
  vec3 sunDir = normalize(vec3(-0.48, 0.34, 0.81));
  float ndotl = dot(n, sunDir);
  float day = smoothstep(-0.14, 0.38, ndotl);
  float twilightBand = smoothstep(-0.22, 0.02, ndotl) * (1.0 - smoothstep(0.02, 0.28, ndotl));

  // Sombra real proyectada por la esfera superior de nubes sobre continentes y océanos
  vec2 cloudShadowUv = vec2(fract(vUv.x - uCloudOffsetU - 0.0045), clamp(vUv.y + 0.003, 0.0, 1.0));
  float cloudShadowAlpha = texture2D(uCloudMap, cloudShadowUv).a * uCloudOpacity;
  float groundShadow = 1.0 - cloudShadowAlpha * 0.48 * day;

  // Reflejo especular solar sutil en mares (oceánico, no plástico)
  vec3 halfVec = normalize(sunDir + v);
  float spec = pow(max(dot(n, halfVec), 0.0), 48.0) * oceanMask * day * groundShadow * 0.42;

  // Dispersión atmosférica Rayleigh sutil en el horizonte del globo
  float fresnel = pow(1.0 - max(dot(nBase, v), 0.0), 3.6);
  vec3 atmosphere = mix(vec3(0.18, 0.48, 0.92), vec3(0.45, 0.8, 1.0), day)
    * fresnel * (0.28 + 0.72 * day);

  vec3 night = albedo * 0.14 + vec3(0.008, 0.016, 0.038);
  vec3 lit = (night + albedo * (0.94 * day * groundShadow))
    + vec3(0.85, 0.42, 0.2) * twilightBand * 0.09;
  vec3 finalColor = lit + vec3(0.75, 0.9, 1.0) * spec + atmosphere * 0.75;

  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

const CLOUD_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CLOUD_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uCloudMap;
uniform float uCloudOffsetU;
uniform float uCloudOpacity;

varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vViewDir;

void main() {
  vec2 uv = vec2(fract(vUv.x - uCloudOffsetU), vUv.y);
  vec4 cloud = texture2D(uCloudMap, uv);
  float alpha = cloud.a * uCloudOpacity;
  if (alpha < 0.02) discard;

  vec3 n = normalize(vNormalWorld);
  vec3 v = normalize(vViewDir);
  vec3 sunDir = normalize(vec3(-0.48, 0.34, 0.81));

  float ndotl = dot(n, sunDir);
  float day = smoothstep(-0.18, 0.42, ndotl);
  float terminator = smoothstep(-0.22, 0.06, ndotl) * (1.0 - smoothstep(0.04, 0.32, ndotl));
  float limbFade = smoothstep(0.02, 0.3, max(dot(n, v), 0.0));

  vec3 cloudCol = mix(vec3(0.14, 0.2, 0.34), vec3(0.98, 0.99, 1.0), day);
  cloudCol += vec3(0.95, 0.56, 0.35) * terminator * 0.16;

  gl_FragColor = vec4(cloudCol, alpha * (0.28 + 0.72 * day) * limbFade);
}
`;

const ATMOS_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const ATMOS_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float rim = clamp(-dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
  float glow = pow(smoothstep(0.06, 0.44, rim), 2.3);
  vec3 col = mix(vec3(0.15, 0.48, 0.95), vec3(0.45, 0.82, 1.0), glow);
  gl_FragColor = vec4(col, glow * 0.44);
}
`;

interface OrbitDef {
  radius: number;
  tiltX: number;
  tiltZ: number;
  color: string;
  speed: number;
  phase: number;
}

// Anillos orbitales ilustrativos inspirados en NASA Eyes on the Earth
const REFERENCE_ORBITS: OrbitDef[] = [
  { radius: 1.15, tiltX: 1.48, tiltZ: 0.28, color: "#38bdf8", speed: 0.28, phase: 0.4 },
  { radius: 1.19, tiltX: 1.12, tiltZ: -0.62, color: "#f59e0b", speed: 0.21, phase: 2.1 },
  { radius: 1.24, tiltX: 0.42, tiltZ: 0.44, color: "#34d399", speed: 0.17, phase: 3.9 },
  { radius: 1.29, tiltX: 1.54, tiltZ: -0.22, color: "#93c5fd", speed: 0.24, phase: 5.1 },
];

function OrbitRing({ orbit, reducedMotion }: { orbit: OrbitDef; reducedMotion: boolean }) {
  const satRef = useRef<THREE.Mesh>(null);

  const lineObj = useMemo(() => {
    const segs = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * orbit.radius, 0, Math.sin(a) * orbit.radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: orbit.color,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, [orbit.color, orbit.radius]);

  useEffect(() => {
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj]);

  useFrame(({ clock }) => {
    if (!satRef.current) return;
    const t = reducedMotion ? 0 : clock.elapsedTime * orbit.speed;
    const a = t + orbit.phase;
    satRef.current.position.set(
      Math.cos(a) * orbit.radius,
      0,
      Math.sin(a) * orbit.radius,
    );
  });

  return (
    <group rotation={[orbit.tiltX, 0, orbit.tiltZ]}>
      <primitive object={lineObj} />
      <mesh ref={satRef}>
        <sphereGeometry args={[0.015, 10, 10]} />
        <meshBasicMaterial color={orbit.color} />
      </mesh>
    </group>
  );
}

function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const ptsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribución determinista en capa esférica profunda
      const s1 = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
      const s2 = Math.sin(i * 78.233 + 1.913) * 19341.231;
      const s3 = Math.sin(i * 45.164 + 9.217) * 31542.811;
      const r1 = s1 - Math.floor(s1);
      const r2 = s2 - Math.floor(s2);
      const r3 = s3 - Math.floor(s3);

      const radius = 5.5 + r3 * 6.5;
      const theta = r1 * Math.PI * 2;
      const phi = Math.acos(2 * r2 - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.cos(phi);
      pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(({ clock }) => {
    if (ptsRef.current && !reducedMotion) {
      ptsRef.current.rotation.y = clock.elapsedTime * 0.006;
    }
  });

  return (
    <points ref={ptsRef} geometry={geometry}>
      <pointsMaterial
        color="#dbeafe"
        size={0.032}
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  );
}

function PlanetScene({
  signature,
  layers,
  playing,
  reducedMotion,
  rotationOffset,
  zoomFactor = 1,
  onVisualOriginChange,
}: Omit<EarthGlobe3DProps, "className">) {
  const { camera, size, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const sigRef = useRef(signature);
  const layersRef = useRef(layers);
  const playingRef = useRef(playing);
  const rotOffsetRef = useRef(rotationOffset);
  const lastPaintRef = useRef(-10);

  sigRef.current = signature;
  layersRef.current = layers;
  playingRef.current = playing;
  rotOffsetRef.current = rotationOffset;

  // Canvas de superficie 2048×1024 para aprovechar toda la nitidez de Blue Marble
  const surfaceCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1024;
    return c;
  }, []);

  const surfaceTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(surfaceCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [gl, surfaceCanvas]);

  const cloudTexture = useMemo(() => {
    const cloudCanvas = getCloudDeckCanvas();
    const fallback = document.createElement("canvas");
    fallback.width = 4;
    fallback.height = 2;
    const t = new THREE.CanvasTexture(cloudCanvas ?? fallback);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    registerCloudTexture(t);
    return t;
  }, [gl]);

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          uMap: { value: surfaceTexture },
          uCloudMap: { value: cloudTexture },
          uCloudOffsetU: { value: 0 },
          uCloudOpacity: { value: 0.75 },
          uTexelSize: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
        },
      }),
    [cloudTexture, surfaceTexture],
  );

  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uCloudMap: { value: cloudTexture },
          uCloudOffsetU: { value: 0 },
          uCloudOpacity: { value: 0.75 },
        },
      }),
    [cloudTexture],
  );

  const atmosMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMOS_VERTEX,
        fragmentShader: ATMOS_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    [],
  );

  const repaintSurface = useMemo(
    () => (tSec: number) => {
      const ctx = surfaceCanvas.getContext("2d");
      if (!ctx) return;
      // Asegura tamaño ajustado si el mapa activo es sintético (640x320) o Blue Marble (2048x1024)
      const base = getEarthBaseAssets();
      const targetW = base && base.width >= 1536 ? base.width : 1024;
      const targetH = base && base.height >= 768 ? base.height : 512;
      if (surfaceCanvas.width !== targetW || surfaceCanvas.height !== targetH) {
        surfaceCanvas.width = targetW;
        surfaceCanvas.height = targetH;
      }
      renderEarthCrustForGlobe(
        ctx,
        surfaceCanvas.width,
        surfaceCanvas.height,
        sigRef.current,
        layersRef.current,
        tSec,
      );
      earthMat.uniforms.uTexelSize.value.set(1 / surfaceCanvas.width, 1 / surfaceCanvas.height);
      surfaceTexture.needsUpdate = true;
    },
    [earthMat, surfaceCanvas, surfaceTexture],
  );

  // Descarga en segundo plano de NASA GIBS Blue Marble (público sin credenciales)
  useEffect(() => {
    onVisualOriginChange?.(getEarthVisualOrigin());
    const unsub = subscribeNasaBlueMarble((origin) => {
      onVisualOriginChange?.(origin);
      repaintSurface(performance.now() * 0.001);
    });
    return unsub;
  }, [onVisualOriginChange, repaintSurface]);

  useEffect(() => {
    repaintSurface(performance.now() * 0.001);
  }, [layers, repaintSurface, signature]);

  useEffect(() => {
    return () => {
      surfaceTexture.dispose();
      cloudTexture.dispose();
      earthMat.dispose();
      cloudMat.dispose();
      atmosMat.dispose();
    };
  }, [atmosMat, cloudMat, cloudTexture, earthMat, surfaceTexture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    // Ajuste automático de distancia + factor de zoom interactivo sin recortar los anillos orbitales
    const aspect = Math.max(0.42, size.width / Math.max(1, size.height));
    const camZ = (3.45 * zoomFactor) / Math.min(1, aspect * 0.94);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, camZ, 1 - Math.exp(-8 * dt));

    // Actualización de nubosidad real sobre la esfera atmosférica
    const cloudVar = sigRef.current.variables.cloudFraction;
    const cf = cloudVar.quality === "ok" && cloudVar.value !== null ? cloudVar.value : 0.42;
    const targetCloudOpacity = layersRef.current.clouds ? Math.max(0.18, Math.min(1, 0.35 + cf * 0.65)) : 0;
    const curOp = cloudMat.uniforms.uCloudOpacity.value as number;
    const nextOp = THREE.MathUtils.lerp(curOp, targetCloudOpacity, 1 - Math.exp(-5 * dt));
    cloudMat.uniforms.uCloudOpacity.value = nextOp;
    earthMat.uniforms.uCloudOpacity.value = nextOp;

    const driftU = reducedMotion ? 0 : t * 0.0045;
    cloudMat.uniforms.uCloudOffsetU.value = driftU;
    earthMat.uniforms.uCloudOffsetU.value = driftU;

    // Si la capa Fuego está activa, refresca suavemente el pulso térmico sin recalcular el globo cada frame
    if (layersRef.current.fire && !reducedMotion && t - lastPaintRef.current > 0.25) {
      lastPaintRef.current = t;
      repaintSurface(t);
    }

    const grp = groupRef.current;
    if (grp) {
      const s = sigRef.current;
      const centerLon = (s.region.lon[0] + s.region.lon[1]) * 0.5;
      const centerLat = (s.region.lat[0] + s.region.lat[1]) * 0.5;
      const lonRad = (centerLon * Math.PI) / 180;
      const latRad = THREE.MathUtils.clamp((centerLat * Math.PI) / 180, -1.35, 1.35);

      const spin = reducedMotion || !playingRef.current ? 0 : Math.sin(t * 0.24) * 0.04;
      const targetRotY = -Math.PI * 0.5 - lonRad + spin + rotOffsetRef.current.yaw;
      const targetRotX = THREE.MathUtils.clamp(
        latRad + rotOffsetRef.current.pitch,
        -1.35,
        1.35,
      );

      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, targetRotY, 1 - Math.exp(-4.5 * dt));
      grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, targetRotX, 1 - Math.exp(-4.5 * dt));
    }
  });

  return (
    <>
      <Starfield reducedMotion={reducedMotion} />
      <group ref={groupRef}>
        <mesh material={earthMat}>
          <sphereGeometry args={[1, 72, 54]} />
        </mesh>
        <mesh material={cloudMat}>
          <sphereGeometry args={[1.016, 72, 54]} />
        </mesh>
        <mesh scale={1.04} material={atmosMat}>
          <sphereGeometry args={[1, 48, 36]} />
        </mesh>
      </group>
      {REFERENCE_ORBITS.map((orbit) => (
        <OrbitRing key={orbit.color} orbit={orbit} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}

export function EarthGlobe3D({
  signature,
  layers,
  playing,
  reducedMotion,
  rotationOffset,
  zoomFactor = 1,
  onVisualOriginChange,
  className,
}: EarthGlobe3DProps) {
  return (
    <div className={className} style={{ width: "100%", height: "100%", touchAction: "none" }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3.45], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <PlanetScene
          signature={signature}
          layers={layers}
          playing={playing}
          reducedMotion={reducedMotion}
          rotationOffset={rotationOffset}
          zoomFactor={zoomFactor}
          onVisualOriginChange={onVisualOriginChange}
        />
      </Canvas>
    </div>
  );
}
