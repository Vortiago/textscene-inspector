/**
 * The pipeline inputs of the shader module (`shaders/pipelineInputs.ts`) as the classic pipeline
 * owns them: the sky it shows, the directional atlas it draws and the exposure it writes. A node
 * material that reads them draws beside the patched materials in one frame, from one shadow pass
 * and one baked sky.
 */

import type * as THREE from 'three';
import type { PipelineInputs } from '../../shaders/pipelineInputs.js';
import {
  directionalShadowAtlasColour,
  directionalShadowAtlasDepth,
} from '../directionalShadow/shadowAtlas.js';
import { EMISSION_EXPOSURE } from '../exposure/emissionExposure.js';
import { shownSky, SKY_RADIANCE_UNIFORMS, skyRadianceUniforms, skyRotation } from '../sky/skyRadiance.js';

/**
 * The page's inputs, which every canvas's shading reads. Filled by the first `classicPipelineInputs`.
 * The light pass writes `directionalSoftShadows` before each render (`writeDirectionalSoftShadows`).
 */
const inputs: PipelineInputs = {};

/** The inputs, filled from the classic owners on the first call. Call it after `installShaderPatches`. */
export function classicPipelineInputs(): PipelineInputs {
  if (inputs.sky) return inputs;
  inputs.sky = {
    layers: skyRadianceUniforms()[SKY_RADIANCE_UNIFORMS.layers]!.value as THREE.Texture,
    shown: shownSky,
    rotation: skyRotation,
  };
  // `WebGLRenderer` draws the atlas, so its rows count from the bottom.
  inputs.sunShadow = {
    depth: directionalShadowAtlasDepth(),
    colour: directionalShadowAtlasColour(),
    rowsFromBottom: true,
  };
  inputs.emissionExposure = EMISSION_EXPOSURE;
  return inputs;
}

/** Godot's `sc_use_directional_soft_shadows` for the render about to draw (`sunSoftShadow.ts`). */
export function writeDirectionalSoftShadows(draws: boolean): void {
  inputs.directionalSoftShadows = draws;
}
