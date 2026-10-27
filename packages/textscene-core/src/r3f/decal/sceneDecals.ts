/**
 * The decals of one scene: it packs the visible ones for each render of the scene and shows them,
 * with the decal atlas and the render's mipmap bias, to every program that draws a surface, as
 * Godot's clustered renderer does for each viewport (`render_forward_clustered.cpp:1639`).
 */

import type * as THREE from 'three';
import { decalAtlasRect, decalAtlasTexture, updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas.js';
import { compareTreeOrder } from '../contexts/TreeOrderContext.js';
import { currentMipmapBias } from '../materials/godotMipmapBias.js';
import { observeSceneCull, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { RowTexture } from '../rowTexture/rowTexture.js';
import { leaveSlot, showInSlot } from '../sharedTexture.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { isDecal, type DecalObject } from './decalObject.js';
import { EditorChromeLayers } from './editorChromeLayers.js';
import { DECAL_ROW_TEXELS, DecalRows, type DrawnDecal } from './decalRows.js';
import { decalAtlasSlot, decalRowsSlot, SHOWN_COUNT, SHOWN_MIPMAP_BIAS, shownDecals } from './decalSlots.js';

export class SceneDecals {
  private readonly decals: TrackedObjects<DecalObject>;
  private readonly chrome: EditorChromeLayers;
  /** The rows of the drawn decals, rewritten in place by each `show`. */
  private readonly rows = new DecalRows();
  /** The texture the rows upload into, which a growth replaces after the slot lets go of it. */
  private readonly rowTexture = new RowTexture(DECAL_ROW_TEXELS, (replaced) =>
    leaveSlot(this.renderer, decalRowsSlot, replaced)
  );
  /** The visible decals in tree order, rewritten by each `show`. */
  private readonly ordered: DecalObject[] = [];
  private readonly stopObserving: (() => void)[];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ) {
    this.decals = new TrackedObjects(scene, isDecal);
    this.chrome = new EditorChromeLayers(scene);
    this.stopObserving = [
      // After the observers that move content and set the bias, so a decal packs where it draws.
      observeSceneCull(scene, (camera) => this.show(camera)),
      observeSceneRenderEnd(scene, () => this.endRender()),
    ];
  }

  dispose(): void {
    for (const stop of this.stopObserving) stop();
    this.decals.dispose();
    this.chrome.dispose();
    leaveSlot(this.renderer, decalAtlasSlot, decalAtlasTexture());
    leaveSlot(this.renderer, decalRowsSlot, this.rowTexture.texture);
    this.rowTexture.dispose();
  }

  /** Points every program at this scene's decals for a render from `camera`. */
  private show(camera: THREE.Camera): void {
    this.chrome.place();
    this.orderVisibleDecals();
    if (this.ordered.length === 0) {
      shownDecals[SHOWN_COUNT] = 0;
      return;
    }
    updateDecalAtlas(this.renderer.capabilities.maxTextureSize);
    if (this.rows.pack(this.ordered.map(drawnDecal), camera.matrixWorld))
      this.rowTexture.invalidate(this.rows);
    if (this.rows.count === 0) {
      shownDecals[SHOWN_COUNT] = 0;
      return;
    }
    shownDecals[SHOWN_COUNT] = this.rows.count;
    shownDecals[SHOWN_MIPMAP_BIAS] = currentMipmapBias();
    const atlas = decalAtlasTexture();
    this.renderer.initTexture(atlas);
    this.renderer.initTexture(this.rowTexture.hold(this.rows));
    showInSlot(this.renderer, decalAtlasSlot, atlas);
    showInSlot(this.renderer, decalRowsSlot, this.rowTexture.texture);
  }

  private orderVisibleDecals(): void {
    this.ordered.length = 0;
    for (const decal of this.decals.current()) if (visibleInTree(decal)) this.ordered.push(decal);
    this.ordered.sort((a, b) => compareTreeOrder(a.treeOrder, b.treeOrder));
  }

  /** Leaves later renders, of this scene or another, without decals. */
  private endRender(): void {
    shownDecals[SHOWN_COUNT] = 0;
  }
}

function drawnDecal(object: DecalObject): DrawnDecal {
  return {
    matrixWorld: object.matrixWorld,
    look: object.decal,
    albedoRect: (object.albedo && decalAtlasRect(object.albedo)) ?? null,
  };
}
