/**
 * Resolve a `material = SubResource("id")` reference to its StandardMaterial3D
 * sub-resource. Shared by every StandardMaterial3D-bearing render component
 * (MeshInstance3D, CSGBox3D, CSGCylinder3D) — extracted once it crossed the
 * Rule of Three. Returns undefined for missing/non-SubResource/non-material refs.
 */

import type { TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { findSubResource } from '../SceneResourcesContext';

export function resolveStandardMaterial(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StandardMaterial3D') return undefined;
  return resource;
}
