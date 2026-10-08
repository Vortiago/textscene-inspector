/**
 * `<StandardMaterialSlot>`: the reactive adapter that mounts `standardMaterialBags`'s
 * class as the JSX tag R3F prop-diffs, for every StandardMaterial3D-bearing node.
 * It derives nothing: `materialBag.ts` holds the class choice and every mapping,
 * and the imperative `build.ts` reads it too. A scalar-only caller passes `scalars`. Inside a
 * GeometryInstance3D drawer it mounts the unfaded and the alpha-pass bag, which the cull swaps.
 */

import {
  standardMaterialBags,
  type StandardMaterialBag,
} from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { materialProgramInputs } from '../materialProgramInputs';
import { textureSlotsFromMaps, type MaterialTextureMaps } from './materialTextureMaps';
import type { MaterialAttach } from './swappedMaterials';
import { FadedMaterials } from './FadedMaterials';

/**
 * The texture props are `MaterialTextureMaps`', already bound and paired to their
 * Godot slots. The imperative adapter binds at the same seam, so this component
 * re-decides neither.
 */
export interface StandardMaterialSlotProps extends MaterialTextureMaps {
  scalars: StandardMaterial3DScalars | null;
  /** R3F attach key: `material-0` for multi-surface meshes. */
  attach?: string;
}

export function StandardMaterialSlot({
  scalars,
  albedoMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  emissiveMap,
  aoMap,
  displacementMap,
  anisotropyMap,
  attach,
}: StandardMaterialSlotProps) {
  // A null `scalars` is the derivation's "no material" case: Godot's default 3D
  // surface, not a default-constructed StandardMaterial3D.
  const bags = standardMaterialBags(
    scalars,
    textureSlotsFromMaps({
      albedoMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      emissiveMap,
      aoMap,
      displacementMap,
      anisotropyMap,
    })
  );

  return (
    <FadedMaterials attach={attach}>{(pass, mount) => materialBagElement(bags[pass], mount)}</FadedMaterials>
  );
}

/** A derived bag as its class's JSX tag. The missing-texture placeholder mounts through it too. */
export function materialBagElement(bag: StandardMaterialBag, attach: string | MaterialAttach | undefined) {
  // `attach` first: it is the mount's own prop and must never shadow a derived
  // one. The key comes from the same merged bag it travels with (ADR-0038): a
  // program input arriving late, or a moved `attach`, reaches three only through a remount.
  const program = materialProgramInputs({ props: { attach, ...bag.props, injection: bag.injection } });
  switch (bag.materialClass) {
    case 'basic':
      return <meshBasicMaterial key={program.key} {...program.props} />;
    case 'physical':
      return <meshPhysicalMaterial key={program.key} {...program.props} />;
    default:
      return <meshStandardMaterial key={program.key} {...program.props} />;
  }
}
