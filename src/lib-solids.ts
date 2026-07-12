/*
-----------------------------------------------------------------
Solide Körper als Klassen mit eigener Geometrie, Position, Rotation und Farbe.
Jeder Körper erzeugt seine Geometrie im Konstruktor und rendert sie direkt in draw().
-----------------------------------------------------------------
*/

import * as l3d from "./lib-3d.ts";
import * as wgl from "./lib-wgl.ts";

/*
-----------------------------------------------------------------
Hilfsfunktionen
-----------------------------------------------------------------
*/

/**
 * Berechnet die Farbkomponenten aus einem Tiefenwert (s) und einer Tönung.
 *
 * @param s      Tiefenwert des Punkts / der Kante
 * @param sMin   Minimaler s-Wert aller Punkte
 * @param sRange Spannweite (sMax - sMin)
 * @param tint   Grundfarbe als { r, g, b } (0-255)
 * @returns      Helligkeitskorrigierte Farbe
 */
function _calcBrightness(
  s: number,
  sMin: number,
  sRange: number,
  tint: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  const t = (s - sMin) / sRange;
  const b = Math.round(60 + t * 195);
  return {
    r: Math.round((b * tint.r) / 255),
    g: Math.round((b * tint.g) / 255),
    b: Math.round((b * tint.b) / 255),
  };
}

/*
-----------------------------------------------------------------
Gemeinsame Basis-Klasse
-----------------------------------------------------------------
*/

/**
 * Abstrakte Basis für alle 3D-Körper.
 * Stellt move()/rotate() sowie die gemeinsamen Felder pos, rotation, tint bereit.
 */
abstract class Solid {
  pos: l3d.Vec3;
  rotation: l3d.Vec3;
  tint: { r: number; g: number; b: number };

  constructor(tint: { r: number; g: number; b: number }) {
    this.pos = new l3d.Vec3(0, 0, 0);
    this.rotation = new l3d.Vec3(0, 0, 0);
    this.tint = tint;
  }

  /** Absolute Position setzen */
  move(x: number, y: number, z: number): void {
    this.pos = new l3d.Vec3(x, y, z);
  }

  /** Absolute Rotation setzen (Winkel in Rad) */
  rotate(ax: number, ay: number, az: number): void {
    this.rotation = new l3d.Vec3(ax, ay, az);
  }

  /** Objekt mit aktueller Position/Rotation zeichnen */
  abstract draw(viewMatrix: l3d.Matrix4x4, fov: number): void;
}

/*
-----------------------------------------------------------------
Kugel
-----------------------------------------------------------------
*/

/**
 * Kugel als Klasse mit eigener Position, Rotation und Farbe.
 * Die Geometrie (Punkte-Gitter) wird im Konstruktor aus Radius, Segmenten und Ringen erzeugt.
 */
export class Sphere extends Solid {
  points: l3d.Vec3[][];

  constructor(
    radius: number,
    segments: number,
    rings: number,
    tint: { r: number; g: number; b: number },
  ) {
    super(tint);

    // Geometrie-Gitter: [ring][segment]
    this.points = [];
    for (let r = 0; r <= rings; r++) {
      const lat = Math.PI * (r / rings) - Math.PI / 2; // -PI/2 .. +PI/2
      this.points[r] = [];
      for (let s = 0; s <= segments; s++) {
        const lon = 2 * Math.PI * (s / segments); // 0 .. 2*PI
        this.points[r][s] = new l3d.Vec3(
          radius * Math.cos(lat) * Math.cos(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.sin(lon),
        );
      }
    }
  }

  draw(viewMatrix: l3d.Matrix4x4, fov: number): void {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );

    const RINGS = this.points.length - 1;
    const SEGMENTS = this.points[0].length - 1;

    // Alle Punkte transformieren & projizieren
    const proj = this.points.map((row) =>
      row.map((v) => l3d.project(fov, v.transform(M))),
    );

    // s-Bereich für Helligkeitsnormalisierung
    const flat = proj.flat();
    const sMin = Math.min(...flat.map((p) => p.s));
    const sMax = Math.max(...flat.map((p) => p.s));
    const sRange = sMax - sMin || 1;

    wgl.setEffect("flat");
    wgl.strokeWidth(1.2);

    // --- Breitenkreise (lat = konstant) ---
    for (let r = 0; r <= RINGS; r++) {
      for (let s = 0; s < SEGMENTS; s++) {
        const p1 = proj[r][s];
        const p2 = proj[r][s + 1];
        const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
        wgl.strokeColor(c.r, c.g, c.b);
        wgl.line(p1.x, p1.y, p2.x, p2.y);
      }
    }

    // --- Längenkreise (lon = konstant) ---
    for (let s = 0; s <= SEGMENTS; s++) {
      for (let r = 0; r < RINGS; r++) {
        const p1 = proj[r][s];
        const p2 = proj[r + 1][s];
        const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
        wgl.strokeColor(c.r, c.g, c.b);
        wgl.line(p1.x, p1.y, p2.x, p2.y);
      }
    }
  }
}

