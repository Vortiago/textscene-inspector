/**
 * The quad materials one PointLight2D draws, one per pass role. A quad writes every buffer of the
 * list it draws into with one alpha, so a MIX light scales the colour under it in all of them
 * (`itemLightList.ts`, `PassMeshRole`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { createLightQuadMaterial, type ShadowSampling } from '../../../r3f/lighting2d/lightQuad';
import type { Rgba } from '../../../godot/math/math';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';

interface LightQuadMaterialOptions {
  readonly cookie: THREE.Texture;
  readonly color: Rgba;
  readonly energy: number;
  readonly blendMode: number;
  /** The polar-map sampling of a shadowed light, once its map exists. */
  readonly sampling: ShadowSampling | undefined;
  /** Whether an item the light reaches misses its shadow. */
  readonly drawsUnshadowed: boolean;
}

/** One material per role, null for a role the light does not draw. */
export interface LightQuadMaterials {
  readonly lit: THREE.ShaderMaterial;
  readonly unshadowed: THREE.ShaderMaterial | null;
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
  const { cookie, color, energy, blendMode, sampling, drawsUnshadowed } = options;

  const lit = useOwnedMaterial(
    () => createLightQuadMaterial({ cookie, energy, blendMode, color, shadow: sampling }),
    [cookie, energy, blendMode, color, sampling]
  );
  const unshadowed = useOwnedMaterial(
    () => (drawsUnshadowed ? createLightQuadMaterial({ cookie, energy, blendMode, color }) : null),
    [cookie, energy, blendMode, color, drawsUnshadowed]
  );
  return { lit, unshadowed };
}
