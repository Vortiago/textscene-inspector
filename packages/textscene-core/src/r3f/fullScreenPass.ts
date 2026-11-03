/**
 * A full-screen pass: a fragment shader drawn as one quad over a render target, each fragment
 * working out its own texel as Godot's compute passes do from the invocation ID.
 */

import * as THREE from 'three';
import { perObject } from '../utils/perObject.js';

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

const quadCamera = new THREE.Camera();

/**
 * The quad a renderer draws every pass with, one per renderer like each pass. Three leaves a
 * dispose listener that closes over the renderer on each geometry and material it draws, so one
 * quad or pass shared by every renderer would keep each renderer that drew it alive.
 */
const quadFor = perObject<THREE.WebGLRenderer, THREE.Mesh>(() => {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  // The quad ignores every matrix, so its bounds say nothing about where it lands.
  quad.frustumCulled = false;
  return quad;
});

/**
 * A pass that overwrites its target with `fragmentShader`, reading `uniforms`.
 *
 * @canonical A full-screen pass
 */
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

/** A full-screen pass whose uniforms are `uniformNames`, each empty until a draw sets it. */
export function namedUniformPass(
  name: string,
  fragmentShader: string,
  uniformNames: readonly string[]
): THREE.ShaderMaterial {
  const uniforms = Object.fromEntries(uniformNames.map((uniform) => [uniform, { value: null }]));
  return fullScreenPass(name, fragmentShader, uniforms);
}

/** Sets each uniform `values` names on `pass`, and throws for a name the pass does not declare. */
export function setUniforms(pass: THREE.ShaderMaterial, values: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(values)) {
    const uniform = pass.uniforms[name];
    if (!uniform) throw new Error(`expected a uniform of the pass, got ${name}`);
    uniform.value = value;
  }
}

/** Lets go of the textures `pass` reads, as a pass outlives the targets a draw set. */
export function releaseTextures(pass: THREE.ShaderMaterial): void {
  for (const uniform of Object.values(pass.uniforms)) {
    if (uniform.value instanceof THREE.Texture) uniform.value = null;
  }
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
 *
 * @canonical A full-screen pass
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
