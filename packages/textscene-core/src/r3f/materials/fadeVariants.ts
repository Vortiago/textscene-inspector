/**
 * A surface's material state in the two passes its geometry instance's fade can draw it in:
 * unfaded, and the alpha pass a fade below the threshold forces (`godot/fadeAlpha.ts`). The
 * scene cull picks one of the two materials per render (`swappedMaterials.ts`).
 */

import type * as THREE from 'three';
import type { AlphaCutSurface } from '../godotAlphaCut';
import { surfaceAlphaProps, type SurfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  NO_OPAQUE_PREPASS,
  type OpaquePrepass,
} from './opaquePrepass';

/** One value for each pass a geometry instance's fade can draw a surface in. */
export interface FadeVariants<T> {
  unfaded: T;
  alphaPass: T;
}

/** A pass a geometry instance's fade can draw a surface in. */
export type FadePass = keyof FadeVariants<unknown>;

/** The material state a geometry instance's fade changes. */
interface SurfaceAlpha {
  /** The alpha the surface's shader multiplies in: 1 where it reads none. */
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

/** A surface's alpha state in one pass, and what its blend then needs. */
export type PassAlpha = SurfaceAlpha & SurfaceAlphaProps;

/** A surface's alpha state, with its depth write once its geometry instance moves it to the alpha pass. */
export interface AlphaPassSurface extends SurfaceAlpha {
  /** Its depth write in the alpha pass, which also skips the depth prepass. */
  alphaPassDepthWrite: boolean;
  /** Its blend mode, which the fade leaves as it is. Omitted is MIX. */
  blending?: THREE.Blending;
}

/**
 * The surface's alpha state in each pass, and the props its blend then needs. The alpha-pass
 * `opacity` is the unfaded one: the cull multiplies the fade alpha in, as Godot's shader starts
 * ALPHA from it, which also lowers what a cut keeps.
 */
export function surfaceFadeVariants(
  source: SurfaceAlphaSource,
  surface: AlphaPassSurface
): FadeVariants<PassAlpha> {
  const { opacity, blending } = surface;
  const unfaded = { opacity, transparent: surface.transparent, depthWrite: surface.depthWrite };
  const alphaPass = { opacity, transparent: true, depthWrite: surface.alphaPassDepthWrite };
  return {
    unfaded: { ...unfaded, ...surfaceAlphaProps(source, { ...unfaded, blending }) },
    alphaPass: { ...alphaPass, ...surfaceAlphaProps(source, { ...alphaPass, blending }) },
  };
}

/**
 * The blend of each pass of a Sprite3D or Label3D surface, whose `get_material_for_2d` material
 * keeps DEPTH_DRAW_OPAQUE_ONLY, so the alpha pass writes no depth. Both draw MIX, three's default
 * blending. A Label3D run takes its opacity from its tint.
 */
export function cutBlends(cut: AlphaCutSurface) {
  const { alphaTest, alphaHash } = cut;
  const unfaded = { transparent: cut.blended, depthWrite: cut.depthWrite };
  const alphaPass = { transparent: true, depthWrite: false };
  return {
    unfaded: { ...unfaded, ...surfaceAlphaProps(cut, unfaded), alphaTest, alphaHash },
    alphaPass: { ...alphaPass, ...surfaceAlphaProps(cut, alphaPass), alphaTest, alphaHash },
  };
}

const NO_OPAQUE_PREPASSES: FadeVariants<OpaquePrepass> = {
  unfaded: NO_OPAQUE_PREPASS,
  alphaPass: NO_OPAQUE_PREPASS,
};
const CUT_OPAQUE_PREPASSES: FadeVariants<OpaquePrepass> = {
  unfaded: DRAWN_OPAQUE_PREPASS,
  alphaPass: FADED_OPAQUE_PREPASS,
};

/**
 * The opaque prepass of each pass of a Sprite3D or Label3D surface. A disabled depth test leaves
 * the surface none (`scene_shader_forward_clustered.h:288-292`).
 */
export function cutOpaquePrepasses(cut: AlphaCutSurface, depthTest: boolean): FadeVariants<OpaquePrepass> {
  return cut.depthPrepass && depthTest ? CUT_OPAQUE_PREPASSES : NO_OPAQUE_PREPASSES;
}

/** {@link cutBlends} with `opacity`, the alpha a Sprite3D's shader reads. */
export function cutFadeVariants(cut: AlphaCutSurface, opacity: number) {
  const { unfaded, alphaPass } = cutBlends(cut);
  return { unfaded: { ...unfaded, opacity }, alphaPass: { ...alphaPass, opacity } };
}
