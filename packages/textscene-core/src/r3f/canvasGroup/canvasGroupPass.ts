/**
 * The canvas group pass of one canvas: each group draws the items in its key window into its own
 * buffer, and the frame draws every other item and the composite rect (`renderer_canvas_render_rd.cpp:812-866`).
 * A clipping group starts its buffer as a copy of the canvas drawn so far, and its owner is the mask.
 */

import * as THREE from 'three';
import { drawKeyedObjects } from '../canvasKeyWindow';
import { drawOffscreen } from '../offscreen';
import { withScenePose } from '../sceneRenderCamera';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { clipOfCamera } from '../../nodes/viewport/subviewport/viewportLightPassHost';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import {
  collects,
  drawOrderOf,
  isIn,
  isOwnKey,
  sortedByWindow,
  windowIndexAt,
  type DrawStep,
  type KeySpan,
} from './groupWindow';
import { fillBuffer, fillClipBuffer, withFrozenMatrices } from './groupBuffers';
import { clipRegions } from './groupRegion';
import type { CanvasFrameTarget, CanvasGroupEntry, ClippingEntry, InertOwner } from './groupEntries';
import { drawnBoxes, keyedScene, keyIsInWindowSpan, type KeyedScene } from './keyedScene';
import { clipGroupsDrawingNothing, fitGroups, nestingOf, type SceneGroups } from './groupNesting';

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

/**
 * Draws the buffers of the groups in `scene`, then `draw` with each outermost group's items left
 * out. A group inside another's window draws plain (`:812-813`). A clipping group splits `draw`
 * into one run for each span of keys, over what the frame holds.
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
  // A buffer renders the subtree of its group, which fires no hook of the scene, so the pose is held.
  withScenePose(scene, () => drawFittedGroups(gl, scene, camera, frame, draw, groups));
}

/** Fits the groups to the scene as its matrices hold it, then draws their buffers and the frame. */
function drawFittedGroups(
  gl: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  frame: CanvasFrameTarget,
  draw: () => void,
  groups: SceneGroups
): void {
  const keyed = keyedScene(scene, camera, keyIsInWindowSpan(groups.entries));
  const nesting = nestingOf(groups, clipGroupsDrawingNothing(groups.entries, keyed));
  const drawn = drawnBoxes(keyed, nesting.innermostFirst);
  const drawing = fitGroups(nesting, drawn, frameClipOf(camera, frame));
  const { outermost } = nesting;
  const inertOwners = nesting.inert.flatMap((group) =>
    group.kind === 'clip' ? [{ window: group.window, behind: group.clip.behind }] : []
  );
  for (const group of groups.entries) if (group.kind === 'clip') group.clip.stopMasking();
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
      drawFrame({ gl, scene, camera, frame, keyed, drawn, draw, inertOwners }, clipping, isFrameKey)
    );
  } finally {
    // A later draw of the scene, or a draw that threw, must not find an owner still masked.
    for (const group of clipping) group.clip.stopMasking();
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

/** What `drawFrame` draws through: the renderer, the scene, its keys and the frame's own draw. */
interface FrameDraw {
  gl: THREE.WebGLRenderer;
  scene: THREE.Object3D;
  camera: THREE.Camera;
  frame: CanvasFrameTarget;
  keyed: KeyedScene;
  /** The world boxes each group drew, nested group rects included. */
  drawn: ReadonlyMap<CanvasGroupEntry, readonly THREE.Box3[]>;
  draw: () => void;
  inertOwners: readonly InertOwner[];
}

/** A clipping group with the region its buffer covers. */
interface QueuedGroup {
  readonly group: ClippingEntry;
  readonly region: ReturnType<typeof clipRegions>[number];
}

/** The groups of `queue`, which is sorted by window start, whose window starts inside `span`. */
function groupsStartingIn(queue: readonly QueuedGroup[], span: KeySpan): QueuedGroup[] {
  let low = 0;
  let high = queue.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (queue[mid]!.group.window.from < span.from) low = mid + 1;
    else high = mid;
  }
  const starting: QueuedGroup[] = [];
  for (let i = low; i < queue.length && isIn(span, queue[i]!.group.window.from); i++)
    starting.push(queue[i]!);
  return starting;
}

/**
 * Draws the frame's keys `isFrameKey` admits, in the order Godot draws them. A clipping group fills
 * its buffer where its window starts in that order, so its copy holds what Godot has drawn by
 * then, and its owner draws once it masks. `clipping` is sorted by window start.
 */
function drawFrame(
  { gl, scene, camera, frame, keyed, drawn, draw, inertOwners }: FrameDraw,
  clipping: readonly ClippingEntry[],
  isFrameKey: (key: number) => boolean
): void {
  const frameTarget = gl.getRenderTarget();
  const regions = clipping.length > 0 ? clipRegions(keyed, drawn, camera, frame, clipping) : [];
  const queue = clipping.map((group, i) => ({ group, region: regions[i]! }));
  const filled = new Set<QueuedGroup>();
  let isFirstDraw = true;
  const drawPiece = (piece: DrawStep) => {
    // Over the colour already drawn: the first draw is the frame's own, which may clear it.
    const drawOver = isFirstDraw ? draw : () => drawOffscreen(gl, draw);
    gl.setRenderTarget(frameTarget);
    drawKeyedObjects(keyed, piece, drawOver);
    isFirstDraw = false;
  };
  const fill = (entry: QueuedGroup) => {
    fillClipBuffer(gl, keyed, scene, camera, entry.group, frame, entry.region, inertOwners);
    entry.group.clip.startMasking();
    filled.add(entry);
  };
  // The steps cover every key, so each group's window start falls in one of them.
  for (const step of drawOrderOf(isFrameKey, -Infinity, Infinity, inertOwners)) {
    let from = step.from;
    for (const entry of groupsStartingIn(queue, step)) {
      if (filled.has(entry)) continue;
      const at = entry.group.window.from;
      if (from < at || isFirstDraw) drawPiece({ ...step, from, to: at });
      from = at;
      fill(entry);
    }
    drawPiece({ ...step, from });
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
