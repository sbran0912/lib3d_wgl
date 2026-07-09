// src/lib-wgl.ts
var VERT_SRC = `
  attribute vec2 aPos;
  uniform vec2  uResolution;
  varying vec2  vPos;

  void main() {
    vPos = aPos;
    vec2 ndc = aPos / (uResolution * 0.5);
    gl_Position = vec4(ndc, 0.0, 1.0);
    gl_PointSize = 4.0;
  }
`;
var FRAG_SRC = `
  precision mediump float;

  uniform int   uMode;
  uniform vec4  uColor;
  uniform vec4  uColor2;
  uniform float uTime;
  uniform vec2  uShapeCenter;
  uniform float uShapeRadius;
  varying vec2  vPos;

  void main() {
    if (uMode == 0) {
      gl_FragColor = uColor;
    } else if (uMode == 1) {
      float d = distance(vPos, uShapeCenter);
      float t = clamp(d / max(uShapeRadius, 1.0), 0.0, 1.0);
      gl_FragColor = mix(uColor, uColor2, t);
    } else if (uMode == 2) {
      float brightness = 0.6 + 0.4 * sin(uTime * 3.0);
      gl_FragColor = vec4(uColor.rgb * brightness, uColor.a);
    } else {
      gl_FragColor = uColor;
    }
  }
`;
var canv;
var gl;
var prog;
var locPos;
var locResolution;
var locMode;
var locColor;
var locColor2;
var locTime;
var locCenter;
var locRadius;
var looping = true;
var startTime = 0;
var mouseX = 0;
var mouseY = 0;
var mouseStatus = 0;
var state = {
  fill: { r: 1, g: 1, b: 1, a: 1 },
  stroke: { r: 0, g: 0, b: 0, a: 1 },
  lineW: 1,
  effect: "flat",
  grad2: { r: 0, g: 0, b: 0, a: 1 }
};
function parseColor(...c) {
  if (c.length === 1 && typeof c[0] === "string") {
    let hex = c[0].replace("#", "");
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const n = parseInt(hex, 16);
    return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, a: 1 };
  }
  if (c.length === 1 && typeof c[0] === "number") {
    const v = c[0] / 255;
    return { r: v, g: v, b: v, a: 1 };
  }
  if (c.length === 3) {
    return { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255, a: 1 };
  }
  if (c.length === 4) {
    return { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255, a: c[3] / 255 };
  }
  return { r: 1, g: 1, b: 1, a: 1 };
}
function compileShader(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("Shader-Fehler: " + gl.getShaderInfoLog(shader));
  }
  return shader;
}
function createProgram(vertSrc, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Programm-Fehler: " + gl.getProgramInfoLog(p));
  }
  return p;
}
function applyUniforms(cx, cy, radius, useStroke = false) {
  const col = useStroke ? state.stroke : state.fill;
  const mode = state.effect === "flat" ? 0 : state.effect === "gradient" ? 1 : 2;
  gl.uniform1i(locMode, mode);
  gl.uniform4f(locColor, col.r, col.g, col.b, col.a);
  gl.uniform4f(locColor2, state.grad2.r, state.grad2.g, state.grad2.b, state.grad2.a);
  gl.uniform2f(locCenter, cx, cy);
  gl.uniform1f(locRadius, radius);
}
function drawVertices(verts, mode) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(mode, 0, verts.length / 2);
  gl.deleteBuffer(buf);
}
function shapeMetrics(pts) {
  const n = pts.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0;i < pts.length; i += 2) {
    cx += pts[i];
    cy += pts[i + 1];
  }
  cx /= n;
  cy /= n;
  let r = 0;
  for (let i = 0;i < pts.length; i += 2) {
    r = Math.max(r, Math.hypot(pts[i] - cx, pts[i + 1] - cy));
  }
  return { cx, cy, r };
}
function onMouseMove(e) {
  mouseX = e.offsetX - canv.width / 2;
  mouseY = -(e.offsetY - canv.height / 2);
}
function onMouseDown() {
  mouseStatus = 1;
}
function onMouseUp() {
  mouseStatus = 2;
}
function onTouchMove(e) {
  e.preventDefault();
  const rect = e.target.getBoundingClientRect();
  const touch = e.targetTouches[0];
  mouseX = touch.pageX - rect.left - canv.width / 2;
  mouseY = -(touch.pageY - rect.top - canv.height / 2);
}
function onTouchStart(e) {
  mouseStatus = 1;
  onTouchMove(e);
}
function onTouchEnd() {
  mouseStatus = 2;
}
function init(w, h) {
  canv = document.querySelector("canvas");
  canv.width = w;
  canv.height = h;
  gl = canv.getContext("webgl");
  if (!gl)
    throw new Error("WebGL wird nicht unterstützt.");
  prog = createProgram(VERT_SRC, FRAG_SRC);
  gl.useProgram(prog);
  locPos = gl.getAttribLocation(prog, "aPos");
  locResolution = gl.getUniformLocation(prog, "uResolution");
  locMode = gl.getUniformLocation(prog, "uMode");
  locColor = gl.getUniformLocation(prog, "uColor");
  locColor2 = gl.getUniformLocation(prog, "uColor2");
  locTime = gl.getUniformLocation(prog, "uTime");
  locCenter = gl.getUniformLocation(prog, "uShapeCenter");
  locRadius = gl.getUniformLocation(prog, "uShapeRadius");
  gl.uniform2f(locResolution, w, h);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, w, h);
  startTime = performance.now();
  canv.addEventListener("mousemove", onMouseMove);
  canv.addEventListener("mousedown", onMouseDown);
  canv.addEventListener("mouseup", onMouseUp);
  canv.addEventListener("touchmove", onTouchMove, { passive: false });
  canv.addEventListener("touchstart", onTouchStart, { passive: false });
  canv.addEventListener("touchend", onTouchEnd);
}
function startAnimation(fnDraw) {
  looping = true;
  const animate = () => {
    const t = (performance.now() - startTime) / 1000;
    gl.uniform1f(locTime, t);
    fnDraw();
    if (looping)
      window.requestAnimationFrame(animate);
  };
  window.requestAnimationFrame(animate);
}
function strokeColor(...color) {
  state.stroke = parseColor(...color);
}
function strokeWidth(w) {
  state.lineW = w;
}
function setEffect(effect) {
  state.effect = effect;
}
function background(...color) {
  const c = parseColor(...color);
  gl.clearColor(c.r, c.g, c.b, c.a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
function line(x1, y1, x2, y2) {
  const { cx, cy, r } = shapeMetrics([x1, y1, x2, y2]);
  applyUniforms(cx, cy, r, true);
  gl.lineWidth(state.lineW);
  drawVertices(new Float32Array([x1, y1, x2, y2]), gl.LINES);
}

// src/lib-3d.ts
class Vec3 {
  x;
  y;
  z;
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  scale(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }
  negate() {
    return new Vec3(-this.x, -this.y, -this.z);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  squaredLength() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.squaredLength());
  }
  distanceTo(v) {
    return this.sub(v).length();
  }
  normalize() {
    const len = this.length();
    return len === 0 ? new Vec3(0, 0, 0) : this.scale(1 / len);
  }
  lerp(v, t) {
    return this.add(v.sub(this).scale(t));
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  equals(v, epsilon = 0.0000000001) {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon && Math.abs(this.z - v.z) < epsilon;
  }
  transform(m) {
    return new Vec3(m[0][0] * this.x + m[0][1] * this.y + m[0][2] * this.z + m[0][3], m[1][0] * this.x + m[1][1] * this.y + m[1][2] * this.z + m[1][3], m[2][0] * this.x + m[2][1] * this.y + m[2][2] * this.z + m[2][3]);
  }
}
function translateMatrix(dx, dy, dz) {
  return [
    [1, 0, 0, dx],
    [0, 1, 0, dy],
    [0, 0, 1, dz],
    [0, 0, 0, 1]
  ];
}
function rotateMatrix(ax, ay, az) {
  const Rx = [
    [1, 0, 0, 0],
    [0, Math.cos(ax), -Math.sin(ax), 0],
    [0, Math.sin(ax), Math.cos(ax), 0],
    [0, 0, 0, 1]
  ];
  const Ry = [
    [Math.cos(ay), 0, Math.sin(ay), 0],
    [0, 1, 0, 0],
    [-Math.sin(ay), 0, Math.cos(ay), 0],
    [0, 0, 0, 1]
  ];
  const Rz = [
    [Math.cos(az), -Math.sin(az), 0, 0],
    [Math.sin(az), Math.cos(az), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  return multMatrix(Rz, multMatrix(Ry, Rx));
}
function multMatrix(a, b) {
  const result = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  for (let i = 0;i < 4; i++) {
    for (let j = 0;j < 4; j++) {
      for (let k = 0;k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}
function project(fov, v) {
  const s = fov / (fov + v.z);
  return {
    x: v.x * s,
    y: v.y * s,
    s
  };
}

// src/lib-sphere.ts
function transformAndProject(points, matrix, fov) {
  const ROWS = points.length;
  const transformed = [];
  const proj = [];
  let sMin = Infinity;
  let sMax = -Infinity;
  for (let r = 0;r < ROWS; r++) {
    transformed[r] = points[r].map((v) => v.transform(matrix));
    proj[r] = transformed[r].map((v) => {
      const p = project(fov, v);
      if (p.s < sMin)
        sMin = p.s;
      if (p.s > sMax)
        sMax = p.s;
      return p;
    });
  }
  return { proj, sMin, sMax };
}
function brightnessFromDepth(s, sMin, sMax, tint) {
  const sRange = sMax - sMin || 1;
  const t = (s - sMin) / sRange;
  const b = Math.round(60 + t * 195);
  return [
    Math.round(b * tint.r / 255),
    Math.round(b * tint.g / 255),
    Math.round(b * tint.b / 255)
  ];
}
function shadedLine(p1, p2, sMin, sMax, tint) {
  const s = (p1.s + p2.s) / 2;
  const [r, g, b] = brightnessFromDepth(s, sMin, sMax, tint);
  strokeColor(r, g, b);
  line(p1.x, p1.y, p2.x, p2.y);
}
function createSphere(radius, segments, rings) {
  const points = [];
  for (let r = 0;r <= rings; r++) {
    const lat = Math.PI * (r / rings) - Math.PI / 2;
    points[r] = [];
    for (let s = 0;s <= segments; s++) {
      const lon = 2 * Math.PI * (s / segments);
      points[r][s] = new Vec3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon));
    }
  }
  return points;
}
function drawSphere(spherePoints, matrix, fov, tint = { r: 255, g: 255, b: 255 }) {
  const RINGS = spherePoints.length - 1;
  const SEGMENTS = spherePoints[0].length - 1;
  const { proj, sMin, sMax } = transformAndProject(spherePoints, matrix, fov);
  setEffect("flat");
  strokeWidth(1.2);
  for (let r = 0;r <= RINGS; r++) {
    for (let s = 0;s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }
  for (let s = 0;s <= SEGMENTS; s++) {
    for (let r = 0;r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}
function createBox(w, h, d) {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return [
    new Vec3(-hw, -hh, -hd),
    new Vec3(+hw, -hh, -hd),
    new Vec3(+hw, +hh, -hd),
    new Vec3(-hw, +hh, -hd),
    new Vec3(-hw, -hh, +hd),
    new Vec3(+hw, -hh, +hd),
    new Vec3(+hw, +hh, +hd),
    new Vec3(-hw, +hh, +hd)
  ];
}
var BOX_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
];
function drawBox(boxPoints, matrix, fov, tint = { r: 180, g: 220, b: 255 }) {
  const transformed = boxPoints.map((v) => v.transform(matrix));
  const proj = transformed.map((v) => project(fov, v));
  const sMin = Math.min(...proj.map((p) => p.s));
  const sMax = Math.max(...proj.map((p) => p.s));
  setEffect("flat");
  strokeWidth(1.2);
  for (const [i, j] of BOX_EDGES) {
    shadedLine(proj[i], proj[j], sMin, sMax, tint);
  }
}
function createCylinder(radius, height, segments, rings) {
  const points = [];
  for (let r = 0;r <= rings; r++) {
    const y = height * (r / rings - 0.5);
    points[r] = [];
    for (let s = 0;s <= segments; s++) {
      const a = 2 * Math.PI * (s / segments);
      points[r][s] = new Vec3(radius * Math.cos(a), y, radius * Math.sin(a));
    }
  }
  return points;
}
function drawCylinder(cylPoints, matrix, fov, tint = { r: 200, g: 230, b: 180 }) {
  const RINGS = cylPoints.length - 1;
  const SEGMENTS = cylPoints[0].length - 1;
  const { proj, sMin, sMax } = transformAndProject(cylPoints, matrix, fov);
  setEffect("flat");
  strokeWidth(1.2);
  for (let r = 0;r <= RINGS; r++) {
    for (let s = 0;s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }
  for (let s = 0;s <= SEGMENTS; s++) {
    for (let r = 0;r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}
function createCone(radius, height, segments, rings) {
  const points = [];
  for (let r = 0;r <= rings; r++) {
    const t = r / rings;
    const y = height * (t - 0.5);
    const rad = radius * (1 - t);
    points[r] = [];
    for (let s = 0;s <= segments; s++) {
      const a = 2 * Math.PI * (s / segments);
      points[r][s] = new Vec3(rad * Math.cos(a), y, rad * Math.sin(a));
    }
  }
  return points;
}
function drawCone(conePoints, matrix, fov, tint = { r: 255, g: 200, b: 150 }) {
  const RINGS = conePoints.length - 1;
  const SEGMENTS = conePoints[0].length - 1;
  const { proj, sMin, sMax } = transformAndProject(conePoints, matrix, fov);
  setEffect("flat");
  strokeWidth(1.2);
  for (let r = 0;r <= RINGS; r++) {
    for (let s = 0;s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }
  for (let s = 0;s <= SEGMENTS; s++) {
    for (let r = 0;r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}
function createTorus(majorRadius, minorRadius, segments, rings) {
  const points = [];
  for (let r = 0;r <= rings; r++) {
    const u = 2 * Math.PI * (r / rings);
    points[r] = [];
    for (let s = 0;s <= segments; s++) {
      const v = 2 * Math.PI * (s / segments);
      const x = (majorRadius + minorRadius * Math.cos(u)) * Math.cos(v);
      const y = minorRadius * Math.sin(u);
      const z = (majorRadius + minorRadius * Math.cos(u)) * Math.sin(v);
      points[r][s] = new Vec3(x, y, z);
    }
  }
  return points;
}
function drawTorus(torusPoints, matrix, fov, tint = { r: 200, g: 180, b: 255 }) {
  const RINGS = torusPoints.length - 1;
  const SEGMENTS = torusPoints[0].length - 1;
  const { proj, sMin, sMax } = transformAndProject(torusPoints, matrix, fov);
  setEffect("flat");
  strokeWidth(1.2);
  for (let r = 0;r <= RINGS; r++) {
    for (let s = 0;s < SEGMENTS; s++) {
      shadedLine(proj[r][s], proj[r][s + 1], sMin, sMax, tint);
    }
  }
  for (let s = 0;s <= SEGMENTS; s++) {
    for (let r = 0;r < RINGS; r++) {
      shadedLine(proj[r][s], proj[r + 1][s], sMin, sMax, tint);
    }
  }
}

// src/main.ts
var SCREEN_W = 900;
var SCREEN_H = 600;
var FOV = 400;
var SPHERE_RADIUS = 38;
var CYL_RADIUS = 30;
var CYL_HEIGHT = 60;
var CONE_RADIUS = 30;
var CONE_HEIGHT = 70;
var TORUS_MAJOR = 50;
var TORUS_MINOR = 20;
var spherePts = createSphere(SPHERE_RADIUS, 20, 12);
var boxPts = createBox(60, 60, 60);
var cylPts = createCylinder(CYL_RADIUS, CYL_HEIGHT, 20, 8);
var conePts = createCone(CONE_RADIUS, CONE_HEIGHT, 20, 8);
var torusPts = createTorus(TORUS_MAJOR, TORUS_MINOR, 24, 16);
var time = 0;
function draw() {
  time += 0.02;
  background(15, 15, 30);
  const rotY = time * 0.6;
  const rotX = Math.sin(time * 0.3) * 0.3;
  const m1 = multMatrix(translateMatrix(-180, 130, 0), rotateMatrix(rotX, rotY, 0));
  drawSphere(spherePts, m1, FOV, { r: 100, g: 180, b: 255 });
  const m2 = multMatrix(translateMatrix(180, 130, 0), rotateMatrix(rotX, rotY, 0));
  drawBox(boxPts, m2, FOV, { r: 255, g: 220, b: 100 });
  const m3 = multMatrix(translateMatrix(-180, -130, 0), rotateMatrix(rotX, rotY, 0));
  drawCylinder(cylPts, m3, FOV, { r: 120, g: 220, b: 140 });
  const m4 = multMatrix(translateMatrix(0, -130, 0), rotateMatrix(rotX, rotY, 0));
  drawCone(conePts, m4, FOV, { r: 255, g: 160, b: 100 });
  const m5 = multMatrix(translateMatrix(180, -130, 0), rotateMatrix(rotX, rotY, 0));
  drawTorus(torusPts, m5, FOV, { r: 200, g: 150, b: 255 });
}
init(SCREEN_W, SCREEN_H);
startAnimation(draw);
