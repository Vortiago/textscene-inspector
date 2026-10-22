/**
 * `<StandardMaterialSlot>`: the reactive adapter that mounts `standardMaterialBags`'s
 * class as the JSX tag R3F prop-diffs, for every StandardMaterial3D-bearing node.
 * It derives nothing: `materialBag.ts` holds the class choice and every mapping,
 * and the imperative `build.ts` reads it too. A scalar-only caller passes `scalars`. Inside a
 * GeometryInstance3D drawer it mounts the unfaded and the alpha-pass bag, which the cull swaps.
 */

import type * as THREE from 'three';
import {
  standardMaterialBags,
  type StandardMaterialBag,
} from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { composeInjections, materialProgramInputs } from '../materialProgramInputs';
import { resolvedTexturesFromMaps, type MaterialTextureMaps } from './materialTextureMaps';
import type { MaterialAttach } from './swappedMaterials';
import { FadedMaterials } from './FadedMaterials';
import { bindHeightmap } from './godotParallax';
import { withPointDraw, type PointDraw } from './godotPoint';
import { bindLightmap, LIGHTMAP_PROGRAM, readsLightmap } from '../lightmap/lightmapProgram';
import type { LightmapAssignment } from '../lightmap/sceneLightmaps';
import { useLightmapAssignment } from '../lightmap/useLightmapAssignment';

/**
 * The texture props are `MaterialTextureMaps`', already bound and paired to their
 * Godot slots. The imperative adapter binds at the same seam, so this component
 * re-decides neither.
 */
export interface StandardMaterialSlotProps extends MaterialTextureMaps {
  scalars: StandardMaterial3DScalars | null;
  /** R3F attach key: `material-0` for multi-surface meshes. */
  attach?: string;
  /** How the material draws the points of a surface that draws `THREE.Points`. */
  pointDraw?: PointDraw;
}

export function StandardMaterialSlot({
  scalars,
  albedoMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  emissiveMap,
  aoMap,
  heightMap,
  anisotropyMap,
  albedoTargetUv,
  attach,
  pointDraw,
}: StandardMaterialSlotProps) {
  const lightmap = useLightmapAssignment();
  // A null `scalars` is the derivation's "no material" case: Godot's default 3D
  // surface, not a default-constructed StandardMaterial3D.
  const bags = standardMaterialBags(
    scalars,
    resolvedTexturesFromMaps({
      albedoMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      emissiveMap,
      aoMap,
      heightMap,
      anisotropyMap,
      albedoTargetUv,
    })
  );

  return (
    <FadedMaterials attach={attach}>
      {(pass, mount) =>
        materialBagElement(withPointDraw(bags[pass], pointDraw), mount, pass === 'unfaded' ? lightmap : null)
      }
    </FadedMaterials>
  );
}

/**
 * A derived bag as its class's JSX tag, reading `lightmap` where it reads one. The missing-texture
 * placeholder mounts through it too.
 */
export function materialBagElement(
  bag: StandardMaterialBag,
  attach: string | MaterialAttach | undefined,
  lightmap: LightmapAssignment | null
) {
  const heightmapTexture = bag.heightmapTexture ?? null;
  const readLightmap =
    lightmap && readsLightmap(bag.materialClass !== 'basic', bag.props.transparent === true)
      ? lightmap
      : null;
  // A ref, not a prop: three's classes have no heightmap or lightmap field, and a rebind needs no
  // remount.
  const binds = (material: THREE.Material | null) => {
    if (!material) return;
    bindHeightmap(material, heightmapTexture);
    bindLightmap(material, readLightmap);
  };
  const injection = composeInjections([bag.injection, readLightmap ? LIGHTMAP_PROGRAM : undefined]);
  // `attach` and the ref first: they are the mount's own props and must never shadow a derived
  // one. The key comes from the same merged bag it travels with (ADR-0038): a program input
  // arriving late, or a moved `attach`, reaches three only through a remount.
  const program = materialProgramInputs({ props: { attach, ref: binds, ...bag.props, injection } });
  switch (bag.materialClass) {
    case 'basic':
      return <meshBasicMaterial key={program.key} {...program.props} />;
    case 'physical':
      return <meshPhysicalMaterial key={program.key} {...program.props} />;
    default:
      return <meshStandardMaterial key={program.key} {...program.props} />;
  }
}
