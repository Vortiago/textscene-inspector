/**
 * The CanvasGroup pass of one canvas: each group draws the items in its key window into a buffer of
 * its own, and the canvas frame draws every other item and the group's composite rect. Godot draws
 * a group's items into the render target's back buffer, cleared to transparent, and then the
 * group's rect over it (`renderer_canvas_render_rd.cpp:812-866`).
 */

import * as THREE from 'three';
import { canvasKeyOf, drawKeyedObjects } from '../canvasKeyWindow';
import type { CanvasRunKeys } from '../canvasItemState';
import { isNodeIcon } from '../editorHelpers';
import { drawableLocalBox, isDrawable, type Drawable } from '../drawable';
import { BLACK } from '../../nodes/viewport/renderGate';
import { drawOffscreen } from '../offscreen';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { renderToOffscreenTarget } from '../../nodes/viewport/subviewport/offscreenViewport';
import { clipOfCamera } from '../../nodes/viewport/subviewport/viewportLightPassHost';
import type { CanvasClip } from '../lighting2d/lightPassHost';

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
   * `nested` in another group's window. `frameClip` is the clip the frame's camera shows, null for
   * a camera with no ortho view. Answers the rect an enclosing group merges, or null when the group
   * draws nothing.
   */
  fit(drawn: readonly THREE.Box3[], nested: boolean, frameClip: CanvasClip | null): THREE.Box3 | null;
}

/** The mounted groups of one scene, and how they nest. */
interface SceneGroups {
  /** Written only by `registerCanvasGroup`. */
  readonly entries: Set<CanvasGroupEntry>;
  /** Written by `nestingOf` on the first frame after a change. `registerCanvasGroup` clears it. */
  nesting: GroupNesting | null;
}

const groupsOf = perObject((_scene: THREE.Object3D): SceneGroups => ({ entries: new Set(), nesting: null }));

/** Adds `entry` to the pass of the canvas `scene` draws, and answers the call that withdraws it. */
export function registerCanvasGroup(scene: THREE.Object3D, entry: CanvasGroupEntry): () => void {
  const groups = groupsOf(scene);
  groups.entries.add(entry);
  groups.nesting = null;
  return () => {
    groups.entries.delete(entry);
    groups.nesting = null;
  };
}

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

/** Whether `key` is one of the keys the window collects. */
function collects({ own, from, to }: CanvasGroupWindow, key: number): boolean {
  return key >= from && key < to && key !== own;
}

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
  if (groups.entries.size === 0) {
    draw();
    return;
  }
  scene.updateMatrixWorld();
  const nesting = nestingOf(groups);
  const keyed = keyedScene(scene);
  const drawing = fitGroups(
    nesting,
    drawnBoxes(keyed, camera, nesting.innermostFirst),
    frameClipOf(camera, frame)
  );
  const { outermost } = nesting;
  const previousAutoUpdate = scene.matrixWorldAutoUpdate;
  beginStep(gl, 'Canvas groups');
  try {
    // Only layers change between the buffer draws, and `fit` updates each rect it moves.
    scene.matrixWorldAutoUpdate = false;
    for (const group of outermost) if (drawing.has(group)) fillBuffer(gl, keyed, scene, camera, group, frame);
  } finally {
    scene.matrixWorldAutoUpdate = previousAutoUpdate;
    endStep(gl, 'Canvas groups');
  }
  drawKeyedObjects(
    keyed.objects,
    keyed.keys,
    (key) => !outermost.some((group) => collects(group.window, key)),
    draw
  );
}

/** The clip an ortho camera shows over a frame of `width` x `height` pixels. */
function frameClipOf(
  camera: THREE.Camera,
  { width, height }: { width: number; height: number }
): CanvasClip | null {
  const ortho = camera as THREE.OrthographicCamera;
  return ortho.isOrthographicCamera ? clipOfCamera(ortho, { x: width, y: height }) : null;
}

/** How the mounted groups of one scene nest. Stable while no group mounts or unmounts. */
interface GroupNesting {
  /** Every group, the innermost first, so an enclosing group merges the rect of each group inside it. */
  innermostFirst: CanvasGroupEntry[];
  /** The groups whose window collects each group's own key. */
  enclosing: ReadonlyMap<CanvasGroupEntry, readonly CanvasGroupEntry[]>;
  /** The groups inside no other group's window, whose items the frame leaves out. */
  outermost: CanvasGroupEntry[];
}

