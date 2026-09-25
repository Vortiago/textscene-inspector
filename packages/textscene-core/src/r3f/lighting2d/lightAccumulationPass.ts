/**
 * The pre-pass: for each class, point the camera at that class's layer and the seed, and let the
 * mounted tree draw itself into that class's accumulators. `CanvasLighting2D.tsx` and
 * `lightPassLayers.ts` say why each class takes up to three passes.
 */

import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Camera } from '@react-three/fiber';
import { LIGHT_LAYER, LIGHT_SEED_LAYER, SHADOW_TINT_LAYER } from './lightPassLayers.js';

export interface LightAccumulationPass {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: Camera;
  /** Per class: the ordinary accumulator, always allocated. */
  targets: readonly THREE.WebGLRenderTarget[];
  /** Per class: the unmodulated-seed accumulator, or absent when no item needs one. */
  lightOnlyTargets: readonly (THREE.WebGLRenderTarget | null | undefined)[];
  /** Per class: the albedo-free `shadow_color` accumulator, or null. */
  shadowTintTargets: readonly (THREE.WebGLRenderTarget | null)[];
  /** The seed quad's material; its `uSeed` uniform is rewritten per pass. */
  seedMaterial: THREE.ShaderMaterial;
  /** The canvas tint `S` starts from for an ordinary item. */
  canvasModulate: { r: number; g: number; b: number };
  /** The published resolution vector, mutated in place each frame. */
  resolution: THREE.Vector2;
}

/**
 * Runs the class pre-passes ahead of R3F's own render. A negative priority runs first and leaves
 * fiber's render in place, which it takes over only for a positive priority.
 */
export function useLightAccumulationPass({
  gl,
  scene,
  camera,
  targets,
  lightOnlyTargets,
  shadowTintTargets,
  seedMaterial,
  canvasModulate,
  resolution,
}: LightAccumulationPass): void {
  const { r, g, b } = canvasModulate;

  useFrame(() => {
    if (targets.length === 0) return;
    // The targets and the lookup are all in device pixels, because that is what
    // `gl_FragCoord` is measured in. Sizing from the CSS size instead reads the
    // buffer at the wrong scale on any display where dpr is not 1.
    gl.getDrawingBufferSize(resolution);
    const previousTarget = gl.getRenderTarget();
    const previousMask = camera.layers.mask;

    const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;
    // `finally`, as in the SubViewport pass: a throw out of `gl.render` (a link failure, a lost
    // context) would leave the renderer on an accumulation buffer with most layers masked, and
    // r3f's main render would draw the scene into it: a black canvas, not one broken light.
    try {
      for (let index = 0; index < targets.length; index += 1) {
        for (const pass of [
          { rt: targets[index], seed: [r, g, b] as const, layer: LIGHT_LAYER + index },
          // Light Only skips `color *= canvas_modulation`, so its accumulation is
          // the same lights over an unmodulated seed.
          { rt: lightOnlyTargets[index], seed: [1, 1, 1] as const, layer: LIGHT_LAYER + index },
          // The albedo-free term. Its layer carries the shadow_color quads and the volume masks,
          // not the cookie quads, so it holds only what a shadowed pixel adds. The black seed
          // zeroes it without touching the renderer's clear colour.
          {
            rt: shadowTintTargets[index],
            seed: [0, 0, 0] as const,
            layer: SHADOW_TINT_LAYER + index,
          },
        ]) {
          if (!pass.rt) continue;
          camera.layers.set(LIGHT_SEED_LAYER);
          camera.layers.enable(pass.layer);
          if (pass.rt.width !== resolution.x || pass.rt.height !== resolution.y) {
            pass.rt.setSize(resolution.x, resolution.y);
          }
          seed.set(pass.seed[0], pass.seed[1], pass.seed[2]);
          gl.setRenderTarget(pass.rt);
          // One clear per pass, not per light: within a pass each light stamps its
          // own ref, so last frame's stamps are the only ones that could be
          // mistaken for this frame's. Leaving them would make a light that has
          // stopped casting keep the hole it cut.
          gl.clear(false, false, true);
          gl.render(scene, camera);
        }
      }
    } finally {
      gl.setRenderTarget(previousTarget);
      camera.layers.mask = previousMask;
    }
  }, -1);
}
