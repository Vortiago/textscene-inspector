/**
 * A pass of the sky bake: a shader drawn as one triangle over a render target, each fragment working
 * out its own texel as Godot's compute passes do from the invocation ID.
 */

import * as THREE from 'three';
import { FULL_SCREEN_VERTEX } from '../../r3f/lighting2d/fullScreenQuad.js';

/** The one quad every pass draws over its target. */
const passMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
passMesh.frustumCulled = false;
const passScene = new THREE.Scene().add(passMesh);
const passCamera = new THREE.Camera();

/** A pass for `fragmentShader`, its uniforms `uniformNames`, each empty until the bake sets it. */
export function skyPass(fragmentShader: string, uniformNames: readonly string[]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FULL_SCREEN_VERTEX,
    fragmentShader,
    uniforms: Object.fromEntries(uniformNames.map((name) => [name, { value: null }])),
    depthTest: false,
    depthWrite: false,
  });
}

export function setUniforms(pass: THREE.ShaderMaterial, values: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(values)) {
    const uniform = pass.uniforms[name];
    if (!uniform) throw new Error(`expected a uniform of the pass, got ${name}`);
    uniform.value = value;
  }
}

/** Lets go of the textures `pass` reads, as a pass outlives the bake that set them. */
export function releaseTextures(pass: THREE.ShaderMaterial): void {
  for (const uniform of Object.values(pass.uniforms)) {
    if (uniform.value instanceof THREE.Texture) uniform.value = null;
  }
}

/** Draws `pass` into `face` and `mip` of `target`. */
export function draw(
  gl: THREE.WebGLRenderer,
  pass: THREE.ShaderMaterial,
  target: THREE.WebGLRenderTarget,
  face = 0,
  mip = 0
): void {
  passMesh.material = pass;
  gl.setRenderTarget(target, face, mip);
  gl.render(passScene, passCamera);
}
