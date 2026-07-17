import * as wgl from "./lib-wgl.ts";
import * as l3d from "./lib-3d.ts";
import { Sphere, Box, Grid } from "./lib-solids.ts";

const SCREEN_W = 600;
const SCREEN_H = 400;
const FOV = 300;

// === Kamera-Perspektive ===
// Position der Kamera im Raum – einfach hier im Code ändern für andere Blickwinkel
const CAM_POS    = new l3d.Vec3(0, 50, -50);  // leicht von rechts oben (Standard)
const CAM_TARGET = new l3d.Vec3(0, 0, 100);        // Ziel = Mitte der Szene
const CAM_UP     = new l3d.Vec3(0, 1, 0);           // Y zeigt nach oben

const viewMatrix = l3d.lookAtMatrix(CAM_POS, CAM_TARGET, CAM_UP);

// Zwei Kugeln mit unterschiedlicher Größe
const sphere1 = new Sphere(100, 20, 12, { r: 100, g: 180, b: 255 });
const sphere2 = new Sphere(60, 16, 10, { r: 255, g: 180, b: 80 });

// Bodengitter (500×500, 10×10 Zellen)
const grid = new Grid(500, 10, { r: 100, g: 130, b: 180 });

// Quader (breite Grundplatte)
const box = new Box(300, 40, 200, { r: 200, g: 150, b: 255 });

// === Statische Positionen (einmalig setzen, nicht jedes Frame) ===
sphere1.move(0, 0, 100);
box.move(100, -100, 100);

let angleX = 0;
let angleY = 0;
let orbitAngle = 0; // Winkel für die Orbitalbewegung

function draw() {
  wgl.background(15, 15, 30);

  // === Bodengitter ===
  grid.draw(viewMatrix, FOV);

  // === Kugel 1 (groß, blau) – mittig ===
  sphere1.rotate(angleX * 0.8, angleY * 1.2, 0);
  sphere1.draw(viewMatrix, FOV);

  // === Kugel 2 (klein, orange) – kreist um Kugel 1 (Y-Achse) ===
  const ox = Math.cos(orbitAngle) * 200;
  const oz = 100 + Math.sin(orbitAngle) * 200;
  sphere2.move(ox, 0, oz);
  sphere2.rotate(angleX * 1.5, angleY * 0.7, 0);

  // Helligkeit entfernungsabhängig (sehr subtil):
  // Distanz ~70..350 → brightness 1.0..0.5
  const distToCam = new l3d.Vec3(ox, 0, oz).distanceTo(CAM_POS);
  const t = Math.min(1, Math.max(0, (distToCam - 70) / 280));
  sphere2.brightness = 1.0 - t * 0.5;

  sphere2.draw(viewMatrix, FOV);
  //console.log(sphere2.getWorldPoints());

  // === Quader (Grundplatte, lila) ===
  box.rotate(0, angleY * 0.5, 0);
  box.draw(viewMatrix, FOV);
  //console.log(box.getWorldPoints());

  angleX += 0.005;
  angleY += 0.008;
  orbitAngle += 0.01; // Orbital-Geschwindigkeit
}

wgl.init(SCREEN_W, SCREEN_H);
wgl.startAnimation(draw);
