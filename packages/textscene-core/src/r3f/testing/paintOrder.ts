/**
 * A rendered object's place in the 2D canvas, read as three reads it:
 * `reversePainterSortStable` (`three/src/renderers/webgl/WebGLRenderLists.js`)
 * sorts by `groupOrder`, then `renderOrder`, then view z descending, then id.
 * Every 2D canvas material skips depth writes, so this comparator decides what covers what.
 */
import * as THREE from 'three';
import { canvasRenderOrder, layerRankOf, layerRanks } from '../canvasPaintOrder';
import { WORLD_CANVAS_LAYER } from '../lighting2d/canvasItemPlacement';

/**
 * The `groupOrder` three sorts this object by: the nearest `Group` ancestor's
 * `renderOrder`, or 0 (`three/src/renderers/WebGLRenderer.js:1838-1840`). A canvas
 * item's place lives there (`canvasPaintOrder.ts`), so `mesh.renderOrder` alone is
 * the less significant half.
 */
export function nearestGroupOrder(object: THREE.Object3D): number {
  for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
    if ((ancestor as THREE.Group).isGroup) return ancestor.renderOrder;
  }
  return 0;
}

/**
 * The key `reversePainterSortStable` (`WebGLRenderLists.js`) sorts by, smallest first:
 * `groupOrder` of the nearest `Group` (`WebGLRenderer.js:1838-1840`), `renderOrder`,
 * and negated world z, since the ortho camera looks down -Z from z=1000. No 2D
 * material writes depth. The tests assert the order of the keys, not their encoding.
 */
export function paintKey(object: THREE.Object3D): [number, number, number] {
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  return [nearestGroupOrder(object), object.renderOrder, -world.z];
}

/** Orders two `paintKey`s as an array sort does: negative when `a` draws first. */
export function compareKeys(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    const [ai, bi] = [a[i]!, b[i]!];
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/** The world canvas's rank in a scene that declares no `CanvasLayer`. */
const WORLD_LAYER_RANK = layerRankOf(layerRanks([]), WORLD_CANVAS_LAYER);

/** The packed key of a world canvas item in a scene that declares no `CanvasLayer`. */
export function worldCanvasKey(zFinal: number, sequence: number): number {
  return canvasRenderOrder({ layerRank: WORLD_LAYER_RANK, zFinal, sequence });
}

/** Whether the packed `key` lies in the world canvas's `zFinal` bucket, at any sequence. */
export function isInZBucket(key: number, zFinal: number): boolean {
  return key >= worldCanvasKey(zFinal, 0) && key < worldCanvasKey(zFinal + 1, 0);
}
