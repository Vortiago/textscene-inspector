/**
 * `GeometryInstance3D.transparency` applied to one surface's three material state. Godot applies
 * it per instance, to every surface the instance draws (`godot/instanceTransparency.ts`).
 */

import { forcesAlphaPass, instanceAlpha } from '../../godot/instanceTransparency';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import {
  withSurfaceAlphaPatch,
  type StandardMaterialBag,
} from '../../resources/materials/standardmaterial3d/materialBag';
import type { ProgramInjection } from '../materialProgramInputs';
import type { AlphaCutSurface } from '../godotAlphaCut';
import { surfaceAlphaPatch } from './surfaceAlphaPatch';

/** The material state an instance's `transparency` changes. */
export interface SurfaceAlpha {
  /** The alpha the surface's shader multiplies in: 1 where it reads none. */
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

/** A surface's alpha state, with its depth write once its instance moves it to the alpha pass. */
export interface AlphaPassSurface extends SurfaceAlpha {
  /** Its depth write in the alpha pass, which also skips the depth prepass. */
  alphaPassDepthWrite: boolean;
}

/** A Sprite3D or Label3D surface's alpha state, with the shader patch its blend needs. */
export interface CutSurfaceAlpha extends SurfaceAlpha {
  injection: ProgramInjection | undefined;
}

/**
 * The surface's alpha state under its instance's `transparency`. The instance alpha is the
 * shader's starting ALPHA, so it multiplies the material's own alpha and lowers what a cut keeps.
 */
export function instanceSurfaceAlpha(surface: AlphaPassSurface, transparency: number): SurfaceAlpha {
  const opacity = surface.opacity * instanceAlpha(transparency);
  if (!forcesAlphaPass(transparency))
    return { opacity, transparent: surface.transparent, depthWrite: surface.depthWrite };
  return { opacity, transparent: true, depthWrite: surface.alphaPassDepthWrite };
}

/**
 * The alpha state of a Sprite3D or Label3D surface, whose `get_material_for_2d` material keeps
 * DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth. `opacity` is the alpha its shader
 * reads. Both draw MIX, so the patch sees three's default blending.
 */
export function cutSurfaceAlpha(
  cut: AlphaCutSurface,
  opacity: number,
  transparency: number
): CutSurfaceAlpha {
  const alpha = instanceSurfaceAlpha(
    { opacity, transparent: cut.blended, depthWrite: cut.depthWrite, alphaPassDepthWrite: false },
    transparency
  );
  return { ...alpha, injection: surfaceAlphaPatch(cut, alpha) };
}

/**
 * The bag of a surface drawn under its instance's `transparency`. Null `scalars` is Godot's
 * default surface: opaque, under DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth. Its
 * three material reads no texture or vertex alpha, so it needs no patch.
 */
export function withInstanceTransparency(
  bag: StandardMaterialBag,
  scalars: StandardMaterial3DScalars | null,
  transparency: number
): StandardMaterialBag {
  // A full instance alpha never forces the alpha pass either.
  if (instanceAlpha(transparency) === 1) return bag;
  const alpha = instanceSurfaceAlpha(
    {
      opacity: bag.props.opacity ?? 1,
      transparent: bag.props.transparent ?? false,
      depthWrite: bag.props.depthWrite ?? true,
      alphaPassDepthWrite: scalars?.alphaPassDepthWrite ?? false,
    },
    transparency
  );
  const transparentBag = { ...bag, props: { ...bag.props, ...alpha } };
  return scalars ? withSurfaceAlphaPatch(transparentBag, scalars) : transparentBag;
}
