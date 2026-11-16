/**
 * Geometría procedural de las pistas de circuito del logo SONUS.
 *
 * Módulo puro (sin React ni WebGL): solo calcula puntos en 3D, de modo que
 * pueda probarse con vitest en Node.
 *
 * Idea de diseño: el logo de referencia muestra "buses" de pistas anidadas que
 * convergen hacia un nodo central. Aquí cada pista se define en un plano 2D
 * (u, v) sobre el hemisferio frontal y luego se PROYECTA sobre la esfera, de
 * modo que las pistas se curvan siguiendo la superficie (no son líneas planas).
 * Las esquinas usan chaflanes de 45°, como el ruteo de una placa de circuito.
 */
import { Vector3 } from "three";

/** Radio de la esfera del logo (unidades de escena). */
export const SPHERE_RADIUS = 1;
/** Separación mínima sobre la superficie para evitar z-fighting. */
export const SURFACE_OFFSET = 0.006;
/** Radio máximo (en el plano u,v) permitido a una pista: evita el borde de la esfera. */
export const MAX_PLANAR_RADIUS = 0.93;

export interface CircuitTrace {
  /** Índice de la pista (0 = tallo central). */
  index: number;
  /** Puntos densos sobre la superficie, de inicio a fin. */
  points: Vector3[];
  /** Posición del nodo inicial. */
  start: Vector3;
  /** Posición del nodo final. */
  end: Vector3;
  /** Si debe renderizarse anillo ojal en start / end. */
  hasStartRing?: boolean;
  hasEndRing?: boolean;
  /** Factor de grosor visual relativo del tubo. */
  radiusScale?: number;
}

export interface CircuitLayout {
  /** Posición del nodo central (foco cian). */
  center: Vector3;
  traces: CircuitTrace[];
}

export interface CircuitOptions {
  /** Número de pistas anidadas. */
  traceCount?: number;
  /** Centro del bus en el plano (u, v). */
  centerUV?: readonly [number, number];
  /** Semilla del PRNG: mismo valor ⇒ mismo diseño. */
  seed?: number;
  /** Paso de densificación en el plano (menor = más suave). */
  step?: number;
}

/** PRNG determinista (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Proyecta un punto del plano (u, v) sobre el hemisferio frontal de la esfera.
 * Si el punto cae fuera de MAX_PLANAR_RADIUS se reescala hacia dentro.
 */
export function projectToSphere(u: number, v: number): Vector3 {
  const r = Math.hypot(u, v);
  if (r > MAX_PLANAR_RADIUS) {
    const s = MAX_PLANAR_RADIUS / r;
    u *= s;
    v *= s;
  }
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return new Vector3(u, v, z).multiplyScalar(SPHERE_RADIUS + SURFACE_OFFSET);
}

