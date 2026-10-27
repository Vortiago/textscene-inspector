/** The float texture a pass reads its packed rows from: a light, volume, probe or decal per row. */

import * as THREE from 'three';
import type { PackedRows } from './packedRows.js';

/**
 * Holds `PackedRows` in a float texture of one row of texels per light, volume, probe or decal. It
 * uploads again only when it holds other rows, or when they changed.
 *
 * @canonical A float texture of packed rows
 */
export class RowTexture {
  texture: THREE.DataTexture;
  /** The rows the texture holds, null before the first upload or after `invalidate`. */
  private uploaded: PackedRows | null = null;

  /** `beforeReplace` gets the texture a growth is about to dispose, so the owner stops pointing at it. */
  constructor(
    private readonly width: number,
    private readonly beforeReplace?: (texture: THREE.DataTexture) => void
  ) {
    this.texture = rowTexture(width, 1);
  }

  /** Marks `rows` stale, where the texture holds them, after a pack changed them in place. */
  invalidate(rows: PackedRows): void {
    if (this.uploaded === rows) this.uploaded = null;
  }

  /**
   * The texture holding `rows` in its first rows. It only grows, and doubles, so a count that
   * changes as the camera culls a volume reallocates nothing. The shader reads only `count` rows.
   */
  hold(rows: PackedRows): THREE.DataTexture {
    const height = this.texture.image.height;
    if (height < rows.count) {
      this.beforeReplace?.(this.texture);
      this.texture.dispose();
      this.texture = rowTexture(this.width, Math.max(rows.count, height * 2));
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
