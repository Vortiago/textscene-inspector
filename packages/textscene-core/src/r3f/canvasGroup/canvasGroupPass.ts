/**
 * The canvas group pass of one canvas: each group draws the items in its key window into its own
 * buffer, and the frame draws every other item and the composite rect (`renderer_canvas_render_rd.cpp:812-866`).
 * A clipping group starts its buffer as a copy of the canvas drawn so far, and its owner is the mask.
 */

import * as THREE from 'three';
import { drawKeyedObjects } from '../canvasKeyWindow';
import { drawOffscreen } from '../offscreen';
import { perObject } from '../../utils/perObject';
import { beginStep, endStep } from '../frameProfile/frameProfile';
import { clipOfCamera } from '../../nodes/viewport/subviewport/viewportLightPassHost';
import type { CanvasClip } from '../lighting2d/lightPassHost';
import { collects, drawOrderOf, isOwnKey, sortedByWindow, windowIndexAt } from './groupWindow';
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
  const keyed = keyedScene(scene, camera, keyIsInWindowSpan(groups.entries));
  const nesting = nestingOf(groups, clipGroupsDrawingNothing(groups.entries, keyed));
  const drawn = drawnBoxes(keyed, nesting.innermostFirst);
  const drawing = fitGroups(nesting, drawn, frameClipOf(camera, frame));
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
      drawFrame({ gl, scene, camera, frame, keyed, drawn, draw, inertOwners }, clipping, isFrameKey)
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

/**
 * Draws the frame's keys `isFrameKey` admits. Each clipping group, in window order, splits it: the
 * keys before the group draw, then the group fills its buffer, and the keys from the group on draw.
 */
function drawFrame(
  { gl, scene, camera, frame, keyed, drawn, draw, inertOwners }: FrameDraw,
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
  const regions = clipping.length > 0 ? clipRegions(keyed, drawn, camera, frame, clipping) : [];
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
