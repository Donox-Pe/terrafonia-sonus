import { describe, expect, it } from "vitest";
import { createLocalFallbackSignature } from "../transport/signatureClient";
import {
  computeGlobeViewState,
  raycastGlobeDisk,
  renderProjectedGlobeDisk,
} from "./globeProjection";

describe("globeProjection", () => {
  it("centra el rayo del disco en la longitud y latitud de la región activa", () => {
    const amazonia = createLocalFallbackSignature("amazonia", "2024-06-01", 0);
    const view = computeGlobeViewState(
      amazonia,
      { yaw: 0, pitch: 0 },
      1,
      1,
      0,
      false,
      true,
    );

    const centerHit = raycastGlobeDisk(0, 0, view);
    expect(centerHit).not.toBeNull();
    const expectedLon = (amazonia.region.lon[0] + amazonia.region.lon[1]) * 0.5;
    const expectedLat = (amazonia.region.lat[0] + amazonia.region.lat[1]) * 0.5;
    expect(centerHit!.lonDeg).toBeCloseTo(expectedLon, 0);
    expect(centerHit!.latDeg).toBeCloseTo(expectedLat, 0);
  });

  it("centra exactamente el Sahara y el Ártico en su latitud y longitud", () => {
    const sahara = createLocalFallbackSignature("sahara", "2024-06-01", 0);
    const saharaView = computeGlobeViewState(sahara, { yaw: 0, pitch: 0 }, 1, 1, 0, false, true);
    const saharaHit = raycastGlobeDisk(0, 0, saharaView)!;
    expect(saharaHit.lonDeg).toBeCloseTo(9, 0);
    expect(saharaHit.latDeg).toBeCloseTo(22.5, 0);

    const artico = createLocalFallbackSignature("artico", "2024-06-01", 0);
    const articoView = computeGlobeViewState(artico, { yaw: 0, pitch: 0 }, 1, 1, 0, false, true);
    const articoHit = raycastGlobeDisk(0, 0, articoView)!;
    expect(articoHit.lonDeg).toBeCloseTo(12.5, 0);
    expect(articoHit.latDeg).toBeCloseTo(77, 0);
  });

  it("descarta rayos fuera de la silueta esférica del planeta", () => {
    const amazonia = createLocalFallbackSignature("amazonia", "2024-06-01", 0);
    const view = computeGlobeViewState(
      amazonia,
      { yaw: 0, pitch: 0 },
      1,
      1,
      0,
      false,
      true,
    );

    expect(raycastGlobeDisk(0.95, 0.95, view)).toBeNull();
  });

  it("limita beamViewportX al diámetro aparente del disco planetario", () => {
    const amazonia = createLocalFallbackSignature("amazonia", "2024-06-01", 0);
    const view = computeGlobeViewState(
      amazonia,
      { yaw: 0, pitch: 0 },
      1,
      1.6,
      0,
      false,
      true,
    );
    const eqData = new Uint8ClampedArray(64 * 32 * 4).fill(180);
    const outData = new Uint8ClampedArray(32 * 32 * 4);

    const leftGeo = renderProjectedGlobeDisk(eqData, 64, 32, outData, 32, 32, view, 0);
    const rightGeo = renderProjectedGlobeDisk(eqData, 64, 32, outData, 32, 32, view, 1);

    expect(leftGeo.beamViewportX).toBeCloseTo(0.5 - view.diskRadiusX, 3);
    expect(rightGeo.beamViewportX).toBeCloseTo(0.5 + view.diskRadiusX, 3);
    expect(leftGeo.beamViewportX).toBeGreaterThan(0.1);
    expect(rightGeo.beamViewportX).toBeLessThan(0.9);
  });
});
