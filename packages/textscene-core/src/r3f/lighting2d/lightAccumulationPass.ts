/**
 * The pre-pass: for each item light list, show only the meshes of the lights on it and let the
 * mounted tree draw itself into that list's accumulators. A list takes one pass over its summed
 * buffers and one per light kept apart: `CanvasLightPass.tsx` says why.
 */

import type * as THREE from 'three';
import { LIGHT_PASS_LAYER } from './lightPassLayers.js';
import {
  drawsInPass,
  type ApartLightPlan,
  type LightListEntry,
  type ListAttachments,
  type PassMeshRole,
} from './itemLightList.js';
import { listWindow, windowScissor } from './lightListWindow.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';
import type { Rect2 } from '../../godot/math/rect2.js';

/** One light mesh the pass shows or hides per list. */
export interface PassMesh {
  readonly mesh: THREE.Object3D;
  readonly ordinal: number;
  readonly role: PassMeshRole;
}

/**
 * The lights of a list a normal-mapped item reads, each accumulated alone into a layer of its own
 * from a black seed, so the item can shade each one (`lightPassContext.ts`). Attachment 0 holds the
 * light, and attachment 1 the `shadow_color` while any light adds one, at the light's own layer.
 */
interface ApartAccumulation extends ApartLightPlan {
  readonly target: THREE.WebGLArrayRenderTarget;
}

/** The lights of a list summed in order, in one target whose attachments `attachments` places. */
export interface SummedAccumulation {
  readonly target: THREE.WebGLRenderTarget;
  readonly attachments: ListAttachments;
}

/** One item light list and its accumulators. */
export interface AccumulationList {
  /** The lights on the list, by ordinal. */
  readonly entries: ReadonlyMap<number, LightListEntry>;
  /** The placements whose items read the list (`placementId`). */
  readonly placementIds: readonly string[];
  /** The summed buffers, or null when no ordinary or Light Only item reads the list. */
  readonly summed: SummedAccumulation | null;
  /** The lights kept apart, or null while no normal-mapped item reads the list. */
  readonly apart: ApartAccumulation | null;
}

export interface LightAccumulationPass {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  lists: readonly AccumulationList[];
  /** Every registered light mesh. Read each frame, so a mesh mounted since the last render counts. */
  passMeshes: ReadonlySet<PassMesh>;
  /** The seed quad's material; its `uSeed` uniform is rewritten per pass. */
  seedMaterial: THREE.ShaderMaterial;
  /** The canvas tint `S` starts from for an ordinary item. */
  canvasModulate: { r: number; g: number; b: number };
  /** The published resolution vector, mutated in place each frame. */
  resolution: THREE.Vector2;
  /** Writes the size of the buffers into its argument, in device pixels. */
  readBufferSize: (out: THREE.Vector2) => void;
  /** The world rect each capped placement's items cover (`ItemLightCap.windows`). */
  windows: ReadonlyMap<string, Rect2>;
}

/**
 * Sizes `list`'s buffers to the drawing buffer and clips them to its window, or lets them draw
 * whole where it has none. Clipped after the resize, which resets a target's scissor. An array
 * target keeps its layer count.
 */
function fitListTargets(
  list: AccumulationList,
  windows: ReadonlyMap<string, Rect2>,
  camera: THREE.Camera,
  size: THREE.Vector2
): void {
  const window = listWindow(list.placementIds, windows);
  const scissor = window ? windowScissor(window, camera, size) : null;
  for (const target of [list.summed?.target, list.apart?.target]) {
    if (!target) continue;
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y, target.depth);
    target.scissorTest = scissor !== null;
    if (scissor) target.scissor.copy(scissor);
  }
}

function showListMeshes(passMeshes: ReadonlySet<PassMesh>, list: AccumulationList): void {
  for (const { mesh, ordinal, role } of passMeshes) {
    mesh.visible = drawsInPass(list.entries.get(ordinal), role);
  }
}

function showLightMeshes(passMeshes: ReadonlySet<PassMesh>, entry: LightListEntry): void {
  for (const { mesh, ordinal, role } of passMeshes) {
    mesh.visible = drawsInPass(ordinal === entry.ordinal ? entry : undefined, role);
  }
}

const BLACK = [0, 0, 0] as const;
const WHITE = [1, 1, 1] as const;

type RenderPass = (
  target: THREE.WebGLRenderTarget,
  seedRgb: readonly [number, number, number],
  layer: number
) => void;

/** Each light alone, from black: its layer then holds only its own `light_color`, alpha and tint. */
function renderLightsApart(apart: ApartAccumulation, passMeshes: ReadonlySet<PassMesh>, render: RenderPass) {
  apart.entries.forEach((entry, layer) => {
    showLightMeshes(passMeshes, entry);
    render(apart.target, BLACK, layer);
  });
}

/** Draws every list's buffers once: a frame's work. */
export function renderLightLists({
  gl,
  scene,
  camera,
  lists,
  passMeshes,
  seedMaterial,
  canvasModulate,
  resolution,
  readBufferSize,
  windows,
}: LightAccumulationPass): void {
  if (lists.length === 0) return;
  // The targets and the lookup are all in device pixels, because that is what `gl_FragCoord` is
  // measured in. Sizing from the CSS size instead reads the buffer at the wrong scale on any
  // display where dpr is not 1.
  readBufferSize(resolution);
  const previousTarget = gl.getRenderTarget();
  const previousMask = camera.layers.mask;
  const previousAutoUpdate = scene.matrixWorldAutoUpdate;
  const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;

  const render = (target: THREE.WebGLRenderTarget, seedRgb: readonly [number, number, number], layer = 0) => {
    seed.set(seedRgb[0], seedRgb[1], seedRgb[2]);
    gl.setRenderTarget(target, layer);
    gl.render(scene, camera);
    // Only visibility changes between the passes, so the first render's world matrices hold.
    scene.matrixWorldAutoUpdate = false;
  };

  // `finally`, as in the SubViewport pass: a throw out of `gl.render` (a link failure, a lost
  // context) would leave the renderer on an accumulation buffer with most layers masked, and
  // r3f's main render would draw the scene into it: a black canvas, not one broken light.
  beginStep(gl, '2D lights');
  try {
    camera.layers.set(LIGHT_PASS_LAYER);
    for (const list of lists) {
      fitListTargets(list, windows, camera, resolution);
      if (list.summed) {
        showListMeshes(passMeshes, list);
        // An ordinary buffer starts from the canvas modulate. A list only Light Only items read
        // keeps that buffer in attachment 0, which starts from white.
        const { plain } = list.summed.attachments;
        render(
          list.summed.target,
          plain >= 0 ? [canvasModulate.r, canvasModulate.g, canvasModulate.b] : WHITE
        );
      }
      if (list.apart) renderLightsApart(list.apart, passMeshes, render);
    }
  } finally {
    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
    scene.matrixWorldAutoUpdate = previousAutoUpdate;
    endStep(gl, '2D lights');
  }
}
