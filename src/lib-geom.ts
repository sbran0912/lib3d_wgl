/*
-----------------------------------------------------------------
3D-Geometrie: Kugel, Box, Zylinder, Kegel, Torus
-----------------------------------------------------------------
Jede Figur besteht aus zwei Export-Funktionen:
  create*()  – erzeugt das 3D-Punkte-Gitter
  draw*()    – transformiert, projiziert & zeichnet Drahtgitter mit Shading
-----------------------------------------------------------------
*/

import * as l3d from "./lib-3d.ts";
import * as wgl from "./lib-wgl.ts";

/* =================================================================
   HILFSFUNKTIONEN (intern)
   ================================================================= */

/**
 * Transformiert + projiziert ein 2D-Gitter [row][col] von Vec3.
 * Liefert projiziertes Gitter und s-Bereich für Helligkeit.
 */
function transformAndProject(
  points: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
): { proj: l3d.Vec2[][]; sMin: number; sMax: number } {
  const ROWS = points.length;
  const transformed: l3d.Vec3[][] = [];
  const proj: l3d.Vec2[][] = [];
  let sMin = Infinity;
  let sMax = -Infinity;

  for (let r = 0; r < ROWS; r++) {
    transformed[r] = points[r].map((v) => v.transform(matrix));
    proj[r] = transformed[r].map((v) => {
      const p = l3d.project(fov, v);
      if (p.s < sMin) sMin = p.s;
      if (p.s > sMax) sMax = p.s;
      return p;
    });
  }
  return { proj, sMin, sMax };
}

/**
 * Gibt Helligkeit (0-255) für eine Tiefenposition s im Bereich [sMin, sMax].
 */
function brightnessFromDepth(
  s: number,
  sMin: number,
  sMax: number,
  tint: { r: number; g: number; b: number },
): [number, number, number] {
  const sRange = sMax - sMin || 1;
  const t = (s - sMin) / sRange;
  const b = Math.round(60 + t * 195);
  return [
    Math.round((b * tint.r) / 255),
    Math.round((b * tint.g) / 255),
    Math.round((b * tint.b) / 255),
  ];
}

/** Zeichnet eine einzelne Kante mit Tiefen-Shading. */
function shadedLine(
  p1: l3d.Vec2,
  p2: l3d.Vec2,
  sMin: number,
  sMax: number,
  tint: { r: number; g: number; b: number },
) {
  const s = (p1.s + p2.s) / 2;
  const [r, g, b] = brightnessFromDepth(s, sMin, sMax, tint);
  wgl.strokeColor(r, g, b);
  wgl.line(p1.x, p1.y, p2.x, p2.y);
}

/* =================================================================
   KUGEL (Sphere)
   ================================================================= */

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
): l3d.Vec3[][] {
  const points: l3d.Vec3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const lat = Math.PI * (r / rings) - Math.PI / 2; // -PI/2 .. +PI/2
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const lon = 2 * Math.PI * (s / segments); // 0 .. 2*PI
      points[r][s] = new l3d.Vec3(
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
  spherePoints: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): void {
  const RINGS = spherePoints.length - 1;
  const SEGMENTS = spherePoints[0].length - 1;

  const { proj, sMin, sMax } = transformAndProject(spherePoints, matrix, fov);

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  // --- Breitenkreise (lat = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }

  // --- Längenkreise (lon = konstant) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}

/* =================================================================
   BOX (Quader)
   ================================================================= */

/**
 * Erzeugt die 8 Eckpunkte eines achsenparallelen Quaders.
 *
 * @param w  Breite (X-Richtung)
 * @param h  Höhe   (Y-Richtung)
 * @param d  Tiefe  (Z-Richtung)
 * @returns Array mit 8 Ecken [x±, y±, z±]
 */
export function createBox(
  w: number,
  h: number,
  d: number,
): l3d.Vec3[] {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return [
    new l3d.Vec3(-hw, -hh, -hd), // 0: vorne-unten-links
    new l3d.Vec3(+hw, -hh, -hd), // 1: vorne-unten-rechts
    new l3d.Vec3(+hw, +hh, -hd), // 2: vorne-oben-rechts
    new l3d.Vec3(-hw, +hh, -hd), // 3: vorne-oben-links
    new l3d.Vec3(-hw, -hh, +hd), // 4: hinten-unten-links
    new l3d.Vec3(+hw, -hh, +hd), // 5: hinten-unten-rechts
    new l3d.Vec3(+hw, +hh, +hd), // 6: hinten-oben-rechts
    new l3d.Vec3(-hw, +hh, +hd), // 7: hinten-oben-links
  ];
}

/** Kanten-Indices für den Quader (12 Kanten) */
const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // vorne
  [4, 5], [5, 6], [6, 7], [7, 4], // hinten
  [0, 4], [1, 5], [2, 6], [3, 7], // Verbindungen vorn–hinten
];

/**
 * Zeichnet einen Quader als Drahtgitter.
 *
 * @param boxPoints  Von createBox() erzeugtes 8-Punkte-Array
 * @param matrix     4x4-Transformationsmatrix
 * @param fov        Kamera-Brennweite
 * @param tint       Farbe als { r, g, b } (0-255)
 */
export function drawBox(
  boxPoints: l3d.Vec3[],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 180, g: 220, b: 255 },
): void {
  const transformed = boxPoints.map((v) => v.transform(matrix));
  const proj = transformed.map((v) => l3d.project(fov, v));

  const sMin = Math.min(...proj.map((p) => p.s));
  const sMax = Math.max(...proj.map((p) => p.s));

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  for (const [i, j] of BOX_EDGES) {
    shadedLine(proj[i], proj[j], sMin, sMax, tint);
  }
}

