/**
 * A float texture of packed rows, one row of texels per light or volume, that the light pass reads.
 * It uploads again only when it holds another view's rows, or when they changed.
 */

import * as THREE from 'three';

/** Rows of `width` texels, `count` of them, then unused space. */
export interface PackedRows {
  readonly data: Float32Array;
  readonly count: number;
}

export class FogRowTexture {
  texture: THREE.DataTexture;
  /** The rows the texture holds, null before the first upload or after `invalidate`. */
  private uploaded: PackedRows | null = null;

  constructor(private readonly width: number) {
    this.texture = rowTexture(width, 1);
  }

  /** Marks `rows` stale, where the texture holds them, after a pack changed them in place. */
  invalidate(rows: PackedRows): void {
    if (this.uploaded === rows) this.uploaded = null;
  }

  /** The texture holding `rows`. A new row count needs a texture of another height. */
  hold(rows: PackedRows): THREE.DataTexture {
    const height = Math.max(1, rows.count);
    if (this.texture.image.height !== height) {
      this.texture.dispose();
      this.texture = rowTexture(this.width, height);
      this.uploaded = null;
    }
    if (this.uploaded !== rows) {
      const texels = this.texture.image.data as Float32Array;
      texels.set(rows.data.subarray(0, Math.min(texels.length, rows.count * this.width * 4)));
      this.texture.needsUpdate = true;
      this.uploaded = rows;
    }
    return this.texture;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

function rowTexture(width: number, rows: number): THREE.DataTexture {
  const texels = new Float32Array(width * 4 * rows);
  return new THREE.DataTexture(texels, width, rows, THREE.RGBAFormat, THREE.FloatType);
}
