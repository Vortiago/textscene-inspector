/**
 * Turning a MeshInstance3D's authored references into the resources the
 * renderer draws with: which sub-resource (or `.tres` path) the `mesh` names,
 * and which material each surface takes.
 */

import type { MeshInstance3DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';

export function resolveMeshSubResource(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  return findSubResource(internalResources, parsed.id);
}

/**
 * Resolve an `ExtResource("id")` `mesh` reference to the `.tres` path of an
 * external ArrayMesh. Returns null for SubResource refs (handled inline),
 * non-`.tres` ExtResources (e.g. `.glb`, handled by the placeholder), or
 * unknown ids.
 */
export function resolveExtArrayMeshPath(
  meshRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!meshRef) return null;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  if (!ext?.path || !ext.path.endsWith('.tres')) return null;
  return ext.path;
}

/**
 * Resolve the material(s) the mesh should render with. Returns an array
 * indexed by surface — element 0 always corresponds to surface 0.
 * Single-surface meshes return a length-1 array; multi-surface meshes
 * return a length-N array with `undefined` for unpopulated slots (the
 * caller's SecondarySurfaceMaterial renders a default placeholder).
 *
 * `material_override` wins over BOTH the per-surface override and the mesh's
 * own material, on EVERY surface, which is the order the renderer resolves in:
 * `_geometry_instance_add_surface` takes `material_override` ahead of the
 * material handed to it (`render_forward_clustered.cpp:4206`), and the caller
 * already chose `surface_materials[j]` over the mesh's own
 * (`render_forward_clustered.cpp:4267`). The per-surface override is therefore
 * only reachable while `material_override` is unset.
 */
export function resolveMaterialSubResources(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[]
): Array<TscnInternalResource | undefined> {
  const overrides = properties.surfaceMaterialOverrides;
  const surfaceSlots =
    overrides && overrides.size > 0
      ? Math.max(...Array.from(overrides.keys()), 0) + 1
      : 1;

  // Slot 0 alone falls back to the mesh's own material: a primitive mesh
  // declares one `material`, which is surface 0's.
  const meshOwn = findMeshOwnMaterial(properties.mesh, internalResources);

  const result: Array<TscnInternalResource | undefined> = new Array(surfaceSlots);
  for (let i = 0; i < surfaceSlots; i++) {
    const ref =
      properties.materialOverride ?? overrides?.get(i) ?? (i === 0 ? meshOwn : undefined);
    result[i] = resolveStandardMaterial(ref, internalResources);
  }
  return result;
}

function findMeshOwnMaterial(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): string | undefined {
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const meshResource = findSubResource(internalResources, parsed.id);
  const material = meshResource?.data?.['material'];
  return typeof material === 'string' ? material : undefined;
}
