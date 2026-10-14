/**
 * Godot's ADD emission operator, `(emission.rgb + emission_tex) * emission_energy`
 * (`scene/resources/material.cpp:1788`), in a program whose emissive chain only multiplies. The
 * patch adds the texel at the recorded energy where three multiplies the colour by it.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';

/** Where a material records the energy its emission texture adds at. */
const ADDED_TEXTURE_ENERGY_KEY = 'godotEmissionTextureEnergy';

/** The `userData` that gives a material an added emission texture, none for null. */
export function emissionTextureAddUserData(energy: number | null): Record<string, unknown> {
  return energy === null ? {} : { [ADDED_TEXTURE_ENERGY_KEY]: energy };
}

/** The energy `material`'s emission texture adds at, zero for a material that adds none. */
export function addedEmissionTextureEnergy(material: THREE.Material): number {
  return recordedOn(material, ADDED_TEXTURE_ENERGY_KEY, 0);
}

/** A uniform that reads the recorded energy at each upload, so an energy edit needs no recompile. */
function addedEnergyUniform(material: THREE.Material): THREE.IUniform<number> {
  return {
    get value() {
      return addedEmissionTextureEnergy(material);
    },
  };
}

const EMISSIVE_PARS = `#include <emissivemap_pars_fragment>
uniform float godotEmissionTextureEnergy;`;

const EMISSIVE_MAP = '#include <emissivemap_fragment>';
const MULTIPLY = 'totalEmissiveRadiance *= emissiveColor.rgb;';
const ADD = 'totalEmissiveRadiance += emissiveColor.rgb * godotEmissionTextureEnergy;';

/**
 * three's emissive map chunk inlined, as `onBeforeCompile` sees only the `#include`. `emissive`
 * already holds the colour times the energy, so the texel's term is all the sum lacks.
 */
const EMISSION_TEXTURE_ADD: ProgramInjection = {
  cacheKey: 'godot-emission-texture-add',
  onBeforeCompile(shader) {
    shader.uniforms['godotEmissionTextureEnergy'] = addedEnergyUniform(this);
    const chunk = addingEmissiveMapChunk();
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <emissivemap_pars_fragment>', EMISSIVE_PARS)
      .replace(EMISSIVE_MAP, chunk);
  },
};

/** Read at each compile, so a three whose chunk lost the multiply fails loudly, not dark. */
function addingEmissiveMapChunk(): string {
  const chunk = THREE.ShaderChunk.emissivemap_fragment;
  if (!chunk.includes(MULTIPLY)) {
    throw new Error(`expected three's emissivemap_fragment to hold "${MULTIPLY}", got:\n${chunk}`);
  }
  return chunk.replace(MULTIPLY, ADD);
}

/** What a material whose emission texture adds at `energy` compiles with, none for null. */
export function emissionTextureAddInjection(energy: number | null): ProgramInjection | undefined {
  return energy === null ? undefined : EMISSION_TEXTURE_ADD;
}
