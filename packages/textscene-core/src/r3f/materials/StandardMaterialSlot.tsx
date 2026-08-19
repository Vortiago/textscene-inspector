/**
 * `<StandardMaterialSlot>` — the REACTIVE adapter over the one StandardMaterial3D
 * derivation: it mounts `standardMaterialBag`'s class as the JSX tag R3F needs
 * so it can prop-diff a material across re-renders. Shared by every
 * StandardMaterial3D-bearing node type (MeshInstance3D, CSG primitives, GridMap).
 *
 * It derives nothing of its own. Which material CLASS a feature set needs and
 * every scalar→prop mapping live in `materialBag.ts`, which the imperative
 * adapter (`build.ts`) reads too — a second derivation here is exactly how a
 * rim highlight came to mean one thing in JSX and another in the loader.
 *
 * Scalar-only callers (e.g. CSG nodes whose materials carry no textures) pass
 * just `scalars`; the texture-map props stay undefined and the slot renders a
 * plain scalar material. The texture maps themselves are resolved by the caller
 * via `useResource` (the async path lives in the node component, not here).
 */

import { standardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { materialProgramInputs } from '../materialProgramInputs';
import { textureSlotsFromMaps, type MaterialTextureMaps } from './materialTextureMaps';

/**
 * The texture props are `MaterialTextureMaps`' — already bound, and paired to
 * their Godot slots by the one function that does that. This component
 * re-decides neither: the imperative adapter binds at the same seam, and a slot
 * that corrected textures on arrival would be a second copy of the rule for the
 * two to drift apart on.
 */
export interface StandardMaterialSlotProps extends MaterialTextureMaps {
  scalars: StandardMaterial3DScalars | null;
  /**
   * The underlying mesh type (PlaneMesh, BoxMesh, etc.). Reserved for
   * per-mesh-type culling defaults; currently unused (see git history for the
   * reverted PlaneMesh DoubleSide default).
   */
  meshType?: string;
  /** R3F attach key — `material-0` for multi-surface meshes. */
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
  meshType: _meshType,
  attach,
}: StandardMaterialSlotProps) {
  // A null `scalars` is the derivation's "no material" case — Godot's own
  // default 3D surface, not a default-constructed StandardMaterial3D.
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
  // one. The key comes from the SAME merged bag it travels with (ADR-0038) —
  // a program input arriving late reaches the shader only through a remount.
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
