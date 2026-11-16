import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildCircuitLayout, SPHERE_RADIUS } from "./circuitTraces";
import { traceFragment, traceVertex } from "./shaders";
import {
  crystalDustFragment,
  crystalDustVertex,
  crystalHaloFragment,
  crystalHaloVertex,
  crystalHazeFragment,
  crystalHazeVertex,
  crystalSphereFragment,
  crystalSphereVertex,
} from "./crystalShaders";
import type { AudioLevels } from "../audio/audioLevels";

type LevelsRef = MutableRefObject<AudioLevels>;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Quaternion que orienta +Z local hacia la normal de la esfera en `p`. */
function normalQuaternion(p: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    p.clone().normalize(),
  );
}

function spatialRingColors(p: THREE.Vector3): { ring: string; inner: string } {
  const d = Math.hypot(p.x, p.y + 0.14);
  if (d < 0.36) return { ring: "#9ef2ff", inner: "#7b3fe4" };
  if (d < 0.64) return { ring: "#b799ff", inner: "#5721b8" };
  return { ring: "#9462f0", inner: "#2c0d6b" };
}

/* ─────────────────────────── Wordmark (SONUS / DESDE 2026) ─────────────────────────── */

function drawWordmarkToCanvas(canvas: HTMLCanvasElement): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const stack = `"Orbitron", "Bahnschrift", "Rajdhani", system-ui, sans-serif`;

  ctx.font = `800 220px ${stack}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "18px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const grad = ctx.createLinearGradient(0, 75, 0, 285);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.55, "#e6eeff");
  grad.addColorStop(1, "#a7ecff");
  ctx.shadowColor = "rgba(139, 92, 246, 0.92)";
  ctx.shadowBlur = 32;
  ctx.fillStyle = grad;
  ctx.fillText("SONUS", w / 2, 185);
  ctx.shadowBlur = 0;
  ctx.fillText("SONUS", w / 2, 185);

  ctx.font = `700 66px ${stack}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "38px";
  ctx.shadowColor = "rgba(147, 85, 232, 0.72)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#9d62f5";
  ctx.fillText("SINCE 2026", w / 2 + 18, 415);
  ctx.shadowBlur = 0;
}

function makeWordmarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 520;
  drawWordmarkToCanvas(canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (typeof document !== "undefined" && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      drawWordmarkToCanvas(canvas);
      tex.needsUpdate = true;
    });
  }
  return tex;
}

/* ─────────────────────── Escena Crystalized Ball + Holograma SONUS ─────────────────── */