/** Subdivide una polilínea 2D en pasos ≤ `step` para que siga la curvatura al proyectarla. */
export function densify(
  poly: ReadonlyArray<readonly [number, number]>,
  step: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  const last = poly[poly.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

interface TraceBlueprint {
  poly: Array<[number, number]>;
  hasStartRing: boolean;
  hasEndRing: boolean;
  radiusScale: number;
}

function quadCurve(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  segments = 16,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const inv = 1 - t;
    out.push([
      inv * inv * p0[0] + 2 * inv * t * p1[0] + t * t * p2[0],
      inv * inv * p0[1] + 2 * inv * t * p1[1] + t * t * p2[1],
    ]);
  }
  return out;
}

/** Construye el diseño completo de pistas. Determinista para una semilla dada. */
export function buildCircuitLayout(options: CircuitOptions = {}): CircuitLayout {
  const { traceCount = 6, centerUV = [-0.02, 0.06], seed = 2026, step = 0.02 } = options;
  const rng = createRng(seed);
  const [cx, cy] = centerUV;
  const jitter = () => (rng() - 0.5) * 0.005;

  const blueprints: TraceBlueprint[] = [
    // 0: Tallo central cian que desciende del anillo focal y barre el creciente inferior-izquierdo.
    {
      poly: [
        [cx, cy - 0.08],
        [0.04, -0.34],
        ...quadCurve([0.04, -0.34], [-0.08, -0.60], [-0.54 + jitter(), -0.62]),
      ],
      hasStartRing: false,
      hasEndRing: false,
      radiusScale: 1.48,
    },
    // 1: Segundo tallo inferior derecho que desciende paralelo bajo el tallo héroe.
    {
      poly: [
        [0.24 + jitter(), 0.02],
        [0.25, -0.34],
        ...quadCurve([0.25, -0.34], [0.10, -0.64], [-0.38 + jitter(), -0.70]),
      ],
      hasStartRing: true,
      hasEndRing: false,
      radiusScale: 1.15,
    },
    // 2: Bus diagonal derecho prominente con codo redondeado en hemisferio inferior-derecho.
    {
      poly: [
        [0.30 + jitter(), 0.42],
        [0.49, -0.18],
        ...quadCurve([0.49, -0.18], [0.42, -0.60], [-0.12 + jitter(), -0.78]),
      ],
      hasStartRing: true,
      hasEndRing: false,
      radiusScale: 1.32,
    },
    // 3: Codo izquierdo interno con chaflán 45° entre ojal inferior-izquierdo y superior-centro.
    {
      poly: [
        [-0.17 + jitter(), -0.34],
        [-0.25, -0.20],
        [-0.25, 0.24],
        [0.10 + jitter(), 0.40],
      ],
      hasStartRing: true,
      hasEndRing: true,
      radiusScale: 1.24,
    },
    // 4: Codo izquierdo paralelo amplio entre ojal inferior-izquierdo y cúpula superior.
    {
      poly: [
        [-0.43 + jitter(), -0.34],
        [-0.50, -0.16],
        [-0.50, 0.36],
        [0.16 + jitter(), 0.62],
      ],
      hasStartRing: true,
      hasEndRing: true,
      radiusScale: 1.32,
    },
    // 5: Arco superior secundario hacia el ojal medio-alto.
    {
      poly: [
        ...quadCurve([-0.48 + jitter(), 0.48], [-0.24, 0.66], [-0.06 + jitter(), 0.72]),
      ],
      hasStartRing: false,
      hasEndRing: true,
      radiusScale: 0.92,
    },
    // 6: Arco superior coronando la cúpula de la esfera.
    {
      poly: [
        ...quadCurve([-0.40 + jitter(), 0.62], [-0.12, 0.80], [0.16 + jitter(), 0.82]),
      ],
      hasStartRing: false,
      hasEndRing: true,
      radiusScale: 1.05,
    },
    // 7: Pista exterior derecha superior descendiendo por el borde derecho.
    {
      poly: [
        [0.70 + jitter(), 0.32],
        [0.77, -0.06],
        ...quadCurve([0.77, -0.06], [0.74, -0.36], [0.46, -0.60]),
      ],
      hasStartRing: true,
      hasEndRing: false,
      radiusScale: 0.94,
    },
    // 8: Pista media-exterior derecha.
    {
      poly: [
        [0.62 + jitter(), 0.12],
        [0.65, -0.18],
        ...quadCurve([0.65, -0.18], [0.56, -0.46], [0.26, -0.68]),
      ],
      hasStartRing: true,
      hasEndRing: false,
      radiusScale: 0.88,
    },
    // 9: Arco fino del borde extremo izquierdo terminando en ojal inferior izquierdo.
    {
      poly: [
        ...quadCurve([-0.68 + jitter(), 0.28], [-0.71, -0.04], [-0.60 + jitter(), -0.32]),
      ],
      hasStartRing: false,
      hasEndRing: true,
      radiusScale: 0.82,
    },
  ];

  const traces: CircuitTrace[] = [];
  for (let i = 0; i < traceCount; i++) {
    const bp = blueprints[i % blueprints.length];
    const points = densify(bp.poly, step).map(([u, v]) => projectToSphere(u, v));
    traces.push({
      index: i,
      points,
      start: points[0].clone(),
      end: points[points.length - 1].clone(),
      hasStartRing: bp.hasStartRing,
      hasEndRing: bp.hasEndRing,
      radiusScale: bp.radiusScale,
    });
  }

  return { center: projectToSphere(cx, cy), traces };
}
