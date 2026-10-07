/**
 * `GeometryInstance3D.transparency` applied to one surface's three material state. Godot applies
 * it per instance, to every surface the instance draws (`godot/instanceTransparency.ts`).
 */

import * as THREE from 'three';
import { forcesAlphaPass, instanceAlpha } from '../../godot/instanceTransparency';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import type { AlphaCutSurface } from '../godotAlphaCut';

/** The material state an instance's `transparency` changes. */
export interface SurfaceAlpha {
  /** The alpha the surface's shader multiplies in: 1 where it reads none. */
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  blending: THREE.Blending;
}

/** A surface's alpha state, with what it does once its instance moves it to the alpha pass. */
export interface AlphaPassSurface extends SurfaceAlpha {
  /** Its depth write in the alpha pass, which also skips the depth prepass. */
  alphaPassDepthWrite: boolean;
  /** Godot writes alpha 1 for each fragment its cut keeps (`scene_forward_clustered.glsl:1413-1415`). */
  opaqueAfterCut: boolean;
}

/**
 * The surface's alpha state under its instance's `transparency`. The instance alpha is the
 * shader's starting ALPHA, so it multiplies the material's own alpha and lowers what a cut keeps.
 */
export function instanceSurfaceAlpha(surface: AlphaPassSurface, transparency: number): SurfaceAlpha {
  const opacity = surface.opacity * instanceAlpha(transparency);
  const { transparent, depthWrite, blending } = surface;
  if (!forcesAlphaPass(transparency)) return { opacity, transparent, depthWrite, blending };
  // A MIX blend of alpha 1 overwrites, which three spells as no blending.
  const cutOverwrites = surface.opaqueAfterCut && blending === THREE.NormalBlending;
  return {
    opacity,
    transparent: true,
    depthWrite: surface.alphaPassDepthWrite,
    blending: cutOverwrites ? THREE.NoBlending : blending,
  };
}

/**
 * The alpha state of a Sprite3D or Label3D surface, whose `get_material_for_2d` material keeps
 * DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth. `opacity` is the alpha its shader reads.
 */
export function cutSurfaceAlpha(cut: AlphaCutSurface, opacity: number, transparency: number): SurfaceAlpha {
  return instanceSurfaceAlpha(
    {
      opacity,
      transparent: cut.blended,
      depthWrite: cut.depthWrite,
      blending: THREE.NormalBlending,
      alphaPassDepthWrite: false,
      opaqueAfterCut: cut.opaqueAfterCut,
    },
    transparency
  );
}

/**
 * The bag of a surface drawn under its instance's `transparency`. Null `scalars` is Godot's
 * default surface: opaque, under DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth.
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
      blending: bag.props.blending ?? THREE.NormalBlending,
      alphaPassDepthWrite: scalars?.alphaPassDepthWrite ?? false,
      opaqueAfterCut: scalars?.opaqueAfterCut ?? false,
    },
    transparency
  );
  return { ...bag, props: { ...bag.props, ...alpha } };
}
