/**
 * The full-screen quad that writes `S`'s starting value, which the pass swaps per pass. A quad,
 * not a clear colour, so the seed skips colour management on its way into a `NoColorSpace` target
 * and the renderer's global clear state stays untouched.
 */

import * as THREE from 'three';
import { LIGHT_SEED_LAYER, SEED_RENDER_ORDER } from './lightPassLayers.js';
import { FULL_SCREEN_VERTEX, FullScreenQuad } from './fullScreenQuad.js';

const SEED_FRAGMENT = /* glsl */ `
uniform vec3 uSeed;
void main() {
  // rgb: where Godot's base pass leaves the item, with the albedo divided out.
  // alpha: no light has been counted yet.
  gl_FragColor = vec4(uSeed, 0.0);
}
`;

export function createSeedMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FULL_SCREEN_VERTEX,
    fragmentShader: SEED_FRAGMENT,
    uniforms: { uSeed: { value: new THREE.Vector3(1, 1, 1) } },
    // NoBlending, so the quad overwrites: it is the clear. `transparent` puts it in the light
    // quads' sorted list, so `renderOrder` places it beneath them.
    blending: THREE.NoBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/** Writes `S`'s starting value over the whole accumulator, under every light. */
export function LightAccumulatorSeed({ material }: { material: THREE.ShaderMaterial }) {
  return <FullScreenQuad layer={LIGHT_SEED_LAYER} material={material} renderOrder={SEED_RENDER_ORDER} />;
}
