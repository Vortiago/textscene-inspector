/**
 * The arrays a PrimitiveMesh's `create_mesh_array` pushes, one vertex at a time, gathered into a
 * Godot surface. A port keeps Godot's loop and calls `vertex` where Godot pushes a point.
 */

import type { GodotSurface } from '../godotSurface.js';

type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

/** The atlas cells a `create_mesh_array` lays its faces in: three across and three down. */
export const ONE_THIRD = 1 / 3;
export const TWO_THIRDS = 2 / 3;

export class SurfaceWriter {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly tangents: number[] = [];
  private readonly uvs: number[] = [];
  private readonly uv2s: number[] = [];
  private readonly indices: number[] = [];

  /** `hasUv2` is Godot's `p_add_uv2`: without it, `vertex` drops its UV2. */
  constructor(private readonly hasUv2: boolean) {}

  /** The index the next `vertex` takes, Godot's `point`. */
  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(position: Vec3, normal: Vec3, tangent: Vec4, uv: Vec2, uv2: Vec2): void {
    this.positions.push(...position);
    this.normals.push(...normal);
    this.tangents.push(...tangent);
    this.uvs.push(...uv);
    if (this.hasUv2) this.uv2s.push(...uv2);
  }

  /**
   * The two clockwise triangles between column `i - 1` and `i` of two rows that start at vertex
   * `prevrow` and `thisrow`, in the order every grid loop of `primitive_meshes.cpp` pushes them.
   */
  quadBetweenRows(prevrow: number, thisrow: number, i: number): void {
    this.indices.push(prevrow + i - 1, prevrow + i, thisrow + i - 1);
    this.indices.push(prevrow + i, thisrow + i, thisrow + i - 1);
  }

  /**
   * `quadBetweenRows` for two faces a loop writes a vertex apart, the even face first: the
   * front and back, the right and left, and the top and bottom of a BoxMesh or PrismMesh.
   */
  quadPairBetweenRows(prevrow: number, thisrow: number, i: number): void {
    const i2 = i * 2;
    this.indices.push(prevrow + i2 - 2, prevrow + i2, thisrow + i2 - 2);
    this.indices.push(prevrow + i2, thisrow + i2, thisrow + i2 - 2);
    this.indices.push(prevrow + i2 - 1, prevrow + i2 + 1, thisrow + i2 - 1);
    this.indices.push(prevrow + i2 + 1, thisrow + i2 + 1, thisrow + i2 - 1);
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  surface(): GodotSurface {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      tangents: new Float32Array(this.tangents),
      uvs: new Float32Array(this.uvs),
      uv2s: this.hasUv2 ? new Float32Array(this.uv2s) : undefined,
      indices: this.vertexCount > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
    };
  }
}
