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

  // Alle Punkte transformieren
  const transformed: l3d.Vec3[][] = [];
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
        Math.round((brightness * tint.r) / 255),
        Math.round((brightness * tint.g) / 255),
        Math.round((brightness * tint.b) / 255),
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
        Math.round((brightness * tint.r) / 255),
        Math.round((brightness * tint.g) / 255),
        Math.round((brightness * tint.b) / 255),
      );
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

/*
-----------------------------------------------------------------
Würfel-Erstellung & -Darstellung
-----------------------------------------------------------------
*/

/**
 * Erzeugt die 12 Kanten eines Würfels als Liste von Vec3-Paaren.
 *
 * @param size   Seitenlänge des Würfels
 * @returns Array mit 12 Einträgen, jeder ein [start, end]-Paar
 */
export function createCube(size: number): l3d.Vec3[][] {
  const h = size / 2;

  // 8 Eckpunkte
  const V = [
    new l3d.Vec3(-h, -h, -h), // 0: vorne-unten-links
    new l3d.Vec3( h, -h, -h), // 1: vorne-unten-rechts
    new l3d.Vec3( h,  h, -h), // 2: vorne-oben-rechts
    new l3d.Vec3(-h,  h, -h), // 3: vorne-oben-links
    new l3d.Vec3(-h, -h,  h), // 4: hinten-unten-links
    new l3d.Vec3( h, -h,  h), // 5: hinten-unten-rechts
    new l3d.Vec3( h,  h,  h), // 6: hinten-oben-rechts
    new l3d.Vec3(-h,  h,  h), // 7: hinten-oben-links
  ];

  // 12 Kanten als [start, end]
  return [
    [V[0], V[1]], [V[1], V[2]], [V[2], V[3]], [V[3], V[0]], // unten + oben vorn
    [V[4], V[5]], [V[5], V[6]], [V[6], V[7]], [V[7], V[4]], // unten + oben hinten
    [V[0], V[4]], [V[1], V[5]], [V[2], V[6]], [V[3], V[7]], // vertikal
  ];
}

/**
 * Zeichnet einen Würfel als Drahtgitter mit Helligkeits-Shading.
 *
 * @param cubeEdges  Von createCube() erzeugtes Kanten-Array (12 Paare)
 * @param matrix     4x4-Transformationsmatrix
 * @param fov        Kamera-Brennweite
 * @param tint       Farbe als { r, g, b } (0-255), Standard: grünlich-weiß
 */
export function drawCube(
  cubeEdges: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 200, g: 255, b: 200 },
): void {
  // Alle Punkte transformieren & projizieren
  const edges = cubeEdges.map(([a, b]) => ({
    p1: l3d.project(fov, a.transform(matrix)),
    p2: l3d.project(fov, b.transform(matrix)),
  }));

  // s-Bereich für Helligkeitsnormalisierung
  const sVals = edges.flatMap((e) => [e.p1.s, e.p2.s]);
  const sMin = Math.min(...sVals);
  const sMax = Math.max(...sVals);
  const sRange = sMax - sMin || 1;

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  for (const { p1, p2 } of edges) {
    const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
    const brightness = Math.round(60 + t * 195);
    wgl.strokeColor(
      Math.round((brightness * tint.r) / 255),
      Math.round((brightness * tint.g) / 255),
      Math.round((brightness * tint.b) / 255),
    );
    wgl.line(p1.x, p1.y, p2.x, p2.y);
  }
}

/*
-----------------------------------------------------------------
Quader-Erstellung & -Darstellung
-----------------------------------------------------------------
*/

/**
 * Erzeugt die 12 Kanten eines Quaders als Liste von Vec3-Paaren.
 *
 * @param w   Breite (x-Richtung)
 * @param h   Höhe   (y-Richtung)
 * @param d   Tiefe  (z-Richtung)
 * @returns Array mit 12 Einträgen, jeder ein [start, end]-Paar
 */
export function createBox(w: number, h: number, d: number): l3d.Vec3[][] {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  // 8 Eckpunkte
  const V = [
    new l3d.Vec3(-hw, -hh, -hd), // 0: vorne-unten-links
    new l3d.Vec3( hw, -hh, -hd), // 1: vorne-unten-rechts
    new l3d.Vec3( hw,  hh, -hd), // 2: vorne-oben-rechts
    new l3d.Vec3(-hw,  hh, -hd), // 3: vorne-oben-links
    new l3d.Vec3(-hw, -hh,  hd), // 4: hinten-unten-links
    new l3d.Vec3( hw, -hh,  hd), // 5: hinten-unten-rechts
    new l3d.Vec3( hw,  hh,  hd), // 6: hinten-oben-rechts
    new l3d.Vec3(-hw,  hh,  hd), // 7: hinten-oben-links
  ];

  // 12 Kanten als [start, end]
  return [
    [V[0], V[1]], [V[1], V[2]], [V[2], V[3]], [V[3], V[0]], // unten + oben vorn
    [V[4], V[5]], [V[5], V[6]], [V[6], V[7]], [V[7], V[4]], // unten + oben hinten
    [V[0], V[4]], [V[1], V[5]], [V[2], V[6]], [V[3], V[7]], // vertikal
  ];
}

