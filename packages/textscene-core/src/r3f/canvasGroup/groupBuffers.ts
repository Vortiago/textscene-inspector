/**
 * The buffers of the canvas groups: a plain group's starts cleared to transparent, a clipping
 * group's starts as a copy of the canvas drawn so far (`renderer_canvas_render_rd.cpp:812-866`).
 */

import * as THREE from 'three';
import { drawKeyedObjects } from '../canvasKeyWindow';
import { BLACK } from '../../nodes/viewport/renderGate';
import { drawOffscreen } from '../offscreen';
import { copyTexels, wholeTexels } from '../texelCopy';
import { renderToOffscreenTarget } from '../../nodes/viewport/subviewport/offscreenViewport';
import { collects, drawOrderOf, isOwnKey, type DrawStep } from './groupWindow';
import type { TexelRegion } from './groupRegion';
import type { CanvasFrameTarget, CanvasGroupEntry, InertOwner, KeyedScene } from './canvasGroupPass';

/** Runs `draw` with the scene's matrices as they are: only layers change between the buffer draws. */
export function withFrozenMatrices(scene: THREE.Object3D, draw: () => void): void {
  const previous = scene.matrixWorldAutoUpdate;
  // Only layers change between the buffer draws, and `fit` updates each rect it moves.
  scene.matrixWorldAutoUpdate = false;
  try {
    draw();
  } finally {
    scene.matrixWorldAutoUpdate = previous;
  }
}

/**
 * Draws the keys the group's window collects into its buffer, if it reads one. It clears the buffer
 * to transparent black itself: a frame drawn over a kept target turns the render's colour clear off.
 */
export function fillBuffer(
  gl: THREE.WebGLRenderer,
  keyed: KeyedScene,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  { window, buffer }: CanvasGroupEntry,
  frame: CanvasFrameTarget,
  inertOwners: readonly InertOwner[]
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
        for (const step of drawOrderOf((key) => collects(window, key), window.from, window.to, inertOwners))
          drawGroupKeys(gl, { keyed, scene, camera }, window.own, step);
      }),
  });
}

/**
 * Draws the keys `inKeys` admits among the items of the group at `own`. They are the descendants of
 * its canvas item, so the render walks that subtree and not the whole scene. A group with no object
 * of its own draws through the whole scene.
 */
function drawGroupKeys(
  gl: THREE.WebGLRenderer,
  { keyed, scene, camera }: { keyed: KeyedScene; scene: THREE.Object3D; camera: THREE.Camera },
  own: number,
  step: DrawStep
): void {
  const at = keyed.groupAt.get(own);
  const root = at === undefined ? scene : keyed.objects[at]!;
  const range = at === undefined ? undefined : { start: at, end: keyed.ends[at]! };
  drawKeyedObjects(keyed, step, () => gl.render(root, camera), range);
}

function sizeLike(buffer: THREE.WebGLRenderTarget, frame: CanvasFrameTarget): void {
  if (buffer.width !== frame.width || buffer.height !== frame.height)
    buffer.setSize(frame.width, frame.height);
}

/**
 * Starts the clipping group's buffer as the canvas drawn so far, and draws the group's items over
 * it. The owner draws there too in CLIP_AND_DRAW (`renderer_canvas_render_rd.cpp:822-828`), unmasked.
 */
export function fillClipBuffer(
  gl: THREE.WebGLRenderer,
  keyed: KeyedScene,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  { window, buffer, clip }: CanvasGroupEntry,
  frame: CanvasFrameTarget,
  region: TexelRegion,
  inertOwners: readonly InertOwner[]
): void {
  sizeLike(buffer!, frame);
  // The mask reads the buffer only under the owner, so the copy and the draws stay in the region.
  buffer!.scissor.set(region.x, region.y, region.width, region.height);
  buffer!.scissorTest = true;
  drawOffscreen(gl, () => copyTexels(gl, frame.texture, buffer!, wholeTexels(frame.width, frame.height)));
  // The owner draws before every child, behind-parent children included
  // (`renderer_canvas_render_rd.cpp:822-828` queues it ahead of the group's items).
  const drawKeys = (step: DrawStep) =>
    drawOffscreen(gl, () => drawGroupKeys(gl, { keyed, scene, camera }, window.own, step));
  renderToOffscreenTarget(gl, {
    target: buffer!,
    clearColor: BLACK,
    transparentBg: true,
    keepsColor: true,
    draw: () => {
      // The copy holds no depth, and the last frame's depth would cull this frame's items.
      gl.clear(false, true, false);
      if (clip!.mode === 'clipAndDraw')
        drawKeys({ from: window.own, to: window.own + 1, admits: (key) => isOwnKey(window, key) });
      for (const step of drawOrderOf((key) => collects(window, key), window.from, window.to, inertOwners))
        drawKeys(step);
    },
  });
}
