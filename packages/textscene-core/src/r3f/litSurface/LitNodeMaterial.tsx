/**
 * Mounts a covered surface's lit node material (`litSurfaceMaterial.ts`) as R3F's `primitive`, so
 * R3F diffs the bag's fields onto it as it diffs a classic material's props.
 */

import { useEffect, useState } from 'react';
import type { MaterialAttach } from '../materials/swappedMaterials';
import type { LitSurfaceMaterial } from './litSurfaceMaterial';

interface LitNodeMaterialProps {
  /** Mount it under `lit.key`: a new program needs a new material. */
  lit: LitSurfaceMaterial;
  attach: string | MaterialAttach | undefined;
}

export function LitNodeMaterial({ lit, attach }: LitNodeMaterialProps) {
  const [material] = useState(() => lit.create());
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach={attach} {...lit.fields} />;
}
