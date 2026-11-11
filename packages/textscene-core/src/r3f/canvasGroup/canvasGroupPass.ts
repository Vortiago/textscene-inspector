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
import { canvasKeyOf, drawKeyedObjects, type KeyedObjects } from '../canvasKeyWindow';
import { isNodeIcon } from '../editorHelpers';
import { isDrawable } from '../drawable';
import { drawOffscreen } from '../offscreen';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { clipOfCamera } from '../../nodes/viewport/subviewport/viewportLightPassHost';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import {
  collects,
  drawOrderOf,
  isOwnKey,
  sortedByWindow,
  windowIndexAt,
  type CanvasGroupWindow,
  type KeySpan,
} from './groupWindow';
import { fillBuffer, fillClipBuffer, withFrozenMatrices } from './groupBuffers';
import { clipRegions, worldBox } from './groupRegion';

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
  /**
   * The keys of the owner's `show_behind_parent` children. They draw first while the owner draws
   * nothing, which leaves it without a group.
   */
  readonly behind: readonly KeySpan[];
}

interface GroupBase {
  readonly window: CanvasGroupWindow;
  /**
   * Fits the group's rect over `drawn`, the world boxes of its drawn items, and draws it plain when
   * `nested` in another group's window. `frameClip` is the clip the frame's camera shows, null for
   * a camera with no ortho view. Answers the rect an enclosing group merges, or null when the group
   * draws nothing.
   */
  fit(drawn: readonly THREE.Box3[], nested: boolean, frameClip: CanvasClip | null): THREE.Box3 | null;
}

/** A CanvasGroup: its items draw into a cleared buffer that its rect composites over the frame. */
export interface CompositeEntry extends GroupBase {
  readonly kind: 'composite';
  /** The target the items draw into while the rect reads it, or null while a material replaces that. */
  readonly buffer: THREE.WebGLRenderTarget | null;
}

/** The owner of `clip_children`: its items draw over a copy of the canvas, and its pixels take the mask. */
export interface ClippingEntry extends GroupBase {
  readonly kind: 'clip';
  readonly clip: CanvasGroupClip;
  readonly buffer: THREE.WebGLRenderTarget;
  /** Whether the owner's shader reads `buffer`. A CanvasItemMaterial on a CLIP_ONLY owner replaces it. */
  readonly readsBuffer: boolean;
}

/** What a mounted group hands the pass of its canvas. */
export type CanvasGroupEntry = CompositeEntry | ClippingEntry;

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
  // The camera sits outside the scene, and the regions read its view before the first render updates it.
  camera.updateMatrixWorld();
  const keyed = keyedScene(scene, camera, keyIsInWindowSpan(groups.entries));
  const nesting = nestingOf(groups, clipGroupsDrawingNothing(groups.entries, keyed));
  const drawing = fitGroups(nesting, drawnBoxes(keyed, nesting.innermostFirst), frameClipOf(camera, frame));
  const { outermost } = nesting;
  const inertOwners = nesting.inert.flatMap((group) =>
    group.kind === 'clip' ? [{ window: group.window, behind: group.clip.behind }] : []
  );
  for (const group of groups.entries) if (group.kind === 'clip') group.clip.setMasking(false);
  const clipping = outermost
    .filter(
      (group): group is ClippingEntry => group.kind === 'clip' && group.readsBuffer && drawing.has(group)
    )
    .sort((a, b) => a.window.from - b.window.from);
  beginStep(gl, 'Canvas groups');
  try {
    for (const group of outermost) {
      if (drawing.has(group) && group.kind === 'composite')
        withFrozenMatrices(scene, () => fillBuffer(gl, keyed, scene, camera, group, frame, inertOwners));
    }
  } finally {
    endStep(gl, 'Canvas groups');
  }
  // A CLIP_ONLY owner with no listed child is skipped (`renderer_canvas_render_rd.cpp:841-843`).
  const skippedOwners = outermost.filter(
    (group) => group.kind === 'clip' && group.clip.mode === 'clipOnly' && !drawing.has(group)
  );
  const isFrameKey = frameKeyTest(outermost, skippedOwners);
  try {
    // The matrices are current from the walk above, so no span of the frame walks them again.
    withFrozenMatrices(scene, () =>
      drawFrame({ gl, scene, camera, frame, keyed, draw, inertOwners }, clipping, isFrameKey)
    );
  } finally {
    // A later draw of the scene, or a draw that threw, must not find an owner still masked.
    for (const group of clipping) group.clip.setMasking(false);
  }
}

/**
 * Whether the frame draws a key: not one a group collects, nor the slot of a CLIP_ONLY owner that
 * is skipped. The windows of the outermost groups do not overlap, so a search finds the group of a key.
 */
