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

/**
 * The quad each renderer draws every pass with, written only by `quadFor`. One per renderer, not one
 * for the page: three leaves a dispose listener on a drawn geometry and material that closes over the
 * renderer, so a shared quad would keep every renderer alive. An entry goes with its renderer.
 */
const quads = new WeakMap<THREE.WebGLRenderer, THREE.Mesh>();
const quadCamera = new THREE.Camera();

function quadFor(renderer: THREE.WebGLRenderer): THREE.Mesh {
  const cached = quads.get(renderer);
  if (cached) return cached;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  // The quad ignores every matrix, so its bounds say nothing about where it lands.
  quad.frustumCulled = false;
  quads.set(renderer, quad);
  return quad;
}

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

/**
 * A pass whose `fragmentShader` writes every texel's depth through `gl_FragDepth`, which always
 * passes, so the target takes the pass's depth as it takes its colour.
 */
export function fullScreenDepthPass(
  name: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  const pass = fullScreenPass(name, fragmentShader, uniforms);
  pass.depthTest = true;
  pass.depthFunc = THREE.AlwaysDepth;
  pass.depthWrite = true;
  return pass;
}

/**
 * Draws `pass` into `layer` (a cube face or a 3D slice) and `mip` of `target`. A null `target` is
 * the drawing buffer.
 */
export function drawFullScreen(
  renderer: THREE.WebGLRenderer,
  pass: THREE.ShaderMaterial,
  target: THREE.WebGLRenderTarget | null,
  layer = 0,
  mip = 0
): void {
  const quad = quadFor(renderer);
  quad.material = pass;
  renderer.setRenderTarget(target, layer, mip);
  renderer.render(quad, quadCamera);
}
