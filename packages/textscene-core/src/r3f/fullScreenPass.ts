/**
 * A full-screen pass: a fragment shader drawn as one quad over a render target, each fragment
 * working out its own texel as Godot's compute passes do from the invocation ID.
 */

import * as THREE from 'three';

/**
 * Maps the unit plane onto NDC, and hands the fragment shader the target's uv, 0 to 1, as `vUv`.
 * A shader that needs the NDC position repeats `position.xy * 2.0`.
 */
export const FULL_SCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy + 0.5;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

/** The one quad every pass draws, shared since a draw only lends it the pass's material. */
const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
// The quad ignores every matrix, so its bounds say nothing about where it lands.
quad.frustumCulled = false;
const quadCamera = new THREE.Camera();

/** A pass that overwrites its target with `fragmentShader`, reading `uniforms`. */
export function fullScreenPass(
  name: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name,
    uniforms,
    vertexShader: FULL_SCREEN_VERTEX,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}

/** Draws `pass` into `layer` (a cube face or a 3D slice) and `mip` of `target`. */
export function drawFullScreen(
  renderer: THREE.WebGLRenderer,
  pass: THREE.ShaderMaterial,
  target: THREE.WebGLRenderTarget,
  layer = 0,
  mip = 0
): void {
  quad.material = pass;
  renderer.setRenderTarget(target, layer, mip);
  renderer.render(quad, quadCamera);
}
