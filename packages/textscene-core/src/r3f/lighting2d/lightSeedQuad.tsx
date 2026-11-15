/**
 * The full-screen quad that writes `S`'s starting value into every attachment of a list's target.
 * A quad, not a clear colour, so the seed skips colour management on its way into a `NoColorSpace`
 * target and the renderer's global clear state stays untouched.
 */

import * as THREE from 'three';
import { LIGHT_PASS_LAYER, SEED_RENDER_ORDER } from './lightPassLayers.js';
import { FULL_SCREEN_VERTEX, multipleTargetPass } from '../fullScreenPass.js';
import { FullScreenQuad } from './fullScreenQuad.js';

/**
 * Attachment 0 takes `uSeed`, which the pass rewrites per list: the canvas modulate, white for a
 * list only Light Only items read, or black for a light kept apart. Attachment 1, `shadow_color`,
 * starts black: the term is albedo-free, and the seed zeroes it without touching the renderer's
 * clear colour. Attachment 2, Light Only, skips `color *= canvas_modulation`, so it starts white.
 */
const SEED_FRAGMENT = /* glsl */ `
uniform vec3 uSeed;
layout(location = 0) out highp vec4 lightSeed;
layout(location = 1) out highp vec4 shadowTintSeed;
layout(location = 2) out highp vec4 lightOnlySeed;
void main() {
  // rgb: where Godot's base pass leaves the item, with the albedo divided out.
  // alpha: no light has been counted yet.
  lightSeed = vec4(uSeed, 0.0);
  shadowTintSeed = vec4(0.0);
  lightOnlySeed = vec4(1.0, 1.0, 1.0, 0.0);
}
`;

export function createSeedMaterial(): THREE.ShaderMaterial {
  return multipleTargetPass(
    new THREE.ShaderMaterial({
      vertexShader: FULL_SCREEN_VERTEX,
      fragmentShader: SEED_FRAGMENT,
      uniforms: { uSeed: { value: new THREE.Vector3(1, 1, 1) } },
      // NoBlending, so the quad overwrites: it is the clear. `transparent` puts it in the light
      // quads' sorted list, so `renderOrder` places it beneath them.
      blending: THREE.NoBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
}

/** Every pass draws the seed, so it stays visible on the light pass layer, which the main render skips. */
function toLightPassLayer(mesh: THREE.Mesh | null): void {
  mesh?.layers.set(LIGHT_PASS_LAYER);
}

/** Writes `S`'s starting value over the whole accumulator, under every light. */
export function LightAccumulatorSeed({ material }: { material: THREE.ShaderMaterial }) {
  return <FullScreenQuad meshRef={toLightPassLayer} material={material} renderOrder={SEED_RENDER_ORDER} />;
}
