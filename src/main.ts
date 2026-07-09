import * as wgl from "./lib-wgl.ts";
import * as l3d from "./lib-3d.ts";
import {
  createSphere, drawSphere,
  createBox, drawBox,
  createCylinder, drawCylinder,
  createCone, drawCone,
  createTorus, drawTorus,
} from "./lib-geom.ts";

const SCREEN_W = 900;
const SCREEN_H = 600;
const FOV = 400;

// Figuren-Parameter
const SPHERE_RADIUS = 38;
const CYL_RADIUS = 30;
const CYL_HEIGHT = 60;
const CONE_RADIUS = 30;
const CONE_HEIGHT = 70;
const TORUS_MAJOR = 50;
const TORUS_MINOR = 20;

// Figuren erzeugen (einmalig)
const spherePts = createSphere(SPHERE_RADIUS, 20, 12);
const boxPts = createBox(60, 60, 60);
const cylPts = createCylinder(CYL_RADIUS, CYL_HEIGHT, 20, 8);
const conePts = createCone(CONE_RADIUS, CONE_HEIGHT, 20, 8);
const torusPts = createTorus(TORUS_MAJOR, TORUS_MINOR, 24, 16);

// Zeit für Animation
let time = 0;

function draw() {
  time += 0.02;
  wgl.background(15, 15, 30);

  // Basis-Rotation (alle Figuren rotieren gleich)
  const rotY = time * 0.6;
  const rotX = Math.sin(time * 0.3) * 0.3;

  // --- SPHERE (links oben) ---
  const m1 = l3d.multMatrix(
    l3d.translateMatrix(-180, 130, 0),
    l3d.rotateMatrix(rotX, rotY, 0),
  );
  drawSphere(spherePts, m1, FOV, { r: 100, g: 180, b: 255 });

  // --- BOX (rechts oben) ---
  const m2 = l3d.multMatrix(
    l3d.translateMatrix(180, 130, 0),
    l3d.rotateMatrix(rotX, rotY, 0),
  );
  drawBox(boxPts, m2, FOV, { r: 255, g: 220, b: 100 });

  // --- CYLINDER (links unten) ---
  const m3 = l3d.multMatrix(
    l3d.translateMatrix(-180, -130, 0),
    l3d.rotateMatrix(rotX, rotY, 0),
  );
  drawCylinder(cylPts, m3, FOV, { r: 120, g: 220, b: 140 });

  // --- CONE (mitte unten) ---
  const m4 = l3d.multMatrix(
    l3d.translateMatrix(0, -130, 0),
    l3d.rotateMatrix(rotX, rotY, 0),
  );
  drawCone(conePts, m4, FOV, { r: 255, g: 160, b: 100 });

  // --- TORUS (rechts unten) ---
  const m5 = l3d.multMatrix(
    l3d.translateMatrix(180, -130, 0),
    l3d.rotateMatrix(rotX, rotY, 0),
  );
  drawTorus(torusPts, m5, FOV, { r: 200, g: 150, b: 255 });
}

wgl.init(SCREEN_W, SCREEN_H);
wgl.startAnimation(draw);