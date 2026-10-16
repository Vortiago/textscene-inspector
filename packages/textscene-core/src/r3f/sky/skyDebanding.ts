/**
 * Godot's sky debanding: a sky that debands adds interleaved gradient noise of up to 1/255 to each
 * background pixel, after its fog and ahead of the tone curve (`sky.glsl:141-147`, `:313-315`).
 * The noise follows the pixel's position, so the background reads its viewport before each render.
 */

import * as THREE from 'three';
import type { SkyProperties } from '../../resources/sky/types';
import { applyEdits, installChunkPatch, onChunk } from '../shaderPatch/chunkPatch.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';

const DEBANDING_UNIFORM = 'godotSkyDebanding';

/**
 * Whether Godot adds the noise to this sky. ProceduralSkyMaterial and PhysicalSkyMaterial write
 * `render_mode use_debanding` from their `use_debanding` (`sky_material.cpp:377`, `:819`), and
 * PanoramaSkyMaterial writes no such mode.
 */
export function isDebanded(material: SkyProperties): boolean {
  return material.kind !== 'panorama' && material.use_debanding;
}

/**
 * The noise's strength, 1 or 0, then the viewport's left edge and top edge in framebuffer pixels.
 * Written only by `debandSky`'s observer before each render of a debanded scene, and cleared to 0
 * when that render ends, so a scene without a debanded sky draws none. One array: `cloneUniforms`
 * passes a typed array by reference (three r186 `UniformsUtils.js:28-39`).
 */
const debanding: Float32Array =
  (THREE.ShaderLib.backgroundCube?.uniforms[DEBANDING_UNIFORM]?.value as Float32Array | undefined) ??
  new Float32Array(3);

const THREE_BACKGROUND_TONE_CURVE = '\t#include <tonemapping_fragment>';

/**
 * Godot's noise at Godot's pixel position: Vulkan counts rows from the top, and WebGL from the
 * bottom. The noise is `interleaved_gradient_noise` (`sky.glsl:143-147`). Godot scales it by the
 * `luminance_multiplier` that scales the colour (`sky.glsl:305`, `:314`), so the noise reaches the
 * tone curve at up to 1/255 on every renderer.
 */
const GODOT_DEBANDING_NOISE = /* glsl */ `	{
		vec2 godotPixel = vec2(
			gl_FragCoord.x - ${DEBANDING_UNIFORM}.y,
			${DEBANDING_UNIFORM}.z - gl_FragCoord.y );
		const vec3 magic = vec3( 0.06711056, 0.00583715, 52.9829189 );
		float noise = fract( magic.z * fract( dot( godotPixel, magic.xy ) ) ) * 2.0 - 1.0;
		gl_FragColor.rgb += ${DEBANDING_UNIFORM}.x * vec3( noise, - noise, noise ) / 255.0;
	}
${THREE_BACKGROUND_TONE_CURVE}`;

const debandCube = onChunk('backgroundCube_frag', (shader) => {
  const patched = applyEdits(shader, [{ three: THREE_BACKGROUND_TONE_CURVE, godot: GODOT_DEBANDING_NOISE }]);
  return patched && `uniform vec3 ${DEBANDING_UNIFORM};\n${patched}`;
});

/**
 * Patches three's cube background for every program compiled after the call. The noise follows
 * the sky fog, so the fog patch must be installed first. A second call changes nothing.
 */
export function installSkyDebanding(): void {
  const isPatched = installChunkPatch({
    names: ['backgroundCube_frag'],
    isApplied: (chunks) => chunks.backgroundCube_frag.includes(DEBANDING_UNIFORM),
    apply: debandCube,
    missing: `backgroundCube_frag has no ${THREE_BACKGROUND_TONE_CURVE.trim()}`,
    requires: { backgroundCube_frag: 'godotSkyFog' },
  });
  if (!isPatched) return;
  const backgroundCube = THREE.ShaderLib.backgroundCube!;
  backgroundCube.fragmentShader = THREE.ShaderChunk.backgroundCube_frag;
  backgroundCube.uniforms[DEBANDING_UNIFORM] = { value: debanding };
}

/** Scratch for the viewport each render reads: the render hooks never interleave. */
const viewport = new THREE.Vector4();

/** Adds Godot's noise to `scene`'s background in each render of it, until the returned disposer runs. */
export function debandSky(gl: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
  const stopObserving = observeSceneCamera(scene, () => {
    gl.getCurrentViewport(viewport);
    debanding.set([1, viewport.x, viewport.y + viewport.w]);
  });
  const stopClearing = observeSceneRenderEnd(scene, () => {
    debanding[0] = 0;
  });
  return () => {
    stopObserving();
    stopClearing();
  };
}
