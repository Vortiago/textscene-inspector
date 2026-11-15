/**
 * The scene as the pass reads it: each object with its paint-order key and its world box, from one
 * walk a frame, and the boxes each group drew.
 */

import * as THREE from 'three';
import { canvasKeyOf, type KeyedObjects } from '../canvasKeyWindow';
import { isNodeIcon } from '../editorHelpers';
import { isDrawable } from '../drawable';
import { collects } from './groupWindow';
import { worldBox } from './groupRegion';
import type { CanvasGroupEntry } from './groupEntries';

const RECT_KEY = 'tscnCanvasGroupRect';

/**
 * The `userData` of a group's rect mesh. The pass measures no box for it: an enclosing group
 * merges the rect `fit` answers, which Godot grows by the clear margin (`:236`).
 */
export function canvasGroupRectTag(): { tscnCanvasGroupRect: true } {
  return { [RECT_KEY]: true };
}

/** Whether `object` is a group's rect mesh, tagged by `canvasGroupRectTag`. */
function isCanvasGroupRect(object: THREE.Object3D): boolean {
  return object.userData[RECT_KEY] === true;
}

/** Whether a key lies in the span from the first window to the last, which holds every group's items. */
export function keyIsInWindowSpan(entries: ReadonlySet<CanvasGroupEntry>): (key: number) => boolean {
  let first = Infinity;
  let last = -Infinity;
  for (const { window } of entries) {
    first = Math.min(first, window.own, window.from);
    last = Math.max(last, window.to);
  }
  return (key) => key >= first && key < last;
}

/** Every object of a scene with its paint-order key, from one walk a frame. */
export interface KeyedScene extends KeyedObjects {
  objects: THREE.Object3D[];
  keys: number[];
  /**
   * The world box of each mesh `camera` draws that is visible and under no node icon or group rect,
   * so a group lists it. Null for any other object, and for one with a key outside the span of the windows.
   */
  boxes: (THREE.Box3 | null)[];
  ends: number[];
  minKeys: number[];
  maxKeys: number[];
  /** The index of the first Group drawn at each key, which is the object of a canvas item. */
  groupAt: Map<number, number>;
}

export function keyedScene(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  isGrouped: (key: number) => boolean
): KeyedScene {
  const keyed: KeyedScene = {
    objects: [],
    keys: [],
    boxes: [],
    ends: [],
    minKeys: [],
    maxKeys: [],
    groupAt: new Map(),
  };
  const visit = (object: THREE.Object3D, inherited: number, isMeasuredBranch: boolean): void => {
    const key = canvasKeyOf(object, inherited);
    const isMeasured =
      isMeasuredBranch && object.visible && !isNodeIcon(object) && !isCanvasGroupRect(object);
    const index = keyed.objects.length;
    keyed.objects.push(object);
    keyed.keys.push(key);
    keyed.boxes.push(
      isMeasured && isDrawable(object) && isGrouped(key) && camera.layers.test(object.layers)
        ? worldBox(object)
        : null
    );
    keyed.ends.push(index + 1);
    keyed.minKeys.push(key);
    keyed.maxKeys.push(key);
    if (object instanceof THREE.Group && !keyed.groupAt.has(key)) keyed.groupAt.set(key, index);
    for (const child of object.children) visit(child, key, isMeasured);
    keyed.ends[index] = keyed.objects.length;
    for (let i = index + 1; i < keyed.ends[index]!; i = keyed.ends[i]!) {
      keyed.minKeys[index] = Math.min(keyed.minKeys[index]!, keyed.minKeys[i]!);
      keyed.maxKeys[index] = Math.max(keyed.maxKeys[index]!, keyed.maxKeys[i]!);
    }
  };
  visit(scene, 0, true);
  return keyed;
}

/**
 * The world box of each mesh `camera` draws, listed under every group whose window collects its
 * key. A node icon sizes itself to the editor camera, so no bounds include it.
 */
export function drawnBoxes(
  { keys, boxes }: KeyedScene,
  groups: readonly CanvasGroupEntry[]
): Map<CanvasGroupEntry, THREE.Box3[]> {
  const drawn = new Map(groups.map((group) => [group, [] as THREE.Box3[]]));
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box) continue;
    // A loop, not `.filter`: no array per object per frame.
    for (const group of groups) if (collects(group.window, keys[i]!)) drawn.get(group)!.push(box);
  }
  return drawn;
}
