/** The material state of one pass of a surface, in three's terms. */

import type * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import type { AlphaAntialiasingCut } from '../../godot/rendering/materials/alphaAntialiasing';
import { opaquePrepassUserData, type OpaquePrepass } from './opaquePrepass';
import { alphaHashScaleUserData } from './godotAlphaHash';
import { alphaAntialiasingProps, alphaAntialiasingUserData } from './godotAlphaAntialiasing';

/**
 * One `BaseMaterial3D::Transparency` (`material.h:200-207`) in three's terms: what
 * a Sprite3D or Label3D surface's `alpha_cut` selects (`sprite_3d.cpp:285-297`,
 * `label_3d.cpp:386-393`). A 2D Control's text always paints `TRANSPARENCY_ALPHA`, every field's default below.
 */
export interface SurfaceBlend {
  transparent: boolean;
  depthWrite: boolean;
  alphaTest: number;
  alphaHash: boolean;
  /** `alpha_hash_scale`, the grain of the hash. Omitted, Godot's default of 1. */
  alphaHashScale?: number;
  /** How Godot's depth passes treat the surface. Omitted, it has no opaque prepass. */
  opaquePrepass?: OpaquePrepass;
  /** What the surface's blend needs so three blends the alpha Godot writes (`surfaceAlphaPatch.ts`). */
  blending?: THREE.Blending;
  /** The cut's alpha antialiasing. Omitted, the surface runs none. */
  antialiasing?: AlphaAntialiasingCut | null;
  injection?: ProgramInjection;
}

/** One pass's blend, with the fields `get_material_for_2d` always hands the material. */
export type PassBlend = SurfaceBlend &
  Required<Pick<SurfaceBlend, 'alphaHashScale' | 'antialiasing' | 'opaquePrepass'>>;

/**
 * The material props of one pass: its blend state, and the `userData` the hash, antialiasing and
 * prepass patches read. Every mode's material carries the scale and the edge (`sprite_3d.cpp:281-283`):
 * only HASH reads the scale, and only an antialiased cut the edge.
 */
export function passBlendMaterialProps(blend: PassBlend) {
  return {
    transparent: blend.transparent,
    depthWrite: blend.depthWrite,
    alphaTest: blend.alphaTest,
    alphaHash: blend.alphaHash,
    blending: blend.blending,
    ...alphaAntialiasingProps(blend.antialiasing),
    userData: {
      ...alphaHashScaleUserData(blend.alphaHashScale),
      ...alphaAntialiasingUserData(blend.antialiasing),
      ...opaquePrepassUserData(blend.opaquePrepass),
    },
  };
}
