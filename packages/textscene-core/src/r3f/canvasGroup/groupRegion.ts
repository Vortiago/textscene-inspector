/**
 * The texels a clipping group reads: the box of its owner and of the items in its window, in frame
 * pixels. The group's buffer copies and draws only there, as Godot clears only the group's rect
 * grown by a margin (`renderer_canvas_render_rd.cpp:812-866`).
 */

import * as THREE from 'three';
import { isNodeIcon } from '../editorHelpers';
import { drawableLocalBox, isDrawable, type Drawable } from '../drawable';
import { perObject } from '../../utils/perObject';
import { collects, isOwnKey, type CanvasGroupWindow } from './groupWindow';

/** A rectangle of frame texels in GL texel space: the corner at the bottom left, then the size. */
export interface TexelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The texels a filter or a derivative at the edge of the region reads beyond it, and the clear
 * margin Godot grows a group's rect by (`renderer_canvas_cull.cpp`, 5 texels), plus one.
 */
export const REGION_PAD = 6;

/** Each drawable's world box, reused every frame. Written only by `worldBox`. */
const worldBoxOf = perObject((_object: Drawable) => new THREE.Box3());

/** The bounds of a drawable object's geometry, its instances included, in world space. */
export function worldBox(object: Drawable): THREE.Box3 | null {
  const local = drawableLocalBox(object);
  return local.isEmpty() ? null : worldBoxOf(object).copy(local).applyMatrix4(object.matrixWorld);
}

/** The scene's objects with their paint-order keys, as `keyedScene` lists them. */
interface Keyed {
  objects: THREE.Object3D[];
  keys: number[];
  measured: boolean[];
}

const corner = new THREE.Vector3();

/**
 * The texel region of each group in `groups`, which are sorted by window and do not overlap. A
 * group whose items fall outside the frame answers an empty region.
 */
export function clipRegions(
  { objects, keys, measured }: Keyed,
  camera: THREE.Camera,
  frame: { width: number; height: number },
  groups: readonly { window: CanvasGroupWindow }[]
): TexelRegion[] {
  const bounds = groups.map(() => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }));
  const view = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i]!;
    if (!measured[i] || !isDrawable(object) || isNodeIcon(object) || !camera.layers.test(object.layers))
      continue;
    const at = groupAt(groups, keys[i]!);
    if (at < 0) continue;
    const box = worldBox(object);
    if (!box) continue;
    grow(bounds[at]!, box, view, frame);
  }
  return bounds.map((b) => regionOf(b, frame));
}

/** The index of the group whose window the key is in, collected or its owner's, or -1. */
function groupAt(groups: readonly { window: CanvasGroupWindow }[], key: number): number {
  let low = 0;
  let high = groups.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const { window } = groups[mid]!;
    if (key < window.from) high = mid - 1;
    else if (key >= window.to) low = mid + 1;
    else return collects(window, key) || isOwnKey(window, key) ? mid : -1;
  }
  return -1;
}

interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function grow(
  into: PixelBounds,
  box: THREE.Box3,
  view: THREE.Matrix4,
  frame: { width: number; height: number }
) {
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z).applyMatrix4(view);
        const px = (corner.x + 1) * 0.5 * frame.width;
        const py = (corner.y + 1) * 0.5 * frame.height;
        into.minX = Math.min(into.minX, px);
        into.maxX = Math.max(into.maxX, px);
        into.minY = Math.min(into.minY, py);
        into.maxY = Math.max(into.maxY, py);
      }
}

function regionOf(b: PixelBounds, { width, height }: { width: number; height: number }): TexelRegion {
  const left = Math.max(0, Math.floor(b.minX) - REGION_PAD);
  const bottom = Math.max(0, Math.floor(b.minY) - REGION_PAD);
  const right = Math.min(width, Math.ceil(b.maxX) + REGION_PAD);
  const top = Math.min(height, Math.ceil(b.maxY) + REGION_PAD);
  return { x: left, y: bottom, width: Math.max(0, right - left), height: Math.max(0, top - bottom) };
}
