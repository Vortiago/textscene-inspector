/**
 * The pre-pass: for each item light list, show only the meshes of the lights on it and let the
 * mounted tree draw itself into that list's accumulators. Each list takes up to three passes:
 * `CanvasLightPass.tsx` says why.
 */

import type * as THREE from 'three';
import { LIGHT_PASS_LAYER } from './lightPassLayers.js';
import { drawsInPass, type LightListEntry, type PassKind, type PassMeshRole } from './itemLightList.js';
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
 * from a black seed, so the item can shade each one (`lightPassContext.ts`).
 */
export interface ApartAccumulation {
  /** The entries in layer order, which is the order Godot applies them. */
  readonly entries: readonly LightListEntry[];
  readonly target: THREE.WebGLArrayRenderTarget;
  /** The `shadow_color` layers, or null while no light on the list tints its shadow. */
  readonly shadowTintTarget: THREE.WebGLArrayRenderTarget | null;
}

/** One item light list and its accumulators. */
export interface AccumulationList {
  /** The lights on the list, by ordinal. */
  readonly entries: ReadonlyMap<number, LightListEntry>;
  /** The placements whose items read the list (`placementId`). */
  readonly placementIds: readonly string[];
  /** The ordinary accumulator, always allocated. */
  readonly target: THREE.WebGLRenderTarget;
  /** The unmodulated-seed accumulator, or null when no Light Only item reads the list. */
  readonly lightOnlyTarget: THREE.WebGLRenderTarget | null;
  /** The albedo-free `shadow_color` accumulator, or null. */
  readonly shadowTintTarget: THREE.WebGLRenderTarget | null;
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
  const targets = [
    list.target,
    list.lightOnlyTarget,
    list.shadowTintTarget,
    list.apart?.target,
    list.apart?.shadowTintTarget,
  ];
  for (const target of targets) {
    if (!target) continue;
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y, target.depth);
    target.scissorTest = scissor !== null;
    if (scissor) target.scissor.copy(scissor);
  }
}

function showListMeshes(passMeshes: ReadonlySet<PassMesh>, list: AccumulationList, kind: PassKind): void {
  for (const { mesh, ordinal, role } of passMeshes) {
    mesh.visible = drawsInPass(list.entries.get(ordinal), role, kind);
  }
}

function showLightMeshes(passMeshes: ReadonlySet<PassMesh>, entry: LightListEntry, kind: PassKind): void {
  for (const { mesh, ordinal, role } of passMeshes) {
    mesh.visible = drawsInPass(ordinal === entry.ordinal ? entry : undefined, role, kind);
  }
}

const BLACK = [0, 0, 0] as const;

type RenderPass = (
  target: THREE.WebGLRenderTarget,
  seedRgb: readonly [number, number, number],
  layer: number
) => void;

/** Each light alone, from black: its layer then holds only its own `light_color` and alpha. */
function renderLightsApart(apart: ApartAccumulation, passMeshes: ReadonlySet<PassMesh>, render: RenderPass) {
  apart.entries.forEach((entry, layer) => {
    showLightMeshes(passMeshes, entry, 'light');
    render(apart.target, BLACK, layer);
    if (!apart.shadowTintTarget) return;
    showLightMeshes(passMeshes, entry, 'tint');
    render(apart.shadowTintTarget, BLACK, layer);
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
  const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;

  const render = (target: THREE.WebGLRenderTarget, seedRgb: readonly [number, number, number], layer = 0) => {
    seed.set(seedRgb[0], seedRgb[1], seedRgb[2]);
    gl.setRenderTarget(target, layer);
    // One clear per pass, not per light: each light stamps its own ref, so last frame's stamps
    // are the only ones that could be mistaken for this frame's. Leaving them would make a light
    // that has stopped casting keep the hole it cut.
    gl.clear(false, false, true);
    gl.render(scene, camera);
  };

  // `finally`, as in the SubViewport pass: a throw out of `gl.render` (a link failure, a lost
  // context) would leave the renderer on an accumulation buffer with most layers masked, and
  // r3f's main render would draw the scene into it: a black canvas, not one broken light.
  beginStep(gl, '2D lights');
  try {
    camera.layers.set(LIGHT_PASS_LAYER);
    for (const list of lists) {
      fitListTargets(list, windows, camera, resolution);
      showListMeshes(passMeshes, list, 'light');
      render(list.target, [canvasModulate.r, canvasModulate.g, canvasModulate.b]);
      // Light Only skips `color *= canvas_modulation`, so its accumulation is the same lights
      // over an unmodulated seed.
      if (list.lightOnlyTarget) render(list.lightOnlyTarget, [1, 1, 1]);
      if (list.shadowTintTarget) {
        // `light_shadow_compute` runs after `light_color.rgb *= base_color.rgb` and its `mix`
        // overwrites rgb, so the tint is albedo-free: Godot 4.6.3 adds the same 15/255 over 0.25
        // and 0.75 albedo. The black seed zeroes it without touching the renderer's clear colour.
        showListMeshes(passMeshes, list, 'tint');
        render(list.shadowTintTarget, BLACK);
      }
      if (list.apart) renderLightsApart(list.apart, passMeshes, render);
    }
  } finally {
    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
    endStep(gl, '2D lights');
  }
}
