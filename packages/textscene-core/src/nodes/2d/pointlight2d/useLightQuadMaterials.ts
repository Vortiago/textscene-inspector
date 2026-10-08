/**
 * The quad materials one PointLight2D draws, one per pass role. Each light writes the light and
 * tint buffers over its whole reach with one alpha, so a MIX light scales the colour under it in
 * both (`itemLightList.ts`, `PassMeshRole`).
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { Color } from '../../base/node2d/types';
import {
  alphaOnly,
  createLightQuadMaterial,
  createShadowColorQuadMaterial,
  Light2DBlendMode,
  type ShadowSampling,
} from '../../../r3f/lighting2d/lightQuad';
import { litQuadStencilProps, shadowColorQuadStencilProps } from '../../../r3f/lighting2d/ShadowVolumeMask';

export interface LightQuadMaterialOptions {
  readonly cookie: THREE.Texture;
  readonly color: Color;
  readonly energy: number;
  readonly blendMode: number;
  /** `Light2D.shadow_color`. */
  readonly shadowColor: Color;
  /** Whether the light casts with a `shadow_color` that contributes. */
  readonly tintsShadow: boolean;
  /** Whether the light casts on this canvas. */
  readonly shadowed: boolean;
  /** Whether a shadow filter replaces the stencil with the polar map. */
  readonly filtered: boolean;
  /** The polar-map sampling of a filtered light, once its map exists. */
  readonly sampling: ShadowSampling | undefined;
  /** This light's stencil ref, or null while undeclared. */
  readonly ordinal: number | null;
  /** Whether an item the light reaches misses its shadow. */
  readonly drawsUnshadowed: boolean;
}

/** One material per role, null for a role the light does not draw. */
export interface LightQuadMaterials {
  readonly lit: THREE.ShaderMaterial;
  readonly shade: THREE.ShaderMaterial | null;
  readonly tint: THREE.ShaderMaterial | null;
  readonly fade: THREE.ShaderMaterial | null;
  readonly unshadowed: THREE.ShaderMaterial | null;
  readonly unshadowedFade: THREE.ShaderMaterial | null;
}

/**
 * The tint pass's quad: the `shadow_color` where the light is blocked. A sampling carries the colour
 * the cookie quad reads too, so one light's quads cannot hold different `shadow_color`s, and the
 * alpha over the whole rect, which a MIX light scales the tint buffer by even untinted.
 */
function tintQuadMaterial(options: LightQuadMaterialOptions): THREE.ShaderMaterial | null {
  const { cookie, blendMode, shadowColor, tintsShadow, shadowed, filtered, sampling, ordinal } = options;
  if (!shadowed) return null;
  if (filtered) {
    const drawsTint = tintsShadow || blendMode === Light2DBlendMode.MIX;
    return sampling && drawsTint
      ? createShadowColorQuadMaterial({ cookie, blendMode, shadow: sampling })
      : null;
  }
  if (!tintsShadow) return null;
  return createShadowColorQuadMaterial({
    cookie,
    blendMode,
    shadowColor,
    stencil: shadowColorQuadStencilProps(ordinal ?? 0),
  });
}

function buildMaterials(options: LightQuadMaterialOptions): LightQuadMaterials {
  const {
    cookie,
    color,
    energy,
    blendMode,
    shadowColor,
    tintsShadow,
    shadowed,
    filtered,
    sampling,
    ordinal,
    drawsUnshadowed,
  } = options;
  const isMix = blendMode === Light2DBlendMode.MIX;
  // A filtered light computes its own fraction per fragment over the whole rect, so it needs no
  // stencil ref, stamps nothing, and its tint quad carries the whole alpha into the tint pass.
  const stenciled = shadowed && !filtered;
  const litStencil = stenciled ? litQuadStencilProps(ordinal ?? 0) : undefined;
  const shadowStencil = shadowColorQuadStencilProps(ordinal ?? 0);
  const base = { cookie, energy, blendMode };
  return {
    lit: createLightQuadMaterial({ ...base, color, stencil: litStencil, shadow: sampling }),
    // Where the volumes stamped, the tint's alpha is the light buffer's share too: MIX scales the
    // colour under it by that alpha, and Light Only sums it.
    shade:
      stenciled && tintsShadow
        ? createShadowColorQuadMaterial({
            cookie,
            blendMode,
            shadowColor: alphaOnly(shadowColor),
            stencil: shadowStencil,
          })
        : null,
    tint: tintQuadMaterial(options),
    // Where the light is lit, its alpha scales the tint buffer under a MIX blend.
    fade:
      isMix && !filtered
        ? createLightQuadMaterial({ ...base, color: alphaOnly(color), stencil: litStencil })
        : null,
    unshadowed: drawsUnshadowed ? createLightQuadMaterial({ ...base, color }) : null,
    unshadowedFade:
      drawsUnshadowed && isMix ? createLightQuadMaterial({ ...base, color: alphaOnly(color) }) : null,
  };
}

/** Builds the materials once per input change and disposes the set it replaces. */
export function useLightQuadMaterials(options: LightQuadMaterialOptions): LightQuadMaterials {
  const {
    cookie,
    color,
    energy,
    blendMode,
    shadowColor,
    tintsShadow,
    shadowed,
    filtered,
    sampling,
    ordinal,
    drawsUnshadowed,
  } = options;
  const materials = useMemo(
    () =>
      buildMaterials({
        cookie,
        color,
        energy,
        blendMode,
        shadowColor,
        tintsShadow,
        shadowed,
        filtered,
        sampling,
        ordinal,
        drawsUnshadowed,
      }),
    [
      cookie,
      color,
      energy,
      blendMode,
      shadowColor,
      tintsShadow,
      shadowed,
      filtered,
      sampling,
      ordinal,
      drawsUnshadowed,
    ]
  );
  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material?.dispose();
    },
    [materials]
  );
  return materials;
}
