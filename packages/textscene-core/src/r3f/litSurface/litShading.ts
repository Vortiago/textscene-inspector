/**
 * The shader module's shading of the page: one for every canvas, as the classic pipeline's inputs
 * are the page's. A canvas installs it before its first frame, and a lit node material of any
 * canvas comes from it.
 */

import type * as THREE from 'three';
import { dfgTable } from '../../shaders/dfgTable.js';
import { installGodotShading, type GodotShading } from '../../shaders/godotShading.js';
import { SplitSunLight } from '../directionalShadow/splitSun.js';
import { releasedOnUnmount } from '../sharedTexture.js';
import { classicPipelineInputs } from './classicInputs.js';

/** Written by each `prepareLitShading`, which returns the one shading of the page's inputs every time. Kept for the page's life. */
let shading: GodotShading | null = null;

/**
 * Installs the shading on `renderer`, which writes linear, because the compositor tone maps and
 * encodes once (ADR-0061). A split sun shades as Godot's directional light. The shader module's DFG
 * table is freed on unmount here, as the module imports nothing of `r3f/` (ADR-0072). Call it after
 * `installShaderPatches`, which makes the inputs.
 */
export function prepareLitShading(renderer: THREE.WebGLRenderer): void {
  releasedOnUnmount(dfgTable());
  shading = installGodotShading(renderer, {
    output: 'linear',
    inputs: classicPipelineInputs(),
    sunLights: [SplitSunLight],
  });
}

/** The page's shading, or null before any canvas has prepared its renderer. */
export function litShading(): GodotShading | null {
  return shading;
}
