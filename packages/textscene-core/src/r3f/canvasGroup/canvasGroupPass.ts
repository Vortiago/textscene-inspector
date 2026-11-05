/**
 * The CanvasGroup pass of one canvas: each group draws the items in its key window into a buffer of
 * its own, and the canvas frame draws every other item and the group's composite rect. Godot draws
 * a group's items into the render target's back buffer, cleared to transparent, and then the
 * group's rect over it (`renderer_canvas_render_rd.cpp:812-866`).
 */

import * as THREE from 'three';
import { canvasKeyOf, drawCanvasKeys } from '../canvasKeyWindow';
import type { CanvasRunKeys } from '../canvasItemState';
import { isNodeIcon } from '../editorHelpers';
import { drawOffscreen } from '../offscreen';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { renderToOffscreenTarget } from '../../nodes/viewport/subviewport/offscreenViewport';

/**
 * The draw-order keys a group collects: its run's `[from, to)` without `own`, its own key, which its
 * rect draws at. A group culls every child before itself (`renderer_canvas_cull.cpp:471-484`).
 */
export type CanvasGroupWindow = CanvasRunKeys;

/** What a mounted group hands the pass of its canvas. */
export interface CanvasGroupEntry {
  readonly window: CanvasGroupWindow;
  /** The target the group's items draw into while its rect reads it, or null while it does not. */
  readonly buffer: THREE.WebGLRenderTarget | null;
  /**
   * Fits the group's rect over `drawn`, the world boxes of its drawn items, and draws it plain when
   * `nested` in another group's window. Answers the rect an enclosing group merges, or null when
   * the group draws nothing.
   */
  fit(drawn: readonly THREE.Box3[], nested: boolean): THREE.Box3 | null;
}

/** The mounted groups of each scene, written only by `registerCanvasGroup`. */
const groupsOf = perObject((_scene: THREE.Object3D) => new Set<CanvasGroupEntry>());

/** Adds `entry` to the pass of the canvas `scene` draws, and answers the call that withdraws it. */
export function registerCanvasGroup(scene: THREE.Object3D, entry: CanvasGroupEntry): () => void {
  const groups = groupsOf(scene);
  groups.add(entry);
  return () => groups.delete(entry);
}

const RECT_KEY = 'tscnCanvasGroupRect';

/**
 * The `userData` of a group's rect mesh. The pass measures no box for it: an enclosing group
 * merges the rect `fit` answers, which Godot grows by the clear margin (`:236`).
 */
export function canvasGroupRectTag(): { tscnCanvasGroupRect: true } {
  return { [RECT_KEY]: true };
}

/** Whether `key` is one of the keys the window collects. */
function collects({ own, from, to }: CanvasGroupWindow, key: number): boolean {
  return key >= from && key < to && key !== own;
}

const TRANSPARENT_BLACK = new THREE.Color(0, 0, 0);

/**
 * Draws the buffers of the groups in `scene`, then `draw`, the frame's own draw of the scene, with
 * each outermost group's items left out. A group inside another's window draws plain into the outer
 * buffer, as Godot's renderer starts no group while one is open (`:812-813`). `frame` is the size
 * of the target `draw` fills, which each buffer takes.
 */
export function drawCanvasGroups(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  frame: { width: number; height: number },
  draw: () => void
): void {
  const groups = groupsOf(scene);
  if (groups.size === 0) {
    draw();
    return;
  }
  scene.updateMatrixWorld();
  const outermost = fitGroups([...groups], drawnBoxes(scene, camera, [...groups]));
  beginStep(gl, 'Canvas groups');
  try {
    for (const group of outermost) {
      if (group.buffer) fillBuffer(gl, scene, camera, group.window, group.buffer, frame);
    }
  } finally {
    endStep(gl, 'Canvas groups');
  }
  drawCanvasKeys(scene, (key) => !outermost.some((group) => collects(group.window, key)), draw);
}

/**
 * Fits every group, the innermost first, so an enclosing group merges the rect of each group inside
 * it, and answers the outermost groups.
 */
function fitGroups(
  groups: readonly CanvasGroupEntry[],
  drawn: ReadonlyMap<CanvasGroupEntry, THREE.Box3[]>
): CanvasGroupEntry[] {
  const enclosing = (inner: CanvasGroupEntry) =>
    groups.filter((group) => group !== inner && collects(group.window, inner.window.own));
  const innermostFirst = [...groups].sort((a, b) => enclosing(b).length - enclosing(a).length);
  for (const group of innermostFirst) {
    const around = enclosing(group);
    const rect = group.fit(drawn.get(group)!, around.length > 0);
    if (rect) for (const outer of around) drawn.get(outer)!.push(rect);
  }
  return groups.filter((group) => enclosing(group).length === 0);
}

/**
 * The world box of each mesh `camera` draws, listed under every group whose window collects its
 * key. A node icon sizes itself to the editor camera, so no bounds include it.
 */
function drawnBoxes(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  groups: readonly CanvasGroupEntry[]
): Map<CanvasGroupEntry, THREE.Box3[]> {
  const drawn = new Map(groups.map((group) => [group, [] as THREE.Box3[]]));
  const visit = (object: THREE.Object3D, inherited: number): void => {
    if (!object.visible || isNodeIcon(object) || object.userData[RECT_KEY]) return;
    const key = canvasKeyOf(object, inherited);
    const box = camera.layers.test(object.layers) ? worldBox(object) : null;
    if (box) {
      for (const group of groups) if (collects(group.window, key)) drawn.get(group)!.push(box);
    }
    for (const child of object.children) visit(child, key);
  };
  visit(scene, 0);
  return drawn;
}

/** The bounds of a drawable object's geometry, its instances included, in world space. */
function worldBox(object: THREE.Object3D): THREE.Box3 | null {
  const drawable = object as THREE.Mesh & {
    boundingBox?: THREE.Box3 | null;
    computeBoundingBox?: () => void;
  };
  if (!drawable.isMesh && !(object as THREE.Line).isLine && !(object as THREE.Points).isPoints) return null;
  // An instanced or skinned mesh bounds its instances or its pose, not its geometry alone.
  if (drawable.boundingBox !== undefined) {
    if (drawable.boundingBox === null) drawable.computeBoundingBox?.();
  } else if (drawable.geometry.boundingBox === null) {
    drawable.geometry.computeBoundingBox();
  }
  const local = drawable.boundingBox ?? drawable.geometry.boundingBox;
  if (!local || local.isEmpty()) return null;
  return local.clone().applyMatrix4(object.matrixWorld);
}

/**
 * Draws the keys `window` collects into `buffer`, which it clears to transparent black first
 * itself: a frame drawn over a kept target turns the render's colour clear off.
 */
function fillBuffer(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  window: CanvasGroupWindow,
  buffer: THREE.WebGLRenderTarget,
  frame: { width: number; height: number }
): void {
  if (buffer.width !== frame.width || buffer.height !== frame.height)
    buffer.setSize(frame.width, frame.height);
  renderToOffscreenTarget(gl, {
    target: buffer,
    clearColor: TRANSPARENT_BLACK,
    transparentBg: true,
    draw: () =>
      drawOffscreen(gl, () => {
        gl.clear(true, true, true);
        drawCanvasKeys(
          scene,
          (key) => collects(window, key),
          () => gl.render(scene, camera)
        );
      }),
  });
}
