/*
-----------------------------------------------------------------
Kugel-Erstellung & -Darstellung
-----------------------------------------------------------------
*/

import * as l3d from "./lib-3d.ts";
import * as wgl from "./lib-wgl.ts";

/**
 * Erzeugt ein 2D-Array von Punkten auf der Kugeloberfläche.
 *
 * @param radius   Radius der Kugel
 * @param segments Anzahl Längengrade  (0 .. 2*PI)
 * @param rings    Anzahl Breitengrade  (-PI/2 .. +PI/2)
 * @returns Punkte-Gitter [ring][segment]
 */
export function createSphere(
  radius: number,
  segments: number,
  rings: number,
): l3d.Vector3[][] {
  const points: l3d.Vector3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const lat = Math.PI * (r / rings) - Math.PI / 2; // -PI/2 .. +PI/2
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const lon = 2 * Math.PI * (s / segments);       // 0 .. 2*PI
      points[r][s] = new l3d.Vector3(
        radius * Math.cos(lat) * Math.cos(lon),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon),
      );
    }
  }
  return points;
}

/**
 * Zeichnet eine Kugel als Drahtgitter mit Helligkeits-Shading.
 *
 * @param spherePoints  Von createSphere() erzeugtes Punkte-Gitter
 * @param matrix        4x4-Transformationsmatrix (Rotation + Translation)
 * @param fov           Kamera-Brennweite für die Projektion
 * @param tint          Farbe als { r, g, b } (0-255), Standard: bläulich-weiß
 */
export function drawSphere(
  spherePoints: l3d.Vector3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): void {
  const RINGS = spherePoints.length - 1;
  const SEGMENTS = spherePoints[0].length - 1;

  // Alle Punkte transformieren
  const transformed: l3d.Vector3[][] = [];
  for (let r = 0; r <= RINGS; r++) {
    transformed[r] = spherePoints[r].map((v) => v.transform(matrix));
  }

  // Alle Punkte projizieren
  const proj: { x: number; y: number; s: number }[][] = [];
  for (let r = 0; r <= RINGS; r++) {
    proj[r] = transformed[r].map((v) => l3d.project(fov, v));
  }

  // s-Bereich für Helligkeitsnormalisierung
  const sMin = Math.min(...proj.flat().map((p) => p.s));
  const sMax = Math.max(...proj.flat().map((p) => p.s));
  const sRange = sMax - sMin || 1;

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  // --- Breitenkreise (lat = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const p1 = proj[r][s];
      const p2 = proj[r][s + 1];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      wgl.strokeColor(
        Math.round(brightness * tint.r / 255),
        Math.round(brightness * tint.g / 255),
        Math.round(brightness * tint.b / 255),
      );
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }

  // --- Längenkreise (lon = konstant) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      const p1 = proj[r][s];
      const p2 = proj[r + 1][s];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      wgl.strokeColor(
        Math.round(brightness * tint.r / 255),
        Math.round(brightness * tint.g / 255),
        Math.round(brightness * tint.b / 255),
      );
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}
