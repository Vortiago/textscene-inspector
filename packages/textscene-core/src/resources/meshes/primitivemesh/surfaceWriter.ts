/**
 * The arrays a PrimitiveMesh's `create_mesh_array` pushes, one vertex at a time, gathered into a
 * Godot surface. A port keeps Godot's loop and calls `vertex` where Godot pushes a point.
 */

import { storedReal } from '../../../godot/math/real.js';
import type { GodotSurface } from '../godotSurface.js';

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

/**
 * The thirds a `create_mesh_array` splits its UV atlas into: the columns of a BoxMesh or PrismMesh,
 * the rows of a CapsuleMesh. Godot holds each in a `float`, so each rounds to single precision.
 */
export const ONE_THIRD = storedReal(1 / 3);
export const TWO_THIRDS = storedReal(2 / 3);

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
    // Indexed, not spread: no iterator per vector per vertex.
    this.positions.push(position[0], position[1], position[2]);
    this.normals.push(normal[0], normal[1], normal[2]);
    this.tangents.push(tangent[0], tangent[1], tangent[2], tangent[3]);
    this.uvs.push(uv[0], uv[1]);
    if (this.hasUv2) this.uv2s.push(uv2[0], uv2[1]);
  }

  /**
   * The two clockwise triangles between column `i - 1` and `i` of two rows that start at vertex
   * `prevrow` and `thisrow`, in the order each grid loop of `primitive_meshes.cpp` pushes them,
   * except TorusMesh's.
   */
  quadBetweenRows(prevrow: number, thisrow: number, i: number): void {
    this.indices.push(prevrow + i - 1, prevrow + i, thisrow + i - 1);
    this.indices.push(prevrow + i, thisrow + i, thisrow + i - 1);
  }

  /**
   * `quadBetweenRows` for two faces a loop writes a vertex apart, the even face first: the
   * front and back and the right and left of a BoxMesh or PrismMesh, and a BoxMesh's top and bottom.
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
      indices: new Uint32Array(this.indices),
    };
  }
}