/* =================================================================
   ZYLINDER (Cylinder)
   ================================================================= */

/**
 * Erzeugt ein 2D-Gitter für einen Zylinder.
 *
 * @param radius   Radius des Zylinders
 * @param height   Höhe des Zylinders
 * @param segments Anzahl Umfangs-Segmente
 * @param rings    Anzahl Höhenringe (inkl. Deckel & Boden)
 * @returns Punkte-Gitter [ring][segment]
 *          ring 0 = Boden, ring rings = Deckel
 */
export function createCylinder(
  radius: number,
  height: number,
  segments: number,
  rings: number,
): l3d.Vec3[][] {
  const points: l3d.Vec3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const y = height * (r / rings - 0.5); // -height/2 .. +height/2
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const a = 2 * Math.PI * (s / segments);
      points[r][s] = new l3d.Vec3(
        radius * Math.cos(a),
        y,
        radius * Math.sin(a),
      );
    }
  }
  return points;
}

/**
 * Zeichnet einen Zylinder als Drahtgitter.
 *
 * @param cylPoints  Von createCylinder() erzeugtes Gitter
 * @param matrix     4x4-Transformationsmatrix
 * @param fov        Kamera-Brennweite
 * @param tint       Farbe als { r, g, b } (0-255)
 */
export function drawCylinder(
  cylPoints: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 200, g: 230, b: 180 },
): void {
  const RINGS = cylPoints.length - 1;
  const SEGMENTS = cylPoints[0].length - 1;

  const { proj, sMin, sMax } = transformAndProject(cylPoints, matrix, fov);

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  // --- Höhenringe (y = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }

  // --- Längslinien (Mantel) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}

/* =================================================================
   KEGEL (Cone)
   ================================================================= */

/**
 * Erzeugt ein 2D-Gitter für einen Kegel.
 *
 * @param radius   Radius der Grundfläche
 * @param height   Höhe des Kegels
 * @param segments Anzahl Umfangs-Segmente
 * @param rings    Anzahl Höhenringe (Basis + Zwischenringe)
 * @returns Punkte-Gitter [ring][segment]
 *          ring 0 = Basis, ring rings = Spitze (alle = Origo + y=height/2)
 */
export function createCone(
  radius: number,
  height: number,
  segments: number,
  rings: number,
): l3d.Vec3[][] {
  const points: l3d.Vec3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;                       // 0 .. 1
    const y = height * (t - 0.5);              // -height/2 .. +height/2
    const rad = radius * (1 - t);              // radius .. 0
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const a = 2 * Math.PI * (s / segments);
      points[r][s] = new l3d.Vec3(
        rad * Math.cos(a),
        y,
        rad * Math.sin(a),
      );
    }
  }
  return points;
}

/**
 * Zeichnet einen Kegel als Drahtgitter.
 *
 * @param conePoints  Von createCone() erzeugtes Gitter
 * @param matrix      4x4-Transformationsmatrix
 * @param fov         Kamera-Brennweite
 * @param tint        Farbe als { r, g, b } (0-255)
 */
export function drawCone(
  conePoints: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 255, g: 200, b: 150 },
): void {
  const RINGS = conePoints.length - 1;
  const SEGMENTS = conePoints[0].length - 1;

  const { proj, sMin, sMax } = transformAndProject(conePoints, matrix, fov);

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  // --- Höhenringe (y = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }

  // --- Mantellinien (r -> r+1) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}

/* =================================================================
   TORUS
   ================================================================= */

/**
 * Erzeugt ein 2D-Gitter für einen Torus.
 *
 * @param majorRadius  Großer Radius (Mitte des "Schlauchs" zum Ursprung)
 * @param minorRadius  Kleiner Radius (Dicke des "Schlauchs")
 * @param segments     Anzahl Segmente entlang des großen Kreises
 * @param rings        Anzahl Segmente entlang des kleinen Kreises
 * @returns Punkte-Gitter [ring][segment]
 */
export function createTorus(
  majorRadius: number,
  minorRadius: number,
  segments: number,
  rings: number,
): l3d.Vec3[][] {
  const points: l3d.Vec3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const u = 2 * Math.PI * (r / rings); // kleiner Kreis-Winkel
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const v = 2 * Math.PI * (s / segments); // großer Kreis-Winkel
      const x = (majorRadius + minorRadius * Math.cos(u)) * Math.cos(v);
      const y = minorRadius * Math.sin(u);
      const z = (majorRadius + minorRadius * Math.cos(u)) * Math.sin(v);
      points[r][s] = new l3d.Vec3(x, y, z);
    }
  }
  return points;
}

/**
 * Zeichnet einen Torus als Drahtgitter.
 *
 * @param torusPoints  Von createTorus() erzeugtes Gitter
 * @param matrix       4x4-Transformationsmatrix
 * @param fov          Kamera-Brennweite
 * @param tint         Farbe als { r, g, b } (0-255)
 */
export function drawTorus(
  torusPoints: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 200, g: 180, b: 255 },
): void {
  const RINGS = torusPoints.length - 1;
  const SEGMENTS = torusPoints[0].length - 1;

  const { proj, sMin, sMax } = transformAndProject(torusPoints, matrix, fov);

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  // --- Ringe (u = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }

  // --- Segmente (v = konstant) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}