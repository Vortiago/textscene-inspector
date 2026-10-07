/**
 * A geometry instance's `transparency` applied to one surface's three material state. Godot applies
 * its fade alpha to every surface the instance draws (`godot/fadeAlpha.ts`).
 */

import type * as THREE from 'three';
import { fadeAlpha, forcesAlphaPass } from '../../godot/fadeAlpha';
import type { AlphaCutSurface } from '../godotAlphaCut';
import { surfaceAlphaProps, type SurfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';

/** The material state a geometry instance's `transparency` changes. */
interface SurfaceAlpha {
  /** The alpha the surface's shader multiplies in: 1 where it reads none. */
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

/** A surface's alpha state, with its depth write once its geometry instance moves it to the alpha pass. */
export interface AlphaPassSurface extends SurfaceAlpha {
  /** Its depth write in the alpha pass, which also skips the depth prepass. */
  alphaPassDepthWrite: boolean;
  /** Its blend mode, which the fade leaves as it is. Omitted is MIX. */
  blending?: THREE.Blending;
}

/**
 * The surface's alpha state under its geometry instance's `transparency`, and the props its blend
 * then needs. The fade alpha is the shader's starting ALPHA, so it multiplies the material's own
 * alpha and lowers what a cut keeps. The blend props read the faded state.
 */
export function fadedSurfaceAlpha(
  source: SurfaceAlphaSource,
  surface: AlphaPassSurface,
  transparency: number
): SurfaceAlpha & SurfaceAlphaProps {
  const opacity = surface.opacity * fadeAlpha(transparency);
  const alpha = forcesAlphaPass(transparency)
    ? { opacity, transparent: true, depthWrite: surface.alphaPassDepthWrite }
    : { opacity, transparent: surface.transparent, depthWrite: surface.depthWrite };
  return { ...alpha, ...surfaceAlphaProps(source, { ...alpha, blending: surface.blending }) };
}

/**
 * The alpha state of a Sprite3D or Label3D surface, whose `get_material_for_2d` material keeps
 * DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth. `opacity` is the alpha its shader
 * reads. Both draw MIX, three's default blending.
 */
export function cutSurfaceAlpha(cut: AlphaCutSurface, opacity: number, transparency: number) {
  const surface = {
    opacity,
    transparent: cut.blended,
    depthWrite: cut.depthWrite,
    alphaPassDepthWrite: false,
  };
  return {
    ...fadedSurfaceAlpha(cut, surface, transparency),
    alphaTest: cut.alphaTest,
    alphaHash: cut.alphaHash,
  };
}
