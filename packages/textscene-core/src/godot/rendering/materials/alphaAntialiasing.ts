/** Alpha antialiasing: how a BaseMaterial3D cutout turns its alpha into an edge that MSAA smooths. */

import { clamp } from '../../math/math';

/**
 * `BaseMaterial3D::AlphaAntiAliasing` (`scene/resources/material.h:196-200`), as the integers a
 * `.tscn` stores for `alpha_antialiasing_mode`. SpriteBase3D and Label3D store the same enum.
 */
export enum AlphaAntiAliasing {
  ALPHA_ANTIALIASING_OFF = 0,
  ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE = 1,
  ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE = 2,
}

/** The two modes that turn alpha to coverage on. */
export type AlphaToCoverageMode =
  | AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE
  | AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE;

/**
 * The alpha antialiasing a cutout's shader runs: the scissor cut first, then the edge that
 * `compute_alpha_antialiasing_edge` ramps the alpha across (`scene_forward_clustered.glsl:1383-1424`).
 */
export interface AlphaAntialiasingCut {
  /** Any value but OFF ramps the edge. Only the two named modes turn alpha to coverage on. */
  readonly mode: AlphaAntiAliasing;
  /** The alpha below which the fragment is discarded first. 0 under the hash, which cuts nothing here. */
  readonly scissorThreshold: number;
  /** The alpha the ramp centres on. */
  readonly edge: number;
}

/**
 * A scissor cutout's alpha antialiasing, or null while the mode is OFF. The edge sits past the
 * threshold, "otherwise we won't get any edge feather" (`scene_forward_clustered.glsl:1419-1422`).
 */
export function scissorAntialiasing(
  mode: AlphaAntiAliasing,
  scissorThreshold: number,
  edge: number
): AlphaAntialiasingCut | null {
  if (mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF) return null;
  return { mode, scissorThreshold, edge: clamp(scissorThreshold + edge, 0, 1) };
}

/** A hash cutout's alpha antialiasing, or null while the mode is OFF. Its edge is not clamped. */
export function hashAntialiasing(mode: AlphaAntiAliasing, edge: number): AlphaAntialiasingCut | null {
  if (mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF) return null;
  return { mode, scissorThreshold: 0, edge };
}

/**
 * Whether the mode turns alpha to coverage on, with the blend that goes with it. Only the two named
 * modes emit a render mode (`material.cpp:905-912`, `scene_shader_forward_clustered.cpp:104-105`).
 */
export function turnsOnAlphaToCoverage(mode: AlphaAntiAliasing): mode is AlphaToCoverageMode {
  return (
    mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE ||
    mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE
  );
}
