import * as T from "three";
import type { Building } from "./simulation";

// Pure tile-unit recipes. Instancing is split by shape and 64-tile chunk.
export type Part = {
  shape: "box" | "roof" | "ball" | "trunk" | "ring";
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
};
export const part = (
  shape: Part["shape"],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: number,
): Part => ({ shape, x, y, z, sx, sy, sz, color });
export function batch(group: T.Group, parts: Part[], chunkSize = 64) {
  const buckets = new Map<string, Part[]>();
  for (const p of parts) {
    const key = `${p.shape}:${Math.floor(p.x / chunkSize)}:${Math.floor(p.z / chunkSize)}`;
    const bucket = buckets.get(key) || [];
    bucket.push(p);
    buckets.set(key, bucket);
  }
  const matrix = new T.Matrix4(),
    q = new T.Quaternion(),
    color = new T.Color();
  for (const list of buckets.values()) {
    const shape = list[0].shape;
    const geometry =
      shape === "roof"
        ? new T.ConeGeometry(0.71, 1, 4)
        : shape === "ball"
          ? new T.IcosahedronGeometry(0.5, 1)
          : shape === "trunk"
            ? new T.CylinderGeometry(0.5, 0.6, 1, 7)
            : shape === "ring"
              ? new T.TorusGeometry(0.38, 0.12, 6, 16)
              : new T.BoxGeometry(1, 1, 1);
    if (shape === "roof") geometry.rotateY(Math.PI / 4);
    if (shape === "ring") geometry.rotateX(Math.PI / 2);
    const mesh = new T.InstancedMesh(
      geometry,
      new T.MeshStandardMaterial({ roughness: 0.9 }),
      list.length,
    );
    list.forEach((p, i) => {
      matrix.compose(
        new T.Vector3(p.x, p.y, p.z),
        q,
        new T.Vector3(p.sx, p.sy, p.sz),
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.setHex(p.color));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}
export function tree(parts: Part[], x: number, z: number, s = 1) {
  parts.push(
    part("trunk", x, 0.35 * s, z, 0.15 * s, 0.7 * s, 0.15 * s, 0x866b4c),
    part("ball", x, 0.95 * s, z, 0.9 * s, 1.15 * s, 0.85 * s, 0x618a58),
    part(
      "ball",
      x + 0.22 * s,
      1.12 * s,
      z - 0.12 * s,
      0.7 * s,
      0.85 * s,
      0.7 * s,
      0x80a567,
    ),
  );
}
export function buildingParts(b: Building, c: number): Part[] {
  const p: Part[] = [],
    { x, y: z, kind: k } = b;
  const box = (
    dx: number,
    y: number,
    dz: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => p.push(part("box", x + dx, y, z + dz, w, h, d, color));
  const roof = (y: number, w: number, h: number, d: number, color = 0xb56f50) =>
    p.push(part("roof", x, y, z, w, h, d, color));
  const house = (h: number) => {
    box(0, h / 2, 0, 0.7, h, 0.64, c);
    roof(h + 0.16, 0.8, 0.32, 0.74);
    box(0, 0.2, -0.326, 0.16, 0.38, 0.025, 0x577572);
    box(-0.22, h * 0.65, -0.33, 0.12, 0.15, 0.025, 0xe9f1d5);
    box(0.22, h * 0.65, -0.33, 0.12, 0.15, 0.025, 0xe9f1d5);
  };
  if (k === "road" || k === "bridge") {
    box(0, 0.035, 0, 1, 0.07, 1, c);
    if (k === "bridge") {
      box(-0.44, 0.2, 0, 0.06, 0.3, 1, 0xe7d4ad);
      box(0.44, 0.2, 0, 0.06, 0.3, 1, 0xe7d4ad);
    }
    return p;
  }
  p.push(part("ball", x + 0.1, -0.005, z + 0.1, 1.12, 0.025, 1, 0x8ba375));
  box(0, 0.025, 0, 0.94, 0.05, 0.94, k === "park" ? 0x93af75 : 0xd4c99e);
  if (k === "home") {
    if (!b.people) {
      for (const dx of [-0.4, 0.4]) box(dx, 0.12, 0, 0.035, 0.2, 0.82, c);
      box(0, 0.055, 0, 0.58, 0.025, 0.58, 0xb5c48b);
      box(0, 0.2, 0, 0.28, 0.3, 0.035, c);
    } else house(0.48 + Math.max(0, b.level - 1) * 0.32);
  } else if (k === "farm") {
    for (let i = 0; i < 4; i++)
      box(
        -0.3 + i * 0.19,
        0.08,
        0.17,
        0.09,
        0.08,
        0.53,
        i % 2 ? 0x9eac54 : 0xbb985c,
      );
    box(0, 0.27, -0.23, 0.58, 0.46, 0.36, c);
    p.push(part("roof", x, 0.62, z - 0.23, 0.66, 0.26, 0.44, 0xa66049));
  } else if (k === "well") {
    p.push(
      part("trunk", x, 0.13, z, 0.6, 0.22, 0.6, 0xbdb296),
      part("trunk", x, 0.25, z, 0.39, 0.035, 0.39, 0x64adb6),
      part("ring", x, 0.27, z, 0.72, 0.72, 0.72, 0xe7d9b7),
    );
    for (const dx of [-0.3, 0.3]) box(dx, 0.52, 0, 0.06, 0.65, 0.06, 0x916e4f);
    roof(0.91, 0.8, 0.25, 0.64, 0x648f8a);
  } else if (k === "market") {
    box(0, 0.25, 0, 0.78, 0.4, 0.55, 0x9e7951);
    for (let i = 0; i < 5; i++)
      box(-0.32 + i * 0.16, 0.72, 0, 0.16, 0.08, 0.76, i % 2 ? 0xf3dfad : c);
    for (const dx of [-0.34, 0.34])
      box(dx, 0.43, 0.25, 0.04, 0.65, 0.04, 0x896c4e);
    for (let i = 0; i < 3; i++)
      box(
        -0.24 + i * 0.24,
        0.48,
        -0.05,
        0.16,
        0.09,
        0.22,
        [0xc1764d, 0x8eac59, 0xe0bb65][i],
      );
  } else if (k === "wind") {
    p.push(part("trunk", x, 0.85, z, 0.18, 1.65, 0.18, c));
    box(0, 1.67, 0, 0.27, 0.22, 0.3, c);
    box(0, 1.67, -0.2, 0.09, 1.25, 0.045, 0xf5edcf);
    box(0, 1.67, -0.2, 1.25, 0.09, 0.045, 0xf5edcf);
    p.push(part("ball", x, 1.67, z - 0.24, 0.2, 0.2, 0.14, 0xb58f61));
  } else if (k === "park" || k === "forest") {
    tree(p, x - 0.18, z - 0.12, 0.65);
    if (k === "forest") tree(p, x + 0.23, z + 0.2, 0.55);
    else box(0.22, 0.18, 0.22, 0.4, 0.12, 0.16, 0xb29061);
  } else {
    house(k === "storage" ? 0.45 : 0.65);
    if (["power", "materials", "workshop", "mine", "recycle"].includes(k))
      box(0.25, 0.85, 0.2, 0.17, 0.65, 0.17, 0x7e8983);
    if (k === "clinic") {
      box(0, 0.63, -0.34, 0.35, 0.07, 0.035, 0xbd6958);
      box(0, 0.63, -0.36, 0.07, 0.3, 0.035, 0xbd6958);
    }
  }
  return p;
}
export function visualKey(b: Building, diagnosis: string) {
  return `${b.kind}:${b.x}:${b.y}:${b.kind === "home" ? `${b.level}:${b.people > 0}` : ""}:${diagnosis === "supply" ? b.ok : diagnosis === "traffic" ? b.net >= 0 : diagnosis === "environment" ? b.pollution > 20 : ""}`;
}
