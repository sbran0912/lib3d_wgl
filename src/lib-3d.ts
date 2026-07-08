/* 
-----------------------------------------------------------------
3D Vektoren und Matrizen
-----------------------------------------------------------------*/
export type Matrix4x4 = number[][];
export type Vector2 = { x: number, y: number, s: number };  // s = Skalierungsfaktor (für Punktgröße)

export class Vector3 {
  x: number;
  y: number;
  z: number;
  constructor(x: number, y: number, z: number) {
    this.x= x,  
    this.y= y,
    this.z= z
  } 

  transform(m: Matrix4x4): Vector3 {
    return new Vector3(
      m[0][0] * this.x + m[0][1] * this.y + m[0][2] * this.z + m[0][3],
      m[1][0] * this.x + m[1][1] * this.y + m[1][2] * this.z + m[1][3],
      m[2][0] * this.x + m[2][1] * this.y + m[2][2] * this.z + m[2][3],
    );
  }
}

// 4x4 Translationsmatrix
export function translateMatrix(dx: number, dy: number, dz: number) {
  return [
    [1, 0, 0, dx],
    [0, 1, 0, dy],
    [0, 0, 1, dz],
    [0, 0, 0, 1],
  ];
}

// 4x4 Rotationsmatrix (kombiniert)
export function rotateMatrix(ax: number, ay: number, az: number): Matrix4x4 {
  const Rx = [
    [1, 0, 0, 0],
    [0, Math.cos(ax), -Math.sin(ax), 0],
    [0, Math.sin(ax), Math.cos(ax), 0],
    [0, 0, 0, 1],
  ];

  const Ry = [
    [Math.cos(ay), 0, Math.sin(ay), 0],
    [0, 1, 0, 0],
    [-Math.sin(ay), 0, Math.cos(ay), 0],
    [0, 0, 0, 1],
  ];

  const Rz = [
    [Math.cos(az), -Math.sin(az), 0, 0],
    [Math.sin(az), Math.cos(az), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  // Multipliziere (Ry * Rx) * Rz
  return multMatrix(Rz, multMatrix(Ry, Rx));
}

// 4x4 Matrixmultiplikation
export function multMatrix(a: Matrix4x4, b: Matrix4x4):Matrix4x4 {
  const result = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

export function project(fov:number, v: Vector3): Vector2 {
  const s = fov / (fov + v.z);  // Projektionsfaktor
  return {
    x: v.x * s,
    y: v.y * s,
    s,  // Skalierungsfaktor (nützlich z.B. für Punktgröße)
  };
}