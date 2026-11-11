/**
 * The texels a clipping group reads: the box of its owner and of the items in its window, in frame
 * pixels. The group's buffer copies and draws only there, as Godot clears only the group's rect
 * grown by a margin (`renderer_canvas_render_rd.cpp:812-866`).
 */

import * as THREE from 'three';
import { drawableLocalBox, type Drawable } from '../drawable';
import { perObject } from '../../utils/perObject';
import type { CanvasFrameTarget, KeyedScene } from './canvasGroupPass';
import { windowIndexAt, type CanvasGroupWindow } from './groupWindow';

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
const REGION_PAD = 6;

/** Each drawable's world box, reused every frame. Written only by `worldBox`. */
const worldBoxOf = perObject((_object: Drawable) => new THREE.Box3());

/** The bounds of a drawable object's geometry, its instances included, in world space. */
export function worldBox(object: Drawable): THREE.Box3 | null {
  const local = drawableLocalBox(object);
  return local.isEmpty() ? null : worldBoxOf(object).copy(local).applyMatrix4(object.matrixWorld);
}

const corner = new THREE.Vector3();
const view = new THREE.Matrix4();

/**
 * The texel region of each group in `groups`, which are sorted by window and do not overlap: the
 * pixels of the boxes in its window, its owner's included because the mask reads the buffer there,
 * and of the rects of the groups nested in it, which `drawn` holds. A group whose items fall outside
 * the frame answers an empty region.
 */
export function clipRegions<G extends { window: CanvasGroupWindow }>(
  { keys, boxes }: KeyedScene,
  drawn: ReadonlyMap<G, readonly THREE.Box3[]>,
  camera: THREE.Camera,
  frame: CanvasFrameTarget,
  groups: readonly G[]
): TexelRegion[] {
  const bounds = groups.map(() => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }));
  view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box) continue;
    const at = windowIndexAt(groups, keys[i]!);
    if (at >= 0) grow(bounds[at]!, box, frame);
  }
  groups.forEach((group, at) => {
    for (const box of drawn.get(group) ?? []) grow(bounds[at]!, box, frame);
  });
  return bounds.map((b) => regionOf(b, frame));
}

interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function grow(into: PixelBounds, box: THREE.Box3, frame: CanvasFrameTarget) {
  // An orthographic view: z moves neither pixel axis, so the four corners of the xy face bound the box.
  for (let i = 0; i < 4; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, box.min.z).applyMatrix4(view);
    const px = (corner.x + 1) * 0.5 * frame.width;
    const py = (corner.y + 1) * 0.5 * frame.height;
    into.minX = Math.min(into.minX, px);
    into.maxX = Math.max(into.maxX, px);
    into.minY = Math.min(into.minY, py);
    into.maxY = Math.max(into.maxY, py);
  }
}

function regionOf(b: PixelBounds, { width, height }: CanvasFrameTarget): TexelRegion {
  if (b.minX > b.maxX) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.max(0, Math.floor(b.minX) - REGION_PAD);
  const bottom = Math.max(0, Math.floor(b.minY) - REGION_PAD);
  const right = Math.min(width, Math.ceil(b.maxX) + REGION_PAD);
  const top = Math.min(height, Math.ceil(b.maxY) + REGION_PAD);
  return { x: left, y: bottom, width: Math.max(0, right - left), height: Math.max(0, top - bottom) };
}
