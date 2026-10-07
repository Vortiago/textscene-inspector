/**
 * The imperative adapter over the one StandardMaterial3D derivation (`materialBag.ts`), for
 * a surface with no R3F element, such as a mesh inside a GLB. `<StandardMaterialSlot>` is the
 * reactive one R3F prop-diffs, and neither decodes nor derives anything of its own
 * (ADR-0031). It value-imports `three`, so `index.ts` never imports it.
 */

import * as THREE from 'three';
import { injectProgram } from '../../../r3f/materialProgramInputs';
import type { StandardMaterialBag } from './materialBag';

/**
 * A derived bag's material class as a constructed `THREE.Material`, for a caller that
 * already holds bound textures, such as the GLB surface-material override.
 * `<StandardMaterialSlot>` maps the same classes onto JSX tags (ADR-0039).
 */
export function materialFromBag(bag: StandardMaterialBag): THREE.Material {
  const material = materialOfClass(bag);
  if (bag.injection) injectProgram(material, bag.injection);
  return material;
}

function materialOfClass(bag: StandardMaterialBag): THREE.Material {
  switch (bag.materialClass) {
    case 'basic':
      return new THREE.MeshBasicMaterial(bag.props);
    case 'physical':
      return new THREE.MeshPhysicalMaterial(bag.props);
    default:
      return new THREE.MeshStandardMaterial(bag.props);
  }
}
