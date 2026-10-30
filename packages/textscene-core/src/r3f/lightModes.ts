/**
 * The render modes of Godot's light function a surface draws with: the defines that pick a lit
 * program's diffuse and specular branch in `godotLightFunction.ts`.
 */

import { composeInjections, defining, type ProgramInjection } from './materialProgramInputs.js';
import { DIFFUSE_MODE_NAMES, DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { SPECULAR_MODE_NAMES, SpecularMode } from '../godot/rendering/materials/specularMode.js';

/** The render modes of Godot's light function that a surface draws with. */
export interface LightModes {
  /** `diffuse_mode`, a `DiffuseMode`, or past the enum, as the setter stores it unchecked. */
  readonly diffuseMode: number;
  /** `specular_mode`, a `SpecularMode`, or past the enum likewise. */
  readonly specularMode: number;
}

/**
 * Each mode's define, one injection per mode so a program's injection keeps its identity across
 * materials. Burley and GGX take none, so a lit material that stands for a Godot surface in another
 * mode must bring its define.
 */
const DIFFUSE_MODE_INJECTIONS: ReadonlyMap<number, ProgramInjection> = new Map(
  [DiffuseMode.DIFFUSE_LAMBERT, DiffuseMode.DIFFUSE_LAMBERT_WRAP, DiffuseMode.DIFFUSE_TOON].map((mode) => [
    mode,
    defining(`GODOT_${DIFFUSE_MODE_NAMES[mode]}`),
  ])
);

const SPECULAR_MODE_INJECTIONS: ReadonlyMap<number, ProgramInjection> = new Map(
  [SpecularMode.SPECULAR_TOON, SpecularMode.SPECULAR_DISABLED].map((mode) => [
    mode,
    defining(`GODOT_${SPECULAR_MODE_NAMES[mode]}`),
  ])
);

/**
 * A mode past the enum gets no render mode (`material.cpp:828-855`). A spatial shader without one
 * draws Lambert diffuse (`shader_types.cpp:241`) and GGX specular (`scene_forward_clustered.glsl:1078-1080`).
 */
function diffuseModeInjection(mode: number): ProgramInjection | undefined {
  if (mode === DiffuseMode.DIFFUSE_BURLEY) return undefined;
  return DIFFUSE_MODE_INJECTIONS.get(mode) ?? DIFFUSE_MODE_INJECTIONS.get(DiffuseMode.DIFFUSE_LAMBERT);
}

/** What a lit material in these modes compiles with: nothing for Burley and GGX. */
export function lightModesInjection(modes: LightModes): ProgramInjection | undefined {
  return composeInjections([
    diffuseModeInjection(modes.diffuseMode),
    SPECULAR_MODE_INJECTIONS.get(modes.specularMode),
  ]);
}
