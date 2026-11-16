import { describe, expect, it } from "vitest";
import {
  MAX_PLANAR_RADIUS,
  SPHERE_RADIUS,
  SURFACE_OFFSET,
  buildCircuitLayout,
  createRng,
  densify,
  projectToSphere,
} from "./circuitTraces";

describe("createRng", () => {
  it("es determinista para la misma semilla", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produce valores en [0, 1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 500; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("projectToSphere", () => {
  it("coloca el punto sobre la superficie (radio + offset)", () => {
    const p = projectToSphere(0.3, -0.2);
    expect(p.length()).toBeCloseTo(SPHERE_RADIUS + SURFACE_OFFSET, 6);
    expect(p.z).toBeGreaterThan(0); // hemisferio frontal
  });

  it("reescala puntos fuera del radio máximo sin producir NaN", () => {
    const p = projectToSphere(5, 5);
    expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(MAX_PLANAR_RADIUS * (SPHERE_RADIUS + SURFACE_OFFSET) + 1e-9);
  });
});

describe("densify", () => {
  it("conserva extremos y respeta el paso máximo", () => {
    const out = densify(
      [
        [0, 0],
        [1, 0],
      ],
      0.1,
    );
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([1, 0]);
    for (let i = 1; i < out.length; i++) {
      expect(Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1])).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });
});

describe("buildCircuitLayout", () => {
  const layout = buildCircuitLayout();

  it("genera el número de pistas pedido (6 por defecto)", () => {
    expect(layout.traces).toHaveLength(6);
    expect(buildCircuitLayout({ traceCount: 3 }).traces).toHaveLength(3);
  });

  it("todos los puntos están sobre la esfera y son finitos", () => {
    for (const t of layout.traces) {
      for (const p of t.points) {
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(p.length()).toBeCloseTo(SPHERE_RADIUS + SURFACE_OFFSET, 5);
      }
    }
  });

  it("start y end coinciden con los extremos de la pista", () => {
    for (const t of layout.traces) {
      expect(t.start.equals(t.points[0])).toBe(true);
      expect(t.end.equals(t.points[t.points.length - 1])).toBe(true);
    }
  });

  it("es determinista y cambia con otra semilla", () => {
    const a = buildCircuitLayout({ seed: 1 });
    const b = buildCircuitLayout({ seed: 1 });
    const c = buildCircuitLayout({ seed: 2 });
    expect(a.traces[3].end.toArray()).toEqual(b.traces[3].end.toArray());
    expect(a.traces[3].end.toArray()).not.toEqual(c.traces[3].end.toArray());
  });

  it("el nodo central cae en el hemisferio frontal", () => {
    expect(layout.center.z).toBeGreaterThan(0.5);
  });
});