function frameKeyTest(
  outermost: readonly CanvasGroupEntry[],
  skippedOwners: readonly CanvasGroupEntry[]
): (key: number) => boolean {
  const windows = sortedByWindow(outermost);
  const skipped = new Set(skippedOwners);
  return (key) => {
    const at = windowIndexAt(windows, key);
    if (at < 0) return true;
    const group = windows[at]!;
    return !collects(group.window, key) && !(skipped.has(group) && isOwnKey(group.window, key));
  };
}

/** A clipping owner that draws nothing, with the keys of its behind-parent children. */
export interface InertOwner {
  readonly window: CanvasGroupWindow;
  readonly behind: readonly KeySpan[];
}

/** What `drawFrame` draws through: the renderer, the scene, its keys and the frame's own draw. */
interface FrameDraw {
  gl: THREE.WebGLRenderer;
  scene: THREE.Object3D;
  camera: THREE.Camera;
  frame: CanvasFrameTarget;
  keyed: KeyedScene;
  draw: () => void;
  inertOwners: readonly InertOwner[];
}

/**
 * Draws the frame's keys `isFrameKey` admits. Each clipping group splits it: the keys before the
 * group draw, the frame is copied into the group's buffer and the group's items draw over the
 * copy, and the keys from the group on draw after, the masked owner among them. `clipping` is
 * ordered by window.
 */
function drawFrame(
  { gl, scene, camera, frame, keyed, draw, inertOwners }: FrameDraw,
  clipping: readonly ClippingEntry[],
  isFrameKey: (key: number) => boolean
): void {
  const frameTarget = gl.getRenderTarget();
  let spanFrom = Number.NEGATIVE_INFINITY;
  let isFirstSpan = true;
  // An inert owner draws its behind children once, in the span its window starts in.
  const emitted: InertOwner[] = [];
  const isNotEmitted = (key: number) =>
    isFrameKey(key) &&
    !emitted.some((owner) => owner.behind.some((span) => key >= span.from && key < span.to));
  const drawSpan = (spanTo: number) => {
    const owners = inertOwners.filter((owner) => owner.window.from >= spanFrom && owner.window.from < spanTo);
    const accept = emitted.length > 0 ? isNotEmitted : isFrameKey;
    for (const step of drawOrderOf(accept, spanFrom, spanTo, inertOwners)) {
      // Over the colour already drawn: the first draw is the frame's own, which may clear it.
      const drawOver = isFirstSpan ? draw : () => drawOffscreen(gl, draw);
      gl.setRenderTarget(frameTarget);
      drawKeyedObjects(keyed, step, drawOver);
      isFirstSpan = false;
    }
    emitted.push(...owners.filter((owner) => owner.behind.length > 0));
  };
  const regions = clipping.length > 0 ? clipRegions(keyed, camera, frame, clipping) : [];
  clipping.forEach((group, i) => {
    drawSpan(group.window.from);
    spanFrom = group.window.from;
    fillClipBuffer(gl, keyed, scene, camera, group, frame, regions[i]!, inertOwners);
    group.clip.setMasking(true);
  });
  drawSpan(Number.POSITIVE_INFINITY);
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
  inert: readonly ClippingEntry[];
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
  { keys, boxes }: KeyedScene
): ClippingEntry[] {
  const clipping = [...entries].filter((group): group is ClippingEntry => group.kind === 'clip');
  if (clipping.length === 0) return clipping;
  // The own slots `[own, own + 1)` do not overlap, so a search finds the owner of a key.
  const byOwn = [...clipping].sort((a, b) => a.window.own - b.window.own);
  const draws = new Set<ClippingEntry>();
  for (let i = 0; i < boxes.length && draws.size < byOwn.length; i++) {
    if (!boxes[i]) continue;
    const owner = ownerOfKey(byOwn, keys[i]!);
    if (owner) draws.add(owner);
  }
  return clipping.filter((group) => !draws.has(group));
}

/** The group whose own slot holds `key`, among `byOwn`, which are sorted by `window.own`. */
function ownerOfKey(byOwn: readonly ClippingEntry[], key: number): ClippingEntry | undefined {
  let low = 0;
  let high = byOwn.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const { window } = byOwn[mid]!;
    if (key < window.own) high = mid - 1;
    else if (key >= window.own + 1) low = mid + 1;
    else return byOwn[mid];
  }
  return undefined;
}

/** `nestingOf` over the groups that are not in `inert`, which only a clipping owner with no pixel is. */
function nestingOf(groups: SceneGroups, inert: readonly ClippingEntry[]): GroupNesting {
  const cached = groups.nesting;
  if (cached && cached.inert.length === inert.length && cached.inert.every((group) => inert.includes(group)))
    return cached;
  const entries = [...groups.entries].filter((group) => group.kind === 'composite' || !inert.includes(group));
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

/** Whether a key lies in the span from the first window to the last, which holds every group's items. */
function keyIsInWindowSpan(entries: ReadonlySet<CanvasGroupEntry>): (key: number) => boolean {
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

function keyedScene(
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
function drawnBoxes(
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
