/**
 * The canvas group pass of one canvas: each group draws the items in its key window into a buffer of
 * its own, and the canvas frame draws every other item and the group's composite rect. Godot draws
 * a group's items into the render target's back buffer, cleared to transparent, and then the
 * group's rect over it (`renderer_canvas_render_rd.cpp:812-866`).
 *
 * A clipping group (`clip_children`) starts its buffer as a copy of the canvas drawn so far instead,
 * and its owner is the mask: it draws over the frame with the buffer's colour and its own alpha.
 */

import * as THREE from 'three';
import { canvasKeyOf, drawKeyedObjects } from '../canvasKeyWindow';
import type { CanvasRunKeys } from '../canvasItemState';
import { isNodeIcon } from '../editorHelpers';
import { drawableLocalBox, isDrawable, type Drawable } from '../drawable';
import { BLACK } from '../../nodes/viewport/renderGate';
import { drawOffscreen } from '../offscreen';
import { copyTexels, wholeTexels } from '../texelCopy';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { renderToOffscreenTarget } from '../../nodes/viewport/subviewport/offscreenViewport';
import { clipOfCamera } from '../../nodes/viewport/subviewport/viewportLightPassHost';
import type { CanvasClip } from '../lighting2d/lightPassHost';

/**
 * The draw-order keys a group collects: its run's `[from, to)` without its own slot, which starts at
 * `own`, the key its rect draws at. A group culls every child before itself
 * (`renderer_canvas_cull.cpp:471-484`).
 */
export type CanvasGroupWindow = CanvasRunKeys;

/**
 * What a clipping group asks of the pass. `clipOnly` leaves the owner out of the buffer, and
 * `clipAndDraw` draws it there too (`renderer_canvas_render_rd.cpp:822-828`).
 */
export interface CanvasGroupClip {
  readonly mode: 'clipOnly' | 'clipAndDraw';
  /**
   * Switches the owner's pixels to the mask: the buffer's colour under the owner's own alpha. The
   * pass turns it on while the frame draws the owner and off at every other draw.
   */
  setMasking(isMasking: boolean): void;
}

