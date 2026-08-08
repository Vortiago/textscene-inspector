/**
 * The material a multi-surface mesh attaches at `material-N` for N > 0.
 * Surface 0 goes through `<StandardMaterialSlot>` like a single-surface mesh.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveEmission } from '../../../resources/materials/standardmaterial3d/emission';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import { materialBlendProps } from '../../../resources/materials/standardmaterial3d/build';

interface SecondarySurfaceMaterialProps {
  attach: string;
  subResource: TscnInternalResource | undefined;
  shadowSide?: THREE.Side;
}

/**
 * Material attached at `material-N` (N > 0) for multi-surface meshes.
 *
 * Scalar properties only — texture slots are unwired, not unreachable. This is a
 * component rendered once per surface, so it may call `useResource` itself, as
 * `ExternalMaterialSlot` does for the external-ArrayMesh path.
 */
export function SecondarySurfaceMaterial({
  attach,
  subResource,
  shadowSide,
}: SecondarySurfaceMaterialProps) {
  if (!subResource) {
    return (
      <meshStandardMaterial
        attach={attach}
        color={0xcccccc}
        metalness={0.3}
        roughness={0.7}
        shadowSide={shadowSide ?? null}
      />
    );
  }
  const scalars = parseStandardMaterial3DScalars(
    subResource.data as Record<string, string>
  );
  // Through the same resolution slot 0 uses, so one mesh cannot show two results
  // for the same material. These slots never load a texture (see above), which is
  // exactly the case where `emission_operator = MULTIPLY` collapses to no emission
  // at all — Godot's absent sampler reads black.
  const emission = resolveEmission(scalars, scalars.emissionOperator, false);
  return (
    <meshStandardMaterial
      attach={attach}
      color={scalars.color}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={scalars.transparent}
      opacity={scalars.opacity}
      {...materialBlendProps(scalars)}
      depthTest={scalars.depthTest}
      side={scalars.side}
      shadowSide={shadowSide ?? null}
      emissive={emission.emissive}
      emissiveIntensity={emission.emissiveIntensity}
    />
  );
}
