/**
 * Material slot for a StandardMaterial3D the SCENE declares as a
 * `[sub_resource]` — textures and all.
 *
 * One component per surface, like `ExternalMaterialSlot`: the texture pipeline
 * is a fixed sequence of `useResource` hooks, so an ArrayMesh with N surfaces
 * needs N instances of it, not one call in a `.map`. The maps and the
 * missing-texture placeholder are the same ones the primitive path binds.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/types';
import { useMeshMaterialTextures } from './useMeshMaterialTextures';

/**
 * Every slot reading the same sub-resource decodes it once, across renders too:
 * `parseStandardMaterial3DScalars` walks ~60 property decodes inside the
 * render. Keyed on the resource OBJECT, which a re-parse replaces, so a hit can
 * never be stale; a WeakMap so the entry dies with it.
 */
const decoded = new WeakMap<TscnInternalResource, StandardMaterial3DScalars>();

export function sceneMaterialScalars(resource: TscnInternalResource): StandardMaterial3DScalars {
  const hit = decoded.get(resource);
  if (hit) return hit;
  const built = parseStandardMaterial3DScalars(resource.data as Record<string, string>);
  decoded.set(resource, built);
  return built;
}

export function SceneMaterialSlot({
  subResource,
  attach,
  shadowSide,
}: {
  subResource: TscnInternalResource;
  attach?: string;
  shadowSide?: THREE.Side;
}) {
  const { internalResources, externalResources } = useSceneResources();
  const scalars = useMemo(() => sceneMaterialScalars(subResource), [subResource]);
  const maps = useMeshMaterialTextures(
    subResource,
    scalars,
    undefined,
    internalResources,
    externalResources
  );
  if (maps.firstMissingPath !== null) {
    return <meshStandardMaterial attach={attach} color="magenta" />;
  }
  return (
    <StandardMaterialSlot
      scalars={scalars}
      albedoMap={maps.albedoMap}
      normalMap={maps.normalMap}
      roughnessMap={maps.roughnessMap}
      metalnessMap={maps.metalnessMap}
      emissiveMap={maps.emissiveMap}
      aoMap={scalars.aoEnabled ? maps.aoMap : undefined}
      displacementMap={maps.displacementMap}
      anisotropyMap={maps.anisotropyMap}
      attach={attach}
      shadowSide={shadowSide}
    />
  );
}
