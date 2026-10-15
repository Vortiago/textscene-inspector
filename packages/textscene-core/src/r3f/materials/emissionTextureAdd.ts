/**
 * Godot's ADD emission operator, `(emission.rgb + emission_tex) * emission_energy`
 * (`scene/resources/material.cpp:1788`), in a program whose emissive chain only multiplies. The
 * patch adds the texel at the recorded energy where three multiplies the colour by it.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';

/** The uniform the patch reads, and the `userData` key a material records its value under. */
const ADDED_TEXTURE_ENERGY = 'godotEmissionTextureEnergy';

/** The `userData` that gives a material an added emission texture, none for null. */
export function emissionTextureAddUserData(energy: number | null): Record<string, unknown> {
  return energy === null ? {} : { [ADDED_TEXTURE_ENERGY]: energy };
}

/**
 * A uniform that reads the recorded energy at each upload, so an energy edit needs no recompile.
 * A material that records none reads zero.
 */
function addedEnergyUniform(material: THREE.Material): THREE.IUniform<number> {
  return {
    get value() {
      return recordedOn(material, ADDED_TEXTURE_ENERGY, 0);
    },
  };
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
    shader.uniforms[ADDED_TEXTURE_ENERGY] = addedEnergyUniform(this);
    shader.fragmentShader = shader.fragmentShader
      .replace(EMISSIVE_PARS, `${EMISSIVE_PARS}\nuniform float ${ADDED_TEXTURE_ENERGY};`)
      .replace(EMISSIVE_MAP, addingEmissiveMapChunk());
  },
};

/** Written once, by the first compile that patches. The chunk is fixed for one build of three. */
let addingChunk: string | undefined;

/** Checked at the first compile, so a three whose chunk lost the multiply fails loudly, not dark. */
function addingEmissiveMapChunk(): string {
  if (addingChunk !== undefined) return addingChunk;
  const chunk = THREE.ShaderChunk.emissivemap_fragment;
  if (!chunk.includes(MULTIPLY)) {
    throw new Error(`expected three's emissivemap_fragment to hold "${MULTIPLY}", got:\n${chunk}`);
  }
  addingChunk = chunk.replace(MULTIPLY, ADD);
  return addingChunk;
}

/** What a material whose emission texture adds at `energy` compiles with, none for null. */
export function emissionTextureAddInjection(energy: number | null): ProgramInjection | undefined {
  return energy === null ? undefined : EMISSION_TEXTURE_ADD;
}
