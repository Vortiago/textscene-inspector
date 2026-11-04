/**
 * The quad materials one PointLight2D draws, one per pass role. Each light writes the light and
 * tint buffers over its whole reach with one alpha, so a MIX light scales the colour under it in
 * both (`itemLightList.ts`, `PassMeshRole`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import {
  alphaOnly,
  createLightQuadMaterial,
  createShadowColorQuadMaterial,
  type ShadowSampling,
} from '../../../r3f/lighting2d/lightQuad';
import type { Rgba } from '../../../godot/math/math';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { Light2DBlendMode } from '../../../godot/scene/light2d';

interface LightQuadMaterialOptions {
  readonly cookie: THREE.Texture;
  readonly color: Rgba;
  readonly energy: number;
  readonly blendMode: number;
  /** Whether the light casts with a `shadow_color` that contributes. */
  readonly tintsShadow: boolean;
  /** The polar-map sampling of a shadowed light, once its map exists. */
  readonly sampling: ShadowSampling | undefined;
  /** Whether an item the light reaches misses its shadow. */
  readonly drawsUnshadowed: boolean;
}

/** One material per role, null for a role the light does not draw. */
export interface LightQuadMaterials {
  readonly lit: THREE.ShaderMaterial;
  readonly tint: THREE.ShaderMaterial | null;
  readonly fade: THREE.ShaderMaterial | null;
  readonly unshadowed: THREE.ShaderMaterial | null;
  readonly unshadowedFade: THREE.ShaderMaterial | null;
}

/**
 * The tint pass's quad: the `shadow_color` where the light is blocked. It carries the light's alpha
 * over the whole rect, which a MIX light scales the tint buffer by even untinted.
 */
function tintQuadMaterial(options: LightQuadMaterialOptions): THREE.ShaderMaterial | null {
  const { cookie, blendMode, tintsShadow, sampling } = options;
  const drawsTint = tintsShadow || blendMode === Light2DBlendMode.MIX;
  return sampling && drawsTint
    ? createShadowColorQuadMaterial({ cookie, blendMode, shadow: sampling })
    : null;
}

/**
 * A material built from `deps` alone, disposed when it is replaced or unmounted. Each role keeps
 * its own, so an input one role ignores rebuilds none of the others.
 */
function useOwnedMaterial<M extends THREE.ShaderMaterial | null>(
  build: () => M,
  deps: readonly unknown[]
): M {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- each caller lists what its `build` reads.
  const material = useMemo(build, deps);
  useDisposeOnRelease(material);
  return material;
}

/** The materials one light's quads draw with, each rebuilt only when its own inputs change. */
export function useLightQuadMaterials(options: LightQuadMaterialOptions): LightQuadMaterials {
  const { cookie, color, energy, blendMode, tintsShadow, sampling, drawsUnshadowed } = options;
  const isMix = blendMode === Light2DBlendMode.MIX;
  const shadowed = !!sampling;

  const lit = useOwnedMaterial(
    () => createLightQuadMaterial({ cookie, energy, blendMode, color, shadow: sampling }),
    [cookie, energy, blendMode, color, sampling]
  );
  const tint = useOwnedMaterial(() => tintQuadMaterial(options), [cookie, blendMode, tintsShadow, sampling]);
  // An unshadowed MIX light scales the tint buffer by its alpha. A shadowed one does it through
  // its tint quad.
  const fade = useOwnedMaterial(
    () =>
      isMix && !shadowed
        ? createLightQuadMaterial({ cookie, energy, blendMode, color: alphaOnly(color) })
        : null,
    [cookie, energy, blendMode, color, isMix, shadowed]
  );
  const unshadowed = useOwnedMaterial(
    () => (drawsUnshadowed ? createLightQuadMaterial({ cookie, energy, blendMode, color }) : null),
    [cookie, energy, blendMode, color, drawsUnshadowed]
  );
  const unshadowedFade = useOwnedMaterial(
    () =>
      drawsUnshadowed && isMix
        ? createLightQuadMaterial({ cookie, energy, blendMode, color: alphaOnly(color) })
        : null,
    [cookie, energy, blendMode, color, drawsUnshadowed, isMix]
  );
  return { lit, tint, fade, unshadowed, unshadowedFade };
}
