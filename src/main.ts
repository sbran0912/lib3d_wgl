import * as wgl from "./lib-wgl.ts";
import * as l3d from "./lib-3d.ts";
import { createSphere, drawSphere } from "./lib-sphere.ts";

const SCREEN_W = 600;
const SCREEN_H = 400;
const FOV = 300;

// Zwei Kugeln mit unterschiedlicher Größe
const sphere1Points = createSphere(100, 20, 12);
const sphere2Points = createSphere(60, 16, 10);

let angleX = 0;
let angleY = 0;
let orbitAngle = 0;  // Winkel für die Orbitalbewegung

function draw() {
  wgl.background(15, 15, 30);

  // === Kugel 1 (groß, blau) – mittig ===
  const M1 = l3d.multMatrix(
    l3d.translateMatrix(0, 0, 100),
    l3d.rotateMatrix(angleX * 0.8, angleY * 1.2, 0),
  );
  drawSphere(sphere1Points, M1, FOV, { r: 100, g: 180, b: 255 });

  // === Kugel 2 (klein, orange) – kreist um Kugel 1 (Y-Achse) ===
  const orbitRadius = 200;
  const ox = Math.cos(orbitAngle) * orbitRadius;
  const oz = 100 + Math.sin(orbitAngle) * orbitRadius;  // Orbit in XZ-Ebene

  const M2 = l3d.multMatrix(
    l3d.translateMatrix(ox, 0, oz),
    l3d.rotateMatrix(angleX * 1.5, angleY * 0.7, 0),
  );
  drawSphere(sphere2Points, M2, FOV, { r: 255, g: 180, b: 80 });

  angleX += 0.005;
  angleY += 0.008;
  orbitAngle += 0.01;  // Orbital-Geschwindigkeit
}

wgl.init(SCREEN_W, SCREEN_H);
wgl.startAnimation(draw);
