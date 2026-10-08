/**
 * The pre-pass: for each item light list, show only the meshes of the lights on it and let the
 * mounted tree draw itself into that list's accumulators. Each list takes up to three passes:
 * `CanvasLighting2D.tsx` says why.
 */

import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Camera } from '@react-three/fiber';
import { LIGHT_PASS_LAYER } from './lightPassLayers.js';
import { drawsInPass, type LightListEntry, type PassKind, type PassMeshRole } from './itemLightList.js';
import { listWindow, windowScissor } from './lightListWindow.js';
import type { Rect2 } from '../../godot/rect2.js';

/** One light mesh the pass shows or hides per list. */
export interface PassMesh {
  readonly mesh: THREE.Object3D;
  readonly ordinal: number;
  readonly role: PassMeshRole;
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
}

export interface LightAccumulationPass {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  lists: readonly AccumulationList[];
  /** Every registered light mesh. Read each frame, so a mesh mounted since the last render counts. */
  passMeshes: ReadonlySet<PassMesh>;
  /** The seed quad's material; its `uSeed` uniform is rewritten per pass. */
  seedMaterial: THREE.ShaderMaterial;
  /** The canvas tint `S` starts from for an ordinary item. */
  canvasModulate: { r: number; g: number; b: number };
  /** The published resolution vector, mutated in place each frame. */
  resolution: THREE.Vector2;
  /** The world rect each capped placement's items cover (`ItemLightCap.windows`). */
  windows: ReadonlyMap<string, Rect2>;
}

/**
 * Sizes `list`'s buffers to the drawing buffer and clips them to its window, or lets them draw
 * whole where it has none. Clipped after the resize, which resets a target's scissor.
 */
function fitListTargets(
  list: AccumulationList,
  windows: ReadonlyMap<string, Rect2>,
  camera: Camera,
  size: THREE.Vector2
): void {
  const window = listWindow(list.placementIds, windows);
  const scissor = window ? windowScissor(window, camera, size) : null;
  for (const target of [list.target, list.lightOnlyTarget, list.shadowTintTarget]) {
    if (!target) continue;
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    target.scissorTest = scissor !== null;
    if (scissor) target.scissor.copy(scissor);
  }
}

function showListMeshes(passMeshes: ReadonlySet<PassMesh>, list: AccumulationList, kind: PassKind): void {
  for (const { mesh, ordinal, role } of passMeshes) {
    mesh.visible = drawsInPass(list.entries.get(ordinal), role, kind);
  }
}

/** Draws every list's buffers once: a frame's work. */
function renderLightLists({
  gl,
  scene,
  camera,
  lists,
  passMeshes,
  seedMaterial,
  canvasModulate,
  resolution,
  windows,
}: LightAccumulationPass): void {
  if (lists.length === 0) return;
  // The targets and the lookup are all in device pixels, because that is what `gl_FragCoord` is
  // measured in. Sizing from the CSS size instead reads the buffer at the wrong scale on any
  // display where dpr is not 1.
  gl.getDrawingBufferSize(resolution);
  const previousTarget = gl.getRenderTarget();
  const previousMask = camera.layers.mask;
  const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;

  const render = (target: THREE.WebGLRenderTarget, seedRgb: readonly [number, number, number]) => {
    seed.set(seedRgb[0], seedRgb[1], seedRgb[2]);
    gl.setRenderTarget(target);
    // One clear per pass, not per light: each light stamps its own ref, so last frame's stamps
    // are the only ones that could be mistaken for this frame's. Leaving them would make a light
    // that has stopped casting keep the hole it cut.
    gl.clear(false, false, true);
    gl.render(scene, camera);
  };

  // `finally`, as in the SubViewport pass: a throw out of `gl.render` (a link failure, a lost
  // context) would leave the renderer on an accumulation buffer with most layers masked, and
  // r3f's main render would draw the scene into it: a black canvas, not one broken light.
  try {
    camera.layers.set(LIGHT_PASS_LAYER);
    for (const list of lists) {
      fitListTargets(list, windows, camera, resolution);
      showListMeshes(passMeshes, list, 'light');
      render(list.target, [canvasModulate.r, canvasModulate.g, canvasModulate.b]);
      // Light Only skips `color *= canvas_modulation`, so its accumulation is the same lights
      // over an unmodulated seed.
      if (list.lightOnlyTarget) render(list.lightOnlyTarget, [1, 1, 1]);
      if (!list.shadowTintTarget) continue;
      // `light_shadow_compute` runs after `light_color.rgb *= base_color.rgb` and its `mix`
      // overwrites rgb, so the tint is albedo-free: Godot 4.6.3 adds the same 15/255 over 0.25
      // and 0.75 albedo. The black seed zeroes it without touching the renderer's clear colour.
      showListMeshes(passMeshes, list, 'tint');
      render(list.shadowTintTarget, [0, 0, 0]);
    }
  } finally {
    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
  }
}

/**
 * Runs the list pre-passes ahead of R3F's own render. A negative priority runs first and leaves
 * fiber's render in place, which it takes over only for a positive priority.
 */
export function useLightAccumulationPass(pass: LightAccumulationPass): void {
  useFrame(() => renderLightLists(pass), -1);
}
