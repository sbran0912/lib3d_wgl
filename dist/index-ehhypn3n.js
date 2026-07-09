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
class Vector3 {
  x;
  y;
  z;
  constructor(x, y, z) {
    this.x = x, this.y = y, this.z = z;
  }
  transform(m) {
    return new Vector3(m[0][0] * this.x + m[0][1] * this.y + m[0][2] * this.z + m[0][3], m[1][0] * this.x + m[1][1] * this.y + m[1][2] * this.z + m[1][3], m[2][0] * this.x + m[2][1] * this.y + m[2][2] * this.z + m[2][3]);
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
function createSphere(radius, segments, rings) {
  const points = [];
  for (let r = 0;r <= rings; r++) {
    const lat = Math.PI * (r / rings) - Math.PI / 2;
    points[r] = [];
    for (let s = 0;s <= segments; s++) {
      const lon = 2 * Math.PI * (s / segments);
      points[r][s] = new Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon));
    }
  }
  return points;
}
function drawSphere(spherePoints, matrix, fov, tint = { r: 255, g: 255, b: 255 }) {
  const RINGS = spherePoints.length - 1;
  const SEGMENTS = spherePoints[0].length - 1;
  const transformed = [];
  for (let r = 0;r <= RINGS; r++) {
    transformed[r] = spherePoints[r].map((v) => v.transform(matrix));
  }
  const proj = [];
  for (let r = 0;r <= RINGS; r++) {
    proj[r] = transformed[r].map((v) => project(fov, v));
  }
  const sMin = Math.min(...proj.flat().map((p) => p.s));
  const sMax = Math.max(...proj.flat().map((p) => p.s));
  const sRange = sMax - sMin || 1;
  setEffect("flat");
  strokeWidth(1.2);
  for (let r = 0;r <= RINGS; r++) {
    for (let s = 0;s < SEGMENTS; s++) {
      const p1 = proj[r][s];
      const p2 = proj[r][s + 1];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      strokeColor(Math.round(brightness * tint.r / 255), Math.round(brightness * tint.g / 255), Math.round(brightness * tint.b / 255));
      line(p1.x, p1.y, p2.x, p2.y);
    }
  }
  for (let s = 0;s <= SEGMENTS; s++) {
    for (let r = 0;r < RINGS; r++) {
      const p1 = proj[r][s];
      const p2 = proj[r + 1][s];
      const t = ((p1.s + p2.s) / 2 - sMin) / sRange;
      const brightness = Math.round(60 + t * 195);
      strokeColor(Math.round(brightness * tint.r / 255), Math.round(brightness * tint.g / 255), Math.round(brightness * tint.b / 255));
      line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

// src/main.ts
var SCREEN_W = 600;
var SCREEN_H = 400;
var FOV = 300;
var sphere1Points = createSphere(100, 20, 12);
var sphere2Points = createSphere(60, 16, 10);
var angleX = 0;
var angleY = 0;
var orbitAngle = 0;
function draw() {
  background(15, 15, 30);
  const M1 = multMatrix(translateMatrix(0, 0, 100), rotateMatrix(angleX * 0.8, angleY * 1.2, 0));
  drawSphere(sphere1Points, M1, FOV, { r: 100, g: 180, b: 255 });
  const orbitRadius = 200;
  const ox = Math.cos(orbitAngle) * orbitRadius;
  const oz = 100 + Math.sin(orbitAngle) * orbitRadius;
  const M2 = multMatrix(translateMatrix(ox, 0, oz), rotateMatrix(angleX * 1.5, angleY * 0.7, 0));
  drawSphere(sphere2Points, M2, FOV, { r: 255, g: 180, b: 80 });
  angleX += 0.005;
  angleY += 0.008;
  orbitAngle += 0.01;
}
init(SCREEN_W, SCREEN_H);
startAnimation(draw);
