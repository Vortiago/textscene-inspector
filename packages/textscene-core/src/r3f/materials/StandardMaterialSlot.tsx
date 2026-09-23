/**
 * `<StandardMaterialSlot>`: the reactive adapter that mounts `standardMaterialBag`'s
 * class as the JSX tag R3F prop-diffs, for every StandardMaterial3D-bearing node.
 * It derives nothing: `materialBag.ts` holds the class choice and every mapping,
 * and the imperative `build.ts` reads it too. A scalar-only caller passes `scalars`.
 */

import { standardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { materialProgramInputs } from '../materialProgramInputs';
import { textureSlotsFromMaps, type MaterialTextureMaps } from './materialTextureMaps';

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
  const bag = standardMaterialBag(
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

  // `attach` first: it is the mount's own prop and must never shadow a derived
  // one. The key comes from the same merged bag it travels with (ADR-0038): a
  // program input arriving late reaches the shader only through a remount.
  switch (bag.materialClass) {
    case 'basic': {
      const basic = materialProgramInputs({ props: { attach, ...bag.props } });
      return <meshBasicMaterial key={basic.key} {...basic.props} />;
    }
    case 'physical': {
      const physical = materialProgramInputs({ props: { attach, ...bag.props } });
      return <meshPhysicalMaterial key={physical.key} {...physical.props} />;
    }
    default: {
      const standard = materialProgramInputs({ props: { attach, ...bag.props } });
      return <meshStandardMaterial key={standard.key} {...standard.props} />;
    }
  }
}