function nestingOf(groups: SceneGroups): GroupNesting {
  if (groups.nesting) return groups.nesting;
  const entries = [...groups.entries];
  const enclosing = new Map(
    entries.map((inner) => [
      inner,
      entries.filter((group) => group !== inner && collects(group.window, inner.window.own)),
    ])
  );
  const around = (group: CanvasGroupEntry) => enclosing.get(group)!;
  const nesting = {
    innermostFirst: entries.sort((a, b) => around(b).length - around(a).length),
    enclosing,
    outermost: entries.filter((group) => around(group).length === 0),
  };
  groups.nesting = nesting;
  return nesting;
}

/** Fits every group, the innermost first, and answers the groups whose `fit` answered a rect. */
function fitGroups(
  { innermostFirst, enclosing }: GroupNesting,
  drawn: ReadonlyMap<CanvasGroupEntry, THREE.Box3[]>,
  frameClip: CanvasClip | null
): ReadonlySet<CanvasGroupEntry> {
  const drawing = new Set<CanvasGroupEntry>();
  for (const group of innermostFirst) {
    const around = enclosing.get(group)!;
    const rect = group.fit(drawn.get(group)!, around.length > 0, frameClip);
    if (!rect) continue;
    drawing.add(group);
    for (const outer of around) drawn.get(outer)!.push(rect);
  }
  return drawing;
}

/**
 * Every object of a scene with its paint-order key, from one walk a frame. `measured` marks the
 * objects whose box a group lists: visible, and under no node icon or group rect.
 */
interface KeyedScene {
  objects: THREE.Object3D[];
  keys: number[];
  measured: boolean[];
}

function keyedScene(scene: THREE.Object3D): KeyedScene {
  const keyed: KeyedScene = { objects: [], keys: [], measured: [] };
  const visit = (object: THREE.Object3D, inherited: number, isMeasuredBranch: boolean): void => {
    const key = canvasKeyOf(object, inherited);
    const isMeasured =
      isMeasuredBranch && object.visible && !isNodeIcon(object) && !isCanvasGroupRect(object);
    keyed.objects.push(object);
    keyed.keys.push(key);
    keyed.measured.push(isMeasured);
    for (const child of object.children) visit(child, key, isMeasured);
  };
  visit(scene, 0, true);
  return keyed;
}

/**
 * The world box of each mesh `camera` draws, listed under every group whose window collects its
 * key. A node icon sizes itself to the editor camera, so no bounds include it.
 */
function drawnBoxes(
  { objects, keys, measured }: KeyedScene,
  camera: THREE.Camera,
  groups: readonly CanvasGroupEntry[]
): Map<CanvasGroupEntry, THREE.Box3[]> {
  const drawn = new Map(groups.map((group) => [group, [] as THREE.Box3[]]));
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i]!;
    if (!measured[i] || !isDrawable(object) || !camera.layers.test(object.layers)) continue;
    // A loop, not `.filter`: no array per object per frame. The first collecting group measures the box.
    let box: THREE.Box3 | null | undefined;
    for (const group of groups) {
      if (!collects(group.window, keys[i]!)) continue;
      box ??= worldBox(object);
      if (!box) break;
      drawn.get(group)!.push(box);
    }
  }
  return drawn;
}

/** Each drawable's world box, reused every frame. Written only by `worldBox`. */
const worldBoxOf = perObject((_object: Drawable) => new THREE.Box3());

/** The bounds of a drawable object's geometry, its instances included, in world space. */
function worldBox(object: Drawable): THREE.Box3 | null {
  const local = drawableLocalBox(object);
  return local.isEmpty() ? null : worldBoxOf(object).copy(local).applyMatrix4(object.matrixWorld);
}

/**
 * Draws the keys the group's window collects into its buffer, if it reads one. It clears the buffer
 * to transparent black itself: a frame drawn over a kept target turns the render's colour clear off.
 */
function fillBuffer(
  gl: THREE.WebGLRenderer,
  keyed: KeyedScene,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  { window, buffer }: CanvasGroupEntry,
  frame: { width: number; height: number }
): void {
  if (!buffer) return;
  if (buffer.width !== frame.width || buffer.height !== frame.height)
    buffer.setSize(frame.width, frame.height);
  renderToOffscreenTarget(gl, {
    target: buffer,
    clearColor: BLACK,
    transparentBg: true,
    draw: () =>
      drawOffscreen(gl, () => {
        gl.clear(true, true, true);
        drawKeyedObjects(
          keyed.objects,
          keyed.keys,
          (key) => collects(window, key),
          () => gl.render(scene, camera)
        );
      }),
  });
}