/**
 * Zeichnet einen Quader als Drahtgitter mit Helligkeits-Shading.
 *
 * @param boxEdges   Von createBox() erzeugtes Kanten-Array (12 Paare)
 * @param matrix     4x4-Transformationsmatrix
 * @param fov        Kamera-Brennweite
 * @param tint       Farbe als { r, g, b } (0-255), Standard: magenta-weiß
 */
export function drawBox(
  boxEdges: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 220, g: 180, b: 255 },
): void {
  // Alle Punkte transformieren & projizieren
  const edges = boxEdges.map(([a, b]) => ({
    p1: l3d.project(fov, a.transform(matrix)),
    p2: l3d.project(fov, b.transform(matrix)),
  }));

  // s-Bereich für Helligkeitsnormalisierung
  const sVals = edges.flatMap((e) => [e.p1.s, e.p2.s]);
  const sMin = Math.min(...sVals);
  const sMax = Math.max(...sVals);
  const sRange = sMax - sMin || 1;

  wgl.setEffect("flat");
  wgl.strokeWidth(1.2);

  for (const { p1, p2 } of edges) {
    const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
    const brightness = Math.round(60 + t * 195);
    wgl.strokeColor(
      Math.round((brightness * tint.r) / 255),
      Math.round((brightness * tint.g) / 255),
      Math.round((brightness * tint.b) / 255),
    );
    wgl.line(p1.x, p1.y, p2.x, p2.y);
  }
}

/*
-----------------------------------------------------------------
Zylinder-Erstellung & -Darstellung
-----------------------------------------------------------------
*/

/**
 * Erzeugt ein 2D-Array von Punkten auf der Zylinderoberfläche.
 *
 * @param radius   Radius des Zylinders
 * @param height   Höhe des Zylinders (entlang Y)
 * @param segments Anzahl Segmente am Umfang  (0 .. 2*PI)
 * @param rings    Anzahl Höhenringe (inkl. Boden+Deckel), Standard: 2
 * @returns Punkte-Gitter [ring][segment]
 */
export function createCylinder(
  radius: number,
  height: number,
  segments: number,
  rings: number = 2,
): l3d.Vec3[][] {
  const points: l3d.Vec3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const y = -height / 2 + (r / rings) * height; // -h/2 .. +h/2
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const angle = 2 * Math.PI * (s / segments); // 0 .. 2*PI
      points[r][s] = new l3d.Vec3(
        radius * Math.cos(angle),
        y,
        radius * Math.sin(angle),
      );
    }
  }
  return points;
}

/**
 * Zeichnet einen Zylinder als Drahtgitter mit Helligkeits-Shading.
 *
 * @param cylinderPoints  Von createCylinder() erzeugtes Punkte-Gitter
 * @param matrix          4x4-Transformationsmatrix
 * @param fov             Kamera-Brennweite
 * @param tint            Farbe als { r, g, b } (0-255), Standard: gelblich-weiß
 */
