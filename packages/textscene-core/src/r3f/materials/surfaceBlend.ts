/** The material state of one pass of a surface, in three's terms. */

import type * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import type { AlphaAntialiasingCut } from '../../godot/rendering/materials/alphaAntialiasing';
import type { OpaquePrepass } from './opaquePrepass';

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
