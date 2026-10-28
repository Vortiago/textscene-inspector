/**
 * The one float texture of a scene's reflection probes and decals: the probes' rows come first, the
 * decals' follow at `DECAL_FIRST_ROW` (`sceneRowsChunk.ts`). Written by `SceneProbes` and
 * `SceneDecals` when their rows change, and shown to every program for a render of the scene.
 */

import type * as THREE from 'three';
import { RowTexture } from '../rowTexture/rowTexture.js';
import type { PackedRows } from '../rowTexture/packedRows.js';
import { SceneHolding } from '../sceneHolding.js';
import { leaveSlot, showInSlot } from '../sharedTexture.js';
import { DECAL_FIRST_ROW } from './sceneRowsChunk.js';
import { SCENE_ROW_TEXELS } from './sceneRowTexels.js';
import { sceneRowsSlot } from './sceneRowsSlot.js';

const ROW_FLOATS = SCENE_ROW_TEXELS * 4;

/** Both bands in one buffer, the probes' rows then the decals', for `RowTexture` to upload. */
class StackedRows implements PackedRows {
  data = new Float32Array(DECAL_FIRST_ROW * ROW_FLOATS);
  count = DECAL_FIRST_ROW;

  /** Copies `rows` to start at row `firstRow`, and grows the buffer for them. */
  write(firstRow: number, rows: PackedRows): void {
    const end = (firstRow + rows.count) * ROW_FLOATS;
    if (this.data.length < end) {
      const grown = new Float32Array(end * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(rows.data.subarray(0, rows.count * ROW_FLOATS), firstRow * ROW_FLOATS);
  }
}

export class SceneRows {
  private readonly stack = new StackedRows();
  /** The texture the rows upload into, which a growth replaces after the slot lets go of it. */
  private readonly rowTexture = new RowTexture(SCENE_ROW_TEXELS, (replaced) =>
    leaveSlot(this.renderer, sceneRowsSlot, replaced)
  );

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  /** Replaces the probes' rows with `rows`, which hold at most `DECAL_FIRST_ROW` of them. */
  setProbes(rows: PackedRows): void {
    this.stack.write(0, rows);
    this.rowTexture.invalidate(this.stack);
  }

  /** Replaces the decals' rows with `rows`. */
  setDecals(rows: PackedRows): void {
    this.stack.write(DECAL_FIRST_ROW, rows);
    this.stack.count = DECAL_FIRST_ROW + rows.count;
    this.rowTexture.invalidate(this.stack);
  }

  /** The texture that holds both bands, uploaded once a band has changed. */
  texture(): THREE.DataTexture {
    return this.rowTexture.hold(this.stack);
  }

  /** Points every program at this scene's rows. */
  show(): void {
    this.renderer.initTexture(this.texture());
    showInSlot(this.renderer, sceneRowsSlot, this.rowTexture.texture);
  }

  dispose(): void {
    leaveSlot(this.renderer, sceneRowsSlot, this.rowTexture.texture);
    this.rowTexture.dispose();
  }
}

const rowsOfScenes = new SceneHolding((_scene, renderer) => new SceneRows(renderer));

/**
 * The rows of `scene` and the call that lets go of them. The probes and the decals of one scene hold
 * the same rows; the last to let go frees the texture.
 *
 * @canonical The per-scene row texture a program reads probes and decals from
 */
export function holdSceneRows(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): { rows: SceneRows; release: () => void } {
  const release = rowsOfScenes.hold(scene, renderer, Symbol('scene rows'));
  // `hold` has just made it.
  return { rows: rowsOfScenes.of(scene)!, release };
}
