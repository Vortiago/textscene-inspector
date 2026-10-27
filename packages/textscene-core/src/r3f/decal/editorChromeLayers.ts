/**
 * Puts the editor chrome of a scene on the layer Godot draws its gizmos on, which no decal mask
 * meets, so a decal never lands on a gizmo, a selection box or a debug overlay. Chrome is the
 * drawables under an object tagged `isEditorHelper`. The draw hooks show a draw its layers, as a
 * surface's do (`surfaceDrawHooks.ts`).
 */

import * as THREE from 'three';
import { GODOT_EDITOR_GIZMO_LAYERS } from '../../godot/scene/visualLayers.js';
import { isEditorHelper } from '../editorHelpers.js';
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
  if (!isDrawable(object)) return false;
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (isEditorHelper(o)) return true;
  return false;
}

export class EditorChromeLayers {
  private readonly chrome: TrackedObjects<Drawable>;
  /** The chrome that already draws on the gizmo layer. A drawable is hooked once. */
  private readonly placed = new WeakSet<Drawable>();

  constructor(scene: THREE.Scene) {
    this.chrome = new TrackedObjects(scene, isChromeDrawable);
  }

  /** Places the chrome that arrived since the last call. */
  place(): void {
    for (const drawable of this.chrome.current()) {
      if (this.placed.has(drawable)) continue;
      this.placed.add(drawable);
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
