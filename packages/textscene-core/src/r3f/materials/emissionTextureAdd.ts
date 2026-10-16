/**
 * Godot's ADD emission operator, `(emission.rgb + emission_tex) * emission_energy`
 * (`scene/resources/material.cpp:1788`), in a program whose emissive chain only multiplies. The
 * patch adds the texel at the recorded energy where three multiplies the colour by it.
 */

import type { ProgramInjection } from '../materialProgramInputs';
import { recordedUniform } from './recordedOnMaterial';
import { editedChunk } from '../shaderPatch/chunkPatch';

/** The uniform the patch reads, and the `userData` key a material records its value under. */
const ADDED_TEXTURE_ENERGY = 'godotEmissionTextureEnergy';

/** The `userData` that gives a material an added emission texture, none for null. */
export function emissionTextureAddUserData(energy: number | null): Record<string, unknown> {
  return energy === null ? {} : { [ADDED_TEXTURE_ENERGY]: energy };
}

const EMISSIVE_PARS = '#include <emissivemap_pars_fragment>';
const EMISSIVE_MAP = '#include <emissivemap_fragment>';
const MULTIPLY = 'totalEmissiveRadiance *= emissiveColor.rgb;';
const ADD = `totalEmissiveRadiance += emissiveColor.rgb * ${ADDED_TEXTURE_ENERGY};`;

/**
 * three's emissive map chunk inlined, as `onBeforeCompile` sees only the `#include`. `emissive`
 * already holds the colour times the energy, so the texel's term is all the sum lacks.
 */
const EMISSION_TEXTURE_ADD: ProgramInjection = {
  cacheKey: 'godot-emission-texture-add',
  onBeforeCompile(shader) {
    // A material that records no energy adds nothing.
    shader.uniforms[ADDED_TEXTURE_ENERGY] = recordedUniform(this, ADDED_TEXTURE_ENERGY, 0);
    shader.fragmentShader = shader.fragmentShader
      .replace(EMISSIVE_PARS, `${EMISSIVE_PARS}\nuniform float ${ADDED_TEXTURE_ENERGY};`)
      .replace(EMISSIVE_MAP, editedChunk('emissivemap_fragment', { three: MULTIPLY, godot: ADD }));
  },
};

/** What a material whose emission texture adds at `energy` compiles with, none for null. */
export function emissionTextureAddInjection(energy: number | null): ProgramInjection | undefined {
  return energy === null ? undefined : EMISSION_TEXTURE_ADD;
}
