/**
 * The decals of one scene: it packs the visible ones for each render of the scene and shows them,
 * with the decal atlas and the render's mipmap bias, to every program that draws a surface, as
 * Godot's clustered renderer does for each viewport (`render_forward_clustered.cpp:1639`).
 */

import type * as THREE from 'three';
import { decalAtlasTexture, setDecalAtlasFilter, updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas.js';
import {
  godotTextureFilterState,
  type TextureFilterState,
} from '../../resources/textures/godotTextureFilter.js';
import { projectDecalFilter } from '../../parser/projectSettingsParser.js';
import { compareTreeOrder } from '../contexts/TreeOrderContext.js';
import { currentMipmapBias } from '../materials/godotMipmapBias.js';
import { writeNearestAnisotropy } from '../nearestAnisotropy.js';
import { observeSceneCull, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { holdSceneRows, type SceneRows } from '../sceneRows/sceneRows.js';
import { leaveSlot, showInSlot } from '../sharedTexture.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { isDecal, type DecalObject } from './decalObject.js';
import { EditorChromeLayers } from './editorChromeLayers.js';
import { DecalRows } from './decalRows.js';
import { decalAtlasSlot, SHOWN_COUNT, SHOWN_GRADIENT_SCALE, shownDecals } from './decalSlots.js';

export class SceneDecals {
  private readonly decals: TrackedObjects<DecalObject>;
  private readonly chrome: EditorChromeLayers;
  /** The rows of the drawn decals, rewritten in place by each `show`. */
  private readonly rows = new DecalRows();
  /** The scene's rows, which the probes of the scene write too. */
  private readonly sceneRows: SceneRows;
  private readonly releaseSceneRows: () => void;
  /** How the atlas is sampled in this scene's renders, set by `setFilter`. */
  private filter = godotTextureFilterState(projectDecalFilter(null));
  /** The `version` of the atlas whose anisotropy was last written, so one upload is written once. */
  private anisotropyWrittenAt = -1;
  /** The visible decals in tree order, rewritten by each `show`. */
  private readonly ordered: DecalObject[] = [];
  private readonly stopObserving: (() => void)[];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ) {
    this.decals = new TrackedObjects(scene, isDecal);
    const held = holdSceneRows(scene, renderer);
    this.sceneRows = held.rows;
    this.releaseSceneRows = held.release;
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
    this.releaseSceneRows();
  }

  /** Samples the atlas by `filter` in this scene's renders, as its project and viewport say. */
  setFilter(filter: TextureFilterState): void {
    this.filter = filter;
  }

  /** Points every program at this scene's decals for a render from `camera`. */
  private show(camera: THREE.Camera): void {
    this.chrome.place();
    this.orderVisibleDecals();
    if (this.ordered.length === 0) return this.endRender();
    updateDecalAtlas(this.renderer.capabilities.maxTextureSize);
    if (this.rows.pack(this.ordered, camera.matrixWorld)) this.sceneRows.setDecals(this.rows);
    if (this.rows.count === 0) return this.endRender();
    shownDecals[SHOWN_COUNT] = this.rows.count;
    shownDecals[SHOWN_GRADIENT_SCALE] = 2 ** currentMipmapBias();
    const atlas = decalAtlasTexture();
    setDecalAtlasFilter(this.filter);
    this.renderer.initTexture(atlas);
    this.writeAnisotropy(atlas);
    showInSlot(this.renderer, decalAtlasSlot, atlas);
    this.sceneRows.show();
  }

  /** three leaves the taps of a nearest filter unwritten, and an upload resets them. */
  private writeAnisotropy(atlas: THREE.Texture): void {
    if (atlas.version === this.anisotropyWrittenAt) return;
    this.anisotropyWrittenAt = atlas.version;
    writeNearestAnisotropy(this.renderer, atlas);
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