/*
-----------------------------------------------------------------
Würfel
-----------------------------------------------------------------
*/

/**
 * Würfel als Klasse mit eigener Position, Rotation und Farbe.
 * Die Geometrie (12 Kanten) wird im Konstruktor aus der Seitenlänge erzeugt.
 */
export class Cube extends Solid {
  edges: [l3d.Vec3, l3d.Vec3][];

  constructor(size: number, tint: { r: number; g: number; b: number }) {
    super(tint);

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
    this.edges = [
      [V[0], V[1]], [V[1], V[2]], [V[2], V[3]], [V[3], V[0]], // unten + oben vorn
      [V[4], V[5]], [V[5], V[6]], [V[6], V[7]], [V[7], V[4]], // unten + oben hinten
      [V[0], V[4]], [V[1], V[5]], [V[2], V[6]], [V[3], V[7]], // vertikal
    ];
  }

  draw(viewMatrix: l3d.Matrix4x4, fov: number): void {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );

    // Alle Punkte transformieren & projizieren
    const projected = this.edges.map(([a, b]) => ({
      p1: l3d.project(fov, a.transform(M)),
      p2: l3d.project(fov, b.transform(M)),
    }));

    // s-Bereich für Helligkeitsnormalisierung
    const sVals = projected.flatMap((e) => [e.p1.s, e.p2.s]);
    const sMin = Math.min(...sVals);
    const sMax = Math.max(...sVals);
    const sRange = sMax - sMin || 1;

    wgl.setEffect("flat");
    wgl.strokeWidth(1.2);

