/**
 * The textures one atlas holds, each with its holder count, as Godot's decal atlas and area light
 * atlas keep them (`texture_storage.cpp:3232-3258`): a texture joins with its first holder and
 * leaves with its last, and the atlas rebuilds only when one joined or changed its pixels.
 */

import type * as THREE from 'three';

/** A held texture: its holders, and the pixel version the atlas last read. */
interface Held {
  users: number;
  version: number;
}

export class AtlasHolders {
  /** In the order each texture joined, as Godot's map keeps it. Written only by `hold`, `release` and `takeChanged`. */
  private readonly held = new Map<THREE.Texture, Held>();
  /** Whether a texture joined or changed its pixels since the last `takeChanged`. */
  private isDirty = true;

  /** Puts `texture` in the atlas for one more holder. */
  hold(texture: THREE.Texture): void {
    const held = this.held.get(texture);
    if (held) {
      held.users++;
      return;
    }
    this.held.set(texture, { users: 1, version: texture.version });
    this.isDirty = true;
  }

  /** Lets go of `texture` for one holder, and is true when that was its last. A stranger changes nothing. */
  release(texture: THREE.Texture): boolean {
    const held = this.held.get(texture);
    if (!held) return false;
    held.users--;
    if (held.users > 0) return false;
    this.held.delete(texture);
    return true;
  }

  /** Asks the next `takeChanged` for a rebuild, as when a texture left that held others out. */
  markChanged(): void {
    this.isDirty = true;
  }

  /**
   * The held textures in join order when one joined or changed its pixels since the last call, and
   * else undefined. A texture that left keeps its pixels in the atlas until then.
   */
  takeChanged(): THREE.Texture[] | undefined {
    for (const [texture, held] of this.held) {
      if (held.version === texture.version) continue;
      held.version = texture.version;
      this.isDirty = true;
    }
    if (!this.isDirty) return undefined;
    this.isDirty = false;
    return [...this.held.keys()];
  }
}