function Scene({
  levels,
  reduced,
  showWordmark,
  showParticles,
  speaking,
  clickImpulseRef,
}: {
  levels: LevelsRef;
  reduced: boolean;
  showWordmark: boolean;
  showParticles: boolean;
  speaking: boolean;
  clickImpulseRef: MutableRefObject<number>;
}) {
  const layout = useMemo(() => buildCircuitLayout({ traceCount: 10 }), []);

  const root = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Group>(null);
  const textGroup = useRef<THREE.Group>(null);
  const outerParticles = useRef<THREE.Points>(null);
  const centerPulse = useRef<THREE.Mesh>(null);
  const clickWave = useRef<THREE.Mesh>(null);
  const nodeGroups = useRef<THREE.Group[]>([]);
  const [hovered, setHovered] = useState(false);
  const hover = useRef(0);
  const speakSmooth = useRef(0);
  const pointerSmooth = useRef(new THREE.Vector2(0, 0));

  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uSpeak: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uImpulse: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1 },
    }),
    [],
  );

  const sphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: crystalSphereVertex,
        fragmentShader: crystalSphereFragment,
        uniforms: {
          uTime: shared.uTime,
          uHover: shared.uHover,
          uSpeak: shared.uSpeak,
          uEnergy: shared.uEnergy,
          uBass: shared.uBass,
          uImpulse: shared.uImpulse,
          uPointer: shared.uPointer,
        },
        transparent: true,
        depthWrite: false,
      }),
    [shared],
  );

  const hazeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: crystalHazeVertex,
        fragmentShader: crystalHazeFragment,
        uniforms: {
          uTime: shared.uTime,
          uSpeak: shared.uSpeak,
          uHover: shared.uHover,
          uEnergy: shared.uEnergy,
          uImpulse: shared.uImpulse,
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [shared],
  );

  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: crystalHaloVertex,
        fragmentShader: crystalHaloFragment,
        uniforms: {
          uSpeak: shared.uSpeak,
          uHover: shared.uHover,
          uBass: shared.uBass,
          uImpulse: shared.uImpulse,
        },
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [shared],
  );

  const dustMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: crystalDustVertex,
        fragmentShader: crystalDustFragment,
        uniforms: {
          uTime: shared.uTime,
          uSpeak: shared.uSpeak,
          uHover: shared.uHover,
          uEnergy: shared.uEnergy,
          uImpulse: shared.uImpulse,
          uPixelRatio: shared.uPixelRatio,
          uPointer: shared.uPointer,
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [shared],
  );

  // Pistas holográficas de circuito SONUS sobre/dentro de la esfera cristalizada
  const tubes = useMemo(
    () =>
      layout.traces.map((t) => {
        const curve = new THREE.CatmullRomCurve3(t.points, false, "centripetal");
        const radius = 0.0175 * (t.radiusScale ?? 1);
        const geometry = new THREE.TubeGeometry(curve, Math.max(72, t.points.length * 2), radius, 12, false);
        const material = new THREE.ShaderMaterial({
          vertexShader: traceVertex,
          fragmentShader: traceFragment,
          uniforms: {
            uTime: shared.uTime,
            uTreble: shared.uTreble,
            uEnergy: shared.uEnergy,
            uPhase: { value: (t.index * 0.14) % 1 },
            uSpeed: { value: 0.14 + t.index * 0.018 },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        return { index: t.index, geometry, material };
      }),
    [layout, shared],
  );

  // Partículas internas cristalinas: mezcla de polvo volumétrico + partículas con la forma exacta del circuito SONUS
  const innerDustGeometry = useMemo(() => {
    const circuitSamples: THREE.Vector3[] = [];
    layout.traces.forEach((tr) => {
      const curve = new THREE.CatmullRomCurve3(tr.points, false, "centripetal");
      const pts = curve.getPoints(20);
      pts.forEach((pt) => circuitSamples.push(pt.clone().multiplyScalar(0.97)));
    });

    const volumetricCount = 280;
    const total = volumetricCount + circuitSamples.length;
    const pos = new Float32Array(total * 3);
    const seeds = new Float32Array(total * 4);
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    // 1) Partículas que forman la silueta holográfica de circuitos SONUS
    for (let i = 0; i < circuitSamples.length; i++) {
      const p = circuitSamples[i];
      pos[i * 3] = p.x + (rnd() - 0.5) * 0.025;
      pos[i * 3 + 1] = p.y + (rnd() - 0.5) * 0.025;
      pos[i * 3 + 2] = p.z + (rnd() - 0.5) * 0.025;

      seeds[i * 4] = rnd() * Math.PI * 2;
      seeds[i * 4 + 1] = 0.55 + rnd() * 0.9;
      seeds[i * 4 + 2] = 0.65 + rnd() * 0.75;
      seeds[i * 4 + 3] = 0.15 + rnd() * 0.55; // cian/violeta holográfico
    }

    // 2) Polvo cristalino interior de la Crystalized Ball
    for (let j = 0; j < volumetricCount; j++) {
      const i = circuitSamples.length + j;
      const r = Math.cbrt(rnd()) * (SPHERE_RADIUS * 0.88);
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      seeds[i * 4] = rnd() * Math.PI * 2;
      seeds[i * 4 + 1] = 0.4 + rnd() * 1.3;
      seeds[i * 4 + 2] = 0.45 + rnd() * 0.95;
      seeds[i * 4 + 3] = rnd();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [layout]);

  // Polvo estelar orbital exterior
  const orbitPoints = useMemo(() => {
    const count = 180;
    const pos = new Float32Array(count * 3);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const r = 1.24 + rnd() * 0.72;
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const wordmark = useMemo(() => makeWordmarkTexture(), []);
  const centerQuat = useMemo(() => normalQuaternion(layout.center), [layout]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useEffect(
    () => () => {
      sphereMaterial.dispose();
      hazeMaterial.dispose();
      haloMaterial.dispose();
      dustMaterial.dispose();
      tubes.forEach((t) => {
        t.geometry.dispose();
        t.material.dispose();
      });
      innerDustGeometry.dispose();
      orbitPoints.dispose();
      wordmark.dispose();
    },
    [sphereMaterial, hazeMaterial, haloMaterial, dustMaterial, tubes, innerDustGeometry, orbitPoints, wordmark],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const L = levels.current;
    const motion = reduced ? 0.25 : 1;

    const baseZ = showWordmark ? 5.65 : 3.9;
    const aspect = Math.max(0.35, state.size.width / Math.max(1, state.size.height));
    const desiredZ = baseZ / Math.min(1, aspect * 0.92);
    state.camera.position.z += (desiredZ - state.camera.position.z) * Math.min(1, delta * 8);

    hover.current += ((hovered ? 1 : 0) - hover.current) * Math.min(1, delta * 6);
    speakSmooth.current += ((speaking ? 1 : 0) - speakSmooth.current) * Math.min(1, delta * 5.5);
    clickImpulseRef.current = Math.max(0, clickImpulseRef.current - delta * 1.7);
    const impulse = clickImpulseRef.current;

    pointerSmooth.current.x += (state.pointer.x - pointerSmooth.current.x) * Math.min(1, delta * 8);
    pointerSmooth.current.y += (state.pointer.y - pointerSmooth.current.y) * Math.min(1, delta * 8);

    shared.uTime.value = t;
    shared.uHover.value = hover.current;
    shared.uSpeak.value = speakSmooth.current;
    shared.uEnergy.value = Math.min(1.5, L.energy + speakSmooth.current * 0.45 + impulse * 0.7);
    shared.uBass.value = Math.min(1.5, L.bass + speakSmooth.current * 0.35 + impulse * 0.75);
    shared.uMid.value = Math.min(1.5, L.mid + speakSmooth.current * 0.4 + impulse * 0.6);
    shared.uTreble.value = Math.min(1.5, L.treble + speakSmooth.current * 0.5 + impulse * 0.85);
    shared.uImpulse.value = impulse;
    shared.uPointer.value.copy(pointerSmooth.current);
    shared.uPixelRatio.value = state.gl.getPixelRatio();

    if (orb.current) {
      const shakeX = impulse > 0.02 ? Math.sin(t * 48) * impulse * 0.045 * motion : 0;
      const shakeY = impulse > 0.02 ? Math.cos(t * 42) * impulse * 0.045 * motion : 0;
      orb.current.position.set(shakeX, shakeY, 0);

      const targetY = pointerSmooth.current.x * 0.3 + Math.sin(t * 0.35) * 0.09 * motion;
      const targetX = -pointerSmooth.current.y * 0.2 + Math.sin(t * 0.27 + 1) * 0.045 * motion;
      orb.current.rotation.y += (targetY - orb.current.rotation.y) * Math.min(1, delta * 4);
      orb.current.rotation.x += (targetX - orb.current.rotation.x) * Math.min(1, delta * 4);

      const vocalPulse = speakSmooth.current * (0.028 + 0.018 * Math.sin(t * 11.5));
      const s = 1 + L.bass * 0.045 + hover.current * 0.03 + impulse * 0.045 + vocalPulse;
      orb.current.scale.setScalar(s);
    }

    if (textGroup.current) {
      textGroup.current.rotation.y += (pointerSmooth.current.x * 0.12 - textGroup.current.rotation.y) * Math.min(1, delta * 3);
      textGroup.current.rotation.x += (-pointerSmooth.current.y * 0.06 - textGroup.current.rotation.x) * Math.min(1, delta * 3);
    }

    if (outerParticles.current) {
      const spinSpeed = 0.04 + L.energy * 0.85 + speakSmooth.current * 1.05 + impulse * 1.4;
      outerParticles.current.rotation.y += delta * spinSpeed * motion;
      outerParticles.current.rotation.x = Math.sin(t * 0.25) * (0.1 + speakSmooth.current * 0.12);
      const mat = outerParticles.current.material as THREE.PointsMaterial;
      mat.opacity = 0.25 + L.treble * 0.55 + speakSmooth.current * 0.45 + hover.current * 0.12 + impulse * 0.25;
      mat.size = 0.016 + L.energy * 0.026 + speakSmooth.current * 0.016 + impulse * 0.018;
    }

    nodeGroups.current.forEach((g, i) => {
      if (g) {
        g.scale.setScalar(
          1 + L.mid * 0.45 + speakSmooth.current * 0.22 + impulse * 0.4 + Math.sin(t * 2.2 + i) * 0.04 * motion,
        );
      }
    });

    if (centerPulse.current) {
      const ring = (t * (0.65 + speakSmooth.current * 0.55)) % 1;
      centerPulse.current.scale.setScalar(1 + ring * (1.35 + L.bass * 1.8 + speakSmooth.current * 0.8));
      (centerPulse.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - ring) * (0.42 + L.bass * 0.7 + speakSmooth.current * 0.4);
    }

    if (clickWave.current) {
      const prog = 1 - impulse;
      clickWave.current.visible = impulse > 0.01;
      clickWave.current.scale.setScalar(1 + prog * 2.4);
      (clickWave.current.material as THREE.MeshBasicMaterial).opacity = impulse * 0.85;
    }
  });

  return (
    <group ref={root} position={[0, showWordmark ? 0.34 : 0, 0]}>
      <group
        ref={orb}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          clickImpulseRef.current = 1;
        }}
      >
        {/* Bruma volumétrica interior */}
        <mesh material={hazeMaterial} scale={0.95}>
          <sphereGeometry args={[SPHERE_RADIUS, 48, 48]} />
        </mesh>

        {/* Partículas cristalinas interiores (incluye forma holográfica SONUS y remolino al hablar) */}
        <points geometry={innerDustGeometry} material={dustMaterial} />

        {/* Trazos holográficos de circuito SONUS dentro del cristal */}
        {tubes.map((t) => (
          <mesh key={t.index} geometry={t.geometry} material={t.material} />
        ))}

        {/* Ojales terminales holográficos */}
        {layout.traces.map((tr, i) => {
          const ringScale = tr.radiusScale ?? 1;
          const startCols = spatialRingColors(tr.start);
          const endCols = spatialRingColors(tr.end);
          return (
            <group key={`n${tr.index}`}>
              {tr.hasStartRing !== false && (
                <group
                  position={tr.start}
                  quaternion={normalQuaternion(tr.start)}
                  ref={(el) => {
                    if (el) nodeGroups.current[i * 2] = el;
                  }}
                >
                  <mesh position={[0, 0, -0.001]}>
                    <circleGeometry args={[0.028 * ringScale, 28]} />
                    <meshBasicMaterial color={startCols.inner} transparent opacity={0.65} depthWrite={false} />
                  </mesh>
                  <mesh>
                    <ringGeometry args={[0.027 * ringScale, 0.052 * ringScale, 32]} />
                    <meshBasicMaterial color={startCols.ring} transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} />
                  </mesh>
                </group>
              )}
              {tr.hasEndRing !== false && (
                <group
                  position={tr.end}
                  quaternion={normalQuaternion(tr.end)}
                  ref={(el) => {
                    if (el) nodeGroups.current[i * 2 + 1] = el;
                  }}
                >
                  <mesh position={[0, 0, -0.001]}>
                    <circleGeometry args={[0.027 * ringScale, 28]} />
                    <meshBasicMaterial color={endCols.inner} transparent opacity={0.65} depthWrite={false} />
                  </mesh>
                  <mesh>
                    <ringGeometry args={[0.026 * ringScale, 0.05 * ringScale, 32]} />
                    <meshBasicMaterial color={endCols.ring} transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} />
                  </mesh>
                </group>
              )}
            </group>
          );
        })}

        {/* Nodo focal central holográfico */}
        <group position={layout.center} quaternion={centerQuat}>
          <mesh position={[0, 0, -0.001]}>
            <circleGeometry args={[0.052, 32]} />
            <meshBasicMaterial color="#874cf2" transparent opacity={0.75} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.051, 0.098, 40]} />
            <meshBasicMaterial color="#9ef2ff" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={centerPulse}>
            <ringGeometry args={[0.105, 0.118, 44]} />
            <meshBasicMaterial color="#8feeff" transparent opacity={0.35} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* Esfera dieléctrica de cristal con borde eléctrico crepitante */}
        <mesh material={sphereMaterial}>
          <sphereGeometry args={[SPHERE_RADIUS, 96, 96]} />
        </mesh>

        {/* Halo atmosférico exterior */}
        <mesh material={haloMaterial} scale={1.18}>
          <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
        </mesh>

        {/* Onda expansiva al hacer clic */}
        <mesh ref={clickWave} visible={false}>
          <ringGeometry args={[SPHERE_RADIUS * 0.98, SPHERE_RADIUS * 1.04, 64]} />
          <meshBasicMaterial
            color="#00D9FF"
            transparent
            opacity={0.8}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Partículas orbitales exteriores */}
      {showParticles && (
        <points ref={outerParticles} geometry={orbitPoints}>
          <pointsMaterial
            color="#9ef2ff"
            size={0.018}
            sizeAttenuation
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Wordmark */}
      {showWordmark && (
        <group ref={textGroup} position={[0, -1.66, 0.15]}>
          <mesh>
            <planeGeometry args={[3.7, 1.375]} />
            <meshBasicMaterial map={wordmark} transparent toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ───────────────────────────── Fallback sin WebGL ───────────────────────────────────── */

export function SonusLogoFallback() {
  return (
    <div className="logo-fallback" role="img" aria-label="SONUS Logo since 2026">
      <div className="logo-fallback__orb" />
      <div className="logo-fallback__word">SONUS</div>
      <div className="logo-fallback__since">SINCE 2026</div>
    </div>
  );
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ─────────────────────────────────── Componente público ─────────────────────────────── */

export interface SonusLogo3DProps {
  /** Referencia con los niveles de audio vivos (bass/mid/treble/energy en 0..1). */
  levels: LevelsRef;
  className?: string;
  /** Muestra la tipografía "SONUS DESDE 2026" debajo de la esfera. */
  showWordmark?: boolean;
  /** Muestra partículas orbitales reactivas alrededor de la esfera. */
  showParticles?: boolean;
  /** Indica si SONUS está hablando para activar el remolino de partículas cristalinas. */
  speaking?: boolean;
  /** Callback opcional al hacer clic sobre la esfera 3D. */
  onLogoClick?: () => void;
}

export function SonusLogo3D({
  levels,
  className,
  showWordmark = true,
  showParticles = true,
  speaking = false,
  onLogoClick,
}: SonusLogo3DProps) {
  const [webgl] = useState(detectWebGL);
  const reduced = useMemo(prefersReducedMotion, []);
  const clickImpulseRef = useRef(0);
  const pointerDownRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!webgl) return <SonusLogoFallback />;

  const camPos: [number, number, number] = showWordmark ? [0, -0.3, 5.6] : [0, 0, 3.9];

  return (
    <div
      className={className}
      role="img"
      aria-label="Núcleo SONUS 3D cristalizado holográfico, desde 2026"
      onPointerDown={(e) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const dx = e.clientX - pointerDownRef.current.x;
        const dy = e.clientY - pointerDownRef.current.y;
        if (dx * dx + dy * dy <= 36) {
          clickImpulseRef.current = 1;
          onLogoClick?.();
        }
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: camPos, fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Scene
          levels={levels}
          reduced={reduced}
          showWordmark={showWordmark}
          showParticles={showParticles}
          speaking={speaking}
          clickImpulseRef={clickImpulseRef}
        />
      </Canvas>
    </div>
  );
}