    for (const { p1, p2 } of projected) {
      const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
      wgl.strokeColor(c.r, c.g, c.b);
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

/*
-----------------------------------------------------------------
Quader
-----------------------------------------------------------------
*/

/**
 * Quader als Klasse mit eigener Position, Rotation und Farbe.
 * Die Geometrie (12 Kanten) wird im Konstruktor aus Breite, Höhe und Tiefe erzeugt.
 */
export class Box extends Solid {
  edges: [l3d.Vec3, l3d.Vec3][];

  constructor(
    w: number,
    h: number,
    d: number,
    tint: { r: number; g: number; b: number },
  ) {
    super(tint);

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
    this.edges = [
      [V[0], V[1]], [V[1], V[2]], [V[2], V[3]], [V[3], V[0]], // unten + oben vorn
      [V[4], V[5]], [V[5], V[6]], [V[6], V[7]], [V[7], V[4]], // unten + oben hinten
      [V[0], V[4]], [V[1], V[5]], [V[2], V[6]], [V[3], V[7]], // vertikal
    ];
  }

  draw(viewMatrix: l3d.Matrix4x4, fov: number): void {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );

    // Alle Punkte transformieren & projizieren
    const projected = this.edges.map(([a, b]) => ({
      p1: l3d.project(fov, a.transform(M)),
      p2: l3d.project(fov, b.transform(M)),
    }));

    // s-Bereich für Helligkeitsnormalisierung
    const sVals = projected.flatMap((e) => [e.p1.s, e.p2.s]);
    const sMin = Math.min(...sVals);
    const sMax = Math.max(...sVals);
    const sRange = sMax - sMin || 1;

    wgl.setEffect("flat");
    wgl.strokeWidth(1.2);

    for (const { p1, p2 } of projected) {
      const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
      wgl.strokeColor(c.r, c.g, c.b);
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

/*
-----------------------------------------------------------------
Zylinder
-----------------------------------------------------------------
*/

/**
 * Zylinder als Klasse mit eigener Position, Rotation und Farbe.
 * Die Geometrie (Punkte-Gitter) wird im Konstruktor aus Radius, Höhe, Segmenten und Ringen erzeugt.
 */
export class Cylinder extends Solid {
  points: l3d.Vec3[][];

  constructor(
    radius: number,
    height: number,
    segments: number,
    tint: { r: number; g: number; b: number },
    rings: number = 2,
  ) {
    super(tint);

    // Geometrie-Gitter: [ring][segment]
    this.points = [];
    for (let r = 0; r <= rings; r++) {
      const y = -height / 2 + (r / rings) * height;
      this.points[r] = [];
      for (let s = 0; s <= segments; s++) {
        const angle = 2 * Math.PI * (s / segments);
        this.points[r][s] = new l3d.Vec3(
          radius * Math.cos(angle),
          y,
          radius * Math.sin(angle),
        );
      }
    }
  }

  draw(viewMatrix: l3d.Matrix4x4, fov: number): void {
    const M = l3d.multMatrix(
      viewMatrix,
      l3d.multMatrix(
        l3d.translateMatrix(this.pos.x, this.pos.y, this.pos.z),
        l3d.rotateMatrix(this.rotation.x, this.rotation.y, this.rotation.z),
      ),
    );

    const RINGS = this.points.length - 1;
    const SEGMENTS = this.points[0].length - 1;

    // Alle Punkte transformieren & projizieren
    const proj = this.points.map((row) =>
      row.map((v) => l3d.project(fov, v.transform(M))),
    );

    // s-Bereich für Helligkeitsnormalisierung
    const flat = proj.flat();
    const sMin = Math.min(...flat.map((p) => p.s));
    const sMax = Math.max(...flat.map((p) => p.s));
    const sRange = sMax - sMin || 1;

    wgl.setEffect("flat");
    wgl.strokeWidth(1.2);

    // --- Ringe (Höhe = konstant) ---
    for (let r = 0; r <= RINGS; r++) {
      for (let s = 0; s < SEGMENTS; s++) {
        const p1 = proj[r][s];
        const p2 = proj[r][s + 1];
        const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
        wgl.strokeColor(c.r, c.g, c.b);
        wgl.line(p1.x, p1.y, p2.x, p2.y);
      }
    }

    // --- Mantellinien (segment = konstant) ---
    for (let s = 0; s <= SEGMENTS; s++) {
      for (let r = 0; r < RINGS; r++) {
        const p1 = proj[r][s];
        const p2 = proj[r + 1][s];
        const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
        wgl.strokeColor(c.r, c.g, c.b);
        wgl.line(p1.x, p1.y, p2.x, p2.y);
      }
    }
  }
}

/*
-----------------------------------------------------------------
Bodengitter
-----------------------------------------------------------------
*/

/**
 * Bodengitter in der XZ-Ebene (Y=0) als räumliche Orientierungshilfe.
 * Kann nicht bewegt/rotiert werden – dafür einfach und leichtgewichtig.
 */
export class Grid {
  edges: [l3d.Vec3, l3d.Vec3][];
  tint: { r: number; g: number; b: number };

  /**
   * @param size       Seitenlänge des Gitters (z.B. 600)
   * @param divisions  Anzahl Unterteilungen pro Achse (z.B. 12 → 12×12 Zellen)
   * @param tint       Farbe als { r, g, b } (0-255), Standard: neutral-grau
   */
  constructor(
    size: number,
    divisions: number,
    tint: { r: number; g: number; b: number } = { r: 180, g: 180, b: 200 },
  ) {
    this.tint = tint;
    this.edges = [];

    const half = size / 2;
    const step = size / divisions;

    // Linien parallel zur X-Achse (Z = konstant)
    for (let i = 0; i <= divisions; i++) {
      const z = -half + i * step;
      this.edges.push([
        new l3d.Vec3(-half, 0, z),
        new l3d.Vec3( half, 0, z),
      ]);
    }

    // Linien parallel zur Z-Achse (X = konstant)
    for (let i = 0; i <= divisions; i++) {
      const x = -half + i * step;
      this.edges.push([
        new l3d.Vec3(x, 0, -half),
        new l3d.Vec3(x, 0,  half),
      ]);
    }
  }

  /** Bodengitter mit aktueller Ansicht zeichnen */
  draw(viewMatrix: l3d.Matrix4x4, fov: number): void {
    // Alle Kanten transformieren & projizieren
    const projected = this.edges.map(([a, b]) => ({
      p1: l3d.project(fov, a.transform(viewMatrix)),
      p2: l3d.project(fov, b.transform(viewMatrix)),
    }));

    // s-Bereich für Helligkeitsnormalisierung
    const sVals = projected.flatMap((e) => [e.p1.s, e.p2.s]);
    const sMin = Math.min(...sVals);
    const sMax = Math.max(...sVals);
    const sRange = sMax - sMin || 1;

    wgl.setEffect("flat");
    wgl.strokeWidth(0.8);

    for (const { p1, p2 } of projected) {
      const c = _calcBrightness((p1.s + p2.s) / 2, sMin, sRange, this.tint);
      wgl.strokeColor(c.r, c.g, c.b);
      wgl.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}
