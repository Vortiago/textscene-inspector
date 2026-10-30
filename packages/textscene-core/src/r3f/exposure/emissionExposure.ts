/**
 * Godot scales a shaded surface's emission by the exposure factor of the render
 * (`scene_forward_clustered.glsl:1679-1683`; an unshaded surface keeps its emission whole). The
 * lit programs read the factor from one shared buffer, which `sceneExposure.ts` writes before each
 * render of a scene.
 */

import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { installedOr, installLitUniform } from '../shaderPatch/litUniform.js';

const EXPOSURE_UNIFORM = 'godotEmissionExposure';

/** The GLSL factor of a lit program, for a patch that adds emission after the chunk has scaled its own. */
export const EMISSION_EXPOSURE_FACTOR = `${EXPOSURE_UNIFORM}[ 0 ]`;

/**
 * The factor the next render scales its emission by. A one-element array, not a number:
 * `UniformsUtils.cloneUniforms` copies a number for each material and keeps a typed array by
 * reference (three r186 `UniformsUtils.js:43-64`), so every material reads this buffer. After a dev
 * server reloads this module, it is the buffer the earlier evaluation installed.
 */
export const EMISSION_EXPOSURE = installedOr(EXPOSURE_UNIFORM, Float32Array, () => Float32Array.of(1));

/**
 * Scales `totalEmissiveRadiance` by the factor after three's emissive map has multiplied it, and
 * gives the factor to every built-in lit material, for every program compiled after the call. True
 * when the chunks hold the patch. A second call changes nothing.
 */
export function installEmissionExposure(): boolean {
  const isPatched = installChunkEdits({
    edits: [
      {
        chunk: 'emissivemap_pars_fragment',
        three: '#ifdef USE_EMISSIVEMAP',
        godot: `uniform float ${EXPOSURE_UNIFORM}[ 1 ];\n#ifdef USE_EMISSIVEMAP`,
      },
    ],
    mark: EXPOSURE_UNIFORM,
    patch: 'emission exposure',
    append: { emissivemap_fragment: `\ntotalEmissiveRadiance *= ${EXPOSURE_UNIFORM}[ 0 ];` },
  });
  if (isPatched) installLitUniform(EXPOSURE_UNIFORM, EMISSION_EXPOSURE);
  return isPatched;
}