export function drawCylinder(
  cylinderPoints: l3d.Vec3[][],
  matrix: l3d.Matrix4x4,
  fov: number,
  tint: { r: number; g: number; b: number } = { r: 255, g: 240, b: 200 },
): void {
  const RINGS = cylinderPoints.length - 1;
  const SEGMENTS = cylinderPoints[0].length - 1;

  // Alle Punkte transformieren
  const transformed: l3d.Vec3[][] = [];
  for (let r = 0; r <= RINGS; r++) {
    transformed[r] = cylinderPoints[r].map((v) => v.transform(matrix));
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

  // --- Ringe (Höhe = konstant) ---
  for (let r = 0; r <= RINGS; r++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const p1 = proj[r][s];
      const p2 = proj[r][s + 1];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      wgl.strokeColor(
        Math.round((brightness * tint.r) / 255),
        Math.round((brightness * tint.g) / 255),
        Math.round((brightness * tint.b) / 255),
      );
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }

  // --- Mantellinien (segment = konstant) ---
  for (let s = 0; s <= SEGMENTS; s++) {
    for (let r = 0; r < RINGS; r++) {
      const p1 = proj[r][s];
      const p2 = proj[r + 1][s];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      wgl.strokeColor(
        Math.round((brightness * tint.r) / 255),
        Math.round((brightness * tint.g) / 255),
        Math.round((brightness * tint.b) / 255),
      );
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

/*
-----------------------------------------------------------------
OOP-Klassen mit move() / rotate() / draw()
-----------------------------------------------------------------
*/

/**
 * Kugel als Klasse mit eigener Position, Rotation und Farbe.
 */
export class Sphere {
  points: l3d.Vec3[][];
  pos: l3d.Vec3;
  rotation: l3d.Vec3;
  tint: { r: number; g: number; b: number };

  constructor(
    radius: number,
    segments: number,
    rings: number,
    tint: { r: number; g: number; b: number },
  ) {
    this.points = createSphere(radius, segments, rings);
    this.pos = new l3d.Vec3(0, 0, 0);
    this.rotation = new l3d.Vec3(0, 0, 0);
    this.tint = tint;
  }

  /** Absolute Position setzen */
  move(x: number, y: number, z: number) {
    this.pos = new l3d.Vec3(x, y, z);
  }

  /** Absolute Rotation setzen (Winkel in Rad) */
  rotate(ax: number, ay: number, az: number) {
    this.rotation = new l3d.Vec3(ax, ay, az);
  }

  /** Objekt mit aktueller Position/Rotation zeichnen */
  draw(viewMatrix: l3d.Matrix4x4, fov: number) {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );
    drawSphere(this.points, M, fov, this.tint);
  }
}

/**
 * Quader als Klasse mit eigener Position, Rotation und Farbe.
 */
export class Box {
  edges: l3d.Vec3[][];
  pos: l3d.Vec3;
  rotation: l3d.Vec3;
  tint: { r: number; g: number; b: number };

  constructor(
    w: number,
    h: number,
    d: number,
    tint: { r: number; g: number; b: number },
  ) {
    this.edges = createBox(w, h, d);
    this.pos = new l3d.Vec3(0, 0, 0);
    this.rotation = new l3d.Vec3(0, 0, 0);
    this.tint = tint;
  }

  /** Absolute Position setzen */
  move(x: number, y: number, z: number) {
    this.pos = new l3d.Vec3(x, y, z);
  }

  /** Absolute Rotation setzen (Winkel in Rad) */
  rotate(ax: number, ay: number, az: number) {
    this.rotation = new l3d.Vec3(ax, ay, az);
  }

  /** Objekt mit aktueller Position/Rotation zeichnen */
  draw(viewMatrix: l3d.Matrix4x4, fov: number) {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );
    drawBox(this.edges, M, fov, this.tint);
  }
}

/**
 * Würfel als Klasse mit eigener Position, Rotation und Farbe.
 */
export class Cube {
  edges: l3d.Vec3[][];
  pos: l3d.Vec3;
  rotation: l3d.Vec3;
  tint: { r: number; g: number; b: number };

  constructor(
    size: number,
    tint: { r: number; g: number; b: number },
  ) {
    this.edges = createCube(size);
    this.pos = new l3d.Vec3(0, 0, 0);
    this.rotation = new l3d.Vec3(0, 0, 0);
    this.tint = tint;
  }

  /** Absolute Position setzen */
  move(x: number, y: number, z: number) {
    this.pos = new l3d.Vec3(x, y, z);
  }

  /** Absolute Rotation setzen (Winkel in Rad) */
  rotate(ax: number, ay: number, az: number) {
    this.rotation = new l3d.Vec3(ax, ay, az);
  }

  /** Objekt mit aktueller Position/Rotation zeichnen */
  draw(viewMatrix: l3d.Matrix4x4, fov: number) {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );
    drawCube(this.edges, M, fov, this.tint);
  }
}

/**
 * Zylinder als Klasse mit eigener Position, Rotation und Farbe.
 */
export class Cylinder {
  points: l3d.Vec3[][];
  pos: l3d.Vec3;
  rotation: l3d.Vec3;
  tint: { r: number; g: number; b: number };

  constructor(
    radius: number,
    height: number,
    segments: number,
    tint: { r: number; g: number; b: number },
    rings: number = 2,
  ) {
    this.points = createCylinder(radius, height, segments, rings);
    this.pos = new l3d.Vec3(0, 0, 0);
    this.rotation = new l3d.Vec3(0, 0, 0);
    this.tint = tint;
  }

  /** Absolute Position setzen */
  move(x: number, y: number, z: number) {
    this.pos = new l3d.Vec3(x, y, z);
  }

  /** Absolute Rotation setzen (Winkel in Rad) */
  rotate(ax: number, ay: number, az: number) {
    this.rotation = new l3d.Vec3(ax, ay, az);
  }

  /** Objekt mit aktueller Position/Rotation zeichnen */
  draw(viewMatrix: l3d.Matrix4x4, fov: number) {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );
    drawCylinder(this.points, M, fov, this.tint);
  }
}