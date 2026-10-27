/**
 * Puts the editor chrome of a scene on the layer Godot draws its gizmos on, which no decal mask
 * meets, so a decal never lands on a gizmo, a selection box or a debug overlay. Chrome is the
 * drawables under an object tagged `isEditorHelper`. The draw hooks show a draw its layers, as a
 * surface's do (`surfaceDrawHooks.ts`).
 */

import * as THREE from 'three';
import { GODOT_EDITOR_GIZMO_LAYERS } from '../../godot/scene/visualLayers.js';
import { isUnderEditorHelper } from '../editorHelpers.js';
import { restoreInstanceLayers, showInstanceLayers } from '../instanceLayers/instanceLayers.js';
import { TrackedObjects } from '../trackedObjects.js';
import { setVisualLayers } from '../visualLayers.js';

type Drawable = THREE.Mesh | THREE.Line | THREE.Points;

function isDrawable(object: THREE.Object3D): object is Drawable {
  const { isMesh, isLine, isPoints } = object as Partial<Record<'isMesh' | 'isLine' | 'isPoints', boolean>>;
  return isMesh === true || isLine === true || isPoints === true;
}

/** Whether `object` draws, and it or an ancestor is the root of editor chrome. */
function isChromeDrawable(object: THREE.Object3D): object is Drawable {
  return isDrawable(object) && isUnderEditorHelper(object);
}

/**
 * The chrome on the gizmo layer, whichever holder placed it. A holder that a later Decal mounts
 * replaces another, and a second hook on one drawable would chain a wrapper for each holder.
 */
const placed = new WeakSet<Drawable>();

export class EditorChromeLayers {
  private readonly chrome: TrackedObjects<Drawable>;
  /** The `chrome.version` of the last `place`, so a render with no new chrome walks nothing. */
  private placedVersion = -1;

  constructor(scene: THREE.Scene) {
    this.chrome = new TrackedObjects(scene, isChromeDrawable);
  }

  /** Places the chrome that arrived since the last call. */
  place(): void {
    const drawables = this.chrome.current();
    if (this.chrome.version === this.placedVersion) return;
    this.placedVersion = this.chrome.version;
    for (const drawable of drawables) {
      if (placed.has(drawable)) continue;
      placed.add(drawable);
      setVisualLayers(drawable, GODOT_EDITOR_GIZMO_LAYERS);
      showLayersWhenDrawn(drawable);
    }
  }

  dispose(): void {
    this.chrome.dispose();
  }
}

/** Chains the hooks of `drawable`, so its own still run. */
function showLayersWhenDrawn(drawable: Drawable): void {
  const { onBeforeRender, onAfterRender } = drawable;
  drawable.onBeforeRender = function (this: THREE.Object3D, renderer, ...rest) {
    onBeforeRender.call(this, renderer, ...rest);
    showInstanceLayers(renderer, this);
  };
  drawable.onAfterRender = function (this: THREE.Object3D, ...args) {
    onAfterRender.apply(this, args);
    restoreInstanceLayers();
  };
}