/** What a mounted group hands the pass of its canvas. */
export interface CanvasGroupEntry {
  readonly window: CanvasGroupWindow;
  /** The target the group's items draw into while its rect reads it, or null while it does not. */
  readonly buffer: THREE.WebGLRenderTarget | null;
  /** Set for the owner of `clip_children`, absent for a CanvasGroup. */
  readonly clip?: CanvasGroupClip;
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
  /**
   * Written by `nestingOf` on the first frame after a change, or after the set of clipping groups
   * whose owner draws nothing changes. `registerCanvasGroup` clears it.
   */
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

/**
 * Whether `key` is in the slot of the group's own pixels: its key, and the pieces the item draws
 * after it before the next whole key (`canvasSubOrders`).
 */
function isOwnKey({ own }: CanvasGroupWindow, key: number): boolean {
  return key >= own && key < own + 1;
}

/** Whether `key` is one of the keys the window collects. */
function collects(window: CanvasGroupWindow, key: number): boolean {
  return key >= window.from && key < window.to && !isOwnKey(window, key);
}

/** The target `draw` fills: its size is the buffers' size, and its texture is what a clip copies. */
export type CanvasFrameTarget = Pick<THREE.WebGLRenderTarget, 'width' | 'height' | 'texture'>;

/**
 * Draws the buffers of the groups in `scene`, then `draw`, the frame's own draw of the scene, with
 * each outermost group's items left out. A group inside another's window draws plain into the outer
 * buffer, as Godot's renderer starts no group while one is open (`:812-813`). `frame` is the target
 * `draw` fills. A clipping group splits the draw: `draw` runs once for the keys before the group,
 * and again for each later span, over what the frame holds.
 */
export function drawCanvasGroups(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  frame: CanvasFrameTarget,
  draw: () => void
): void {
  const groups = groupsOf(scene);
  if (groups.entries.size === 0) {
    draw();
    return;
  }
  scene.updateMatrixWorld();
  const keyed = keyedScene(scene);
  const nesting = nestingOf(groups, clipGroupsDrawingNothing(groups.entries, keyed, camera));
  const drawing = fitGroups(
    nesting,
    drawnBoxes(keyed, camera, nesting.innermostFirst),
    frameClipOf(camera, frame)
  );
  const { outermost } = nesting;
  for (const group of groups.entries) group.clip?.setMasking(false);
  const clipping = outermost
    .filter((group) => group.clip && group.buffer && drawing.has(group))
    .sort((a, b) => a.window.from - b.window.from);
  beginStep(gl, 'Canvas groups');
  try {
    for (const group of outermost) {
      if (drawing.has(group) && !group.clip)
        withFrozenMatrices(scene, () => fillBuffer(gl, keyed, scene, camera, group, frame));
    }
  } finally {
    endStep(gl, 'Canvas groups');
  }
  // A CLIP_ONLY owner with no listed child is skipped (`renderer_canvas_render_rd.cpp:841-843`).
  const skippedOwners = outermost.filter((group) => group.clip?.mode === 'clipOnly' && !drawing.has(group));
  const isFrameKey = (key: number) =>
    !outermost.some((group) => collects(group.window, key)) &&
    !skippedOwners.some((group) => isOwnKey(group.window, key));
  drawFrame({ gl, scene, camera, frame, keyed, draw }, clipping, isFrameKey);
}

/** What `drawFrame` and `fillClipBuffer` draw through: the renderer, the scene and its keys. */
interface FrameDraw {
  gl: THREE.WebGLRenderer;
  scene: THREE.Object3D;
  camera: THREE.Camera;
  frame: CanvasFrameTarget;
  keyed: KeyedScene;
  draw: () => void;
}

/**
 * Draws the frame's keys `isFrameKey` admits. Each clipping group splits it: the keys before the
 * group draw, the frame is copied into the group's buffer and the group's items draw over the
 * copy, and the keys from the group on draw after, the masked owner among them. `clipping` is
 * ordered by window.
 */
function drawFrame(
  { gl, scene, camera, frame, keyed, draw }: FrameDraw,
  clipping: readonly CanvasGroupEntry[],
  isFrameKey: (key: number) => boolean
): void {
  const frameTarget = gl.getRenderTarget();
  let spanFrom = Number.NEGATIVE_INFINITY;
  let isFirstSpan = true;
  const drawSpan = (spanTo: number) => {
    const inSpan = (key: number) => key >= spanFrom && key < spanTo && isFrameKey(key);
    // Over the colour already drawn: the first span draws as the frame does, which may clear it.
    const drawOver = isFirstSpan ? draw : () => drawOffscreen(gl, draw);
    gl.setRenderTarget(frameTarget);
    drawKeyedObjects(keyed.objects, keyed.keys, inSpan, drawOver);
    isFirstSpan = false;
  };
  for (const group of clipping) {
    drawSpan(group.window.from);
    spanFrom = group.window.from;
    withFrozenMatrices(scene, () => fillClipBuffer(gl, keyed, scene, camera, group, frame));
    group.clip!.setMasking(true);
  }
  drawSpan(Number.POSITIVE_INFINITY);
}

/** Runs `draw` with the scene's matrices as they are: only layers change between the buffer draws. */
function withFrozenMatrices(scene: THREE.Object3D, draw: () => void): void {
  const previous = scene.matrixWorldAutoUpdate;
  // Only layers change between the buffer draws, and `fit` updates each rect it moves.
  scene.matrixWorldAutoUpdate = false;
  try {
    draw();
  } finally {
    scene.matrixWorldAutoUpdate = previous;
  }
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
  /** The groups left out of the nesting: clipping groups whose owner draws nothing. */
  inert: readonly CanvasGroupEntry[];
  /** Every group, the innermost first, so an enclosing group merges the rect of each group inside it. */
  innermostFirst: CanvasGroupEntry[];
  /** The groups whose window collects each group's own key. */
  enclosing: ReadonlyMap<CanvasGroupEntry, readonly CanvasGroupEntry[]>;
  /** The groups inside no other group's window, whose items the frame leaves out. */
  outermost: CanvasGroupEntry[];
}

/**
 * The clipping groups whose owner draws no pixel. Godot attaches no group to an item with no
 * commands (`renderer_canvas_cull.cpp:476`), so its children draw as they would without it.
 */
function clipGroupsDrawingNothing(
  entries: ReadonlySet<CanvasGroupEntry>,
  { objects, keys, measured }: KeyedScene,
  camera: THREE.Camera
): CanvasGroupEntry[] {
  const clipping = [...entries].filter((group) => group.clip);
  if (clipping.length === 0) return clipping;
  const drawsNothing = new Set(clipping);
  for (let i = 0; i < objects.length && drawsNothing.size > 0; i++) {
    const object = objects[i]!;
    if (!measured[i] || !isDrawable(object) || !camera.layers.test(object.layers)) continue;
    if (drawableLocalBox(object).isEmpty()) continue;
    for (const group of clipping) if (isOwnKey(group.window, keys[i]!)) drawsNothing.delete(group);
  }
  return [...drawsNothing];
}

/** `nestingOf` over the groups that are not in `inert`, which only a clipping owner with no pixel is. */
function nestingOf(groups: SceneGroups, inert: readonly CanvasGroupEntry[]): GroupNesting {
  const cached = groups.nesting;
  if (cached && cached.inert.length === inert.length && cached.inert.every((group) => inert.includes(group)))
    return cached;
  const entries = [...groups.entries].filter((group) => !inert.includes(group));
  const enclosing = new Map(
    entries.map((inner) => [
      inner,
      entries.filter((group) => group !== inner && collects(group.window, inner.window.own)),
    ])
  );
  const around = (group: CanvasGroupEntry) => enclosing.get(group)!;
  const nesting = {
    inert,
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
  frame: CanvasFrameTarget
): void {
  if (!buffer) return;
  sizeLike(buffer, frame);
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

function sizeLike(buffer: THREE.WebGLRenderTarget, frame: CanvasFrameTarget): void {
  if (buffer.width !== frame.width || buffer.height !== frame.height)
    buffer.setSize(frame.width, frame.height);
}

/**
 * Starts the clipping group's buffer as the canvas drawn so far, and draws the group's items over
 * it. The owner draws there too in CLIP_AND_DRAW (`renderer_canvas_render_rd.cpp:822-828`), unmasked.
 */
function fillClipBuffer(
  gl: THREE.WebGLRenderer,
  keyed: KeyedScene,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  { window, buffer, clip }: CanvasGroupEntry,
  frame: CanvasFrameTarget
): void {
  sizeLike(buffer!, frame);
  drawOffscreen(gl, () => copyTexels(gl, frame.texture, buffer!, wholeTexels(frame.width, frame.height)));
  clip!.setMasking(false);
  // The owner draws before every child, behind-parent children included
  // (`renderer_canvas_render_rd.cpp:822-828` queues it ahead of the group's items).
  const drawKeys = (inKeys: (key: number) => boolean) =>
    drawOffscreen(gl, () =>
      drawKeyedObjects(keyed.objects, keyed.keys, inKeys, () => gl.render(scene, camera))
    );
  renderToOffscreenTarget(gl, {
    target: buffer!,
    clearColor: BLACK,
    transparentBg: true,
    keepsColor: true,
    draw: () => {
      if (clip!.mode === 'clipAndDraw') drawKeys((key) => isOwnKey(window, key));
      drawKeys((key) => collects(window, key));
    },
  });
}
