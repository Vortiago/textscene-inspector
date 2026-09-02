/**
 * Turning a MeshInstance3D's authored references into the resources the
 * renderer draws with: which sub-resource (or `.tres` path) the `mesh` names,
 * and which material each surface takes.
 */

import type { MeshInstance3DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { resolveMaterialSlotSource } from '../../../r3f/materials/materialSlotSource';
import type { MaterialSlotSource } from '../../../r3f/materials/materialSlotSource';

export { resolveMaterialSlotSource } from '../../../r3f/materials/materialSlotSource';
export type { MaterialSlotSource } from '../../../r3f/materials/materialSlotSource';

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
 * The material a PRIMITIVE mesh renders with — one slot, because a
 * PrimitiveMesh has exactly one surface (`primitive_meshes.cpp:141-147`).
 * `null` when nothing this previewer can draw fills it.
 *
 * `surface_material_override/N` for N > 0 is therefore not a slot at all:
 * `_mesh_changed` sizes `surface_override_materials` to the mesh's surface
 * count (`mesh_instance_3d.cpp:407`) and `_set` returns false for
 * `idx >= surface_override_materials.size()` (`mesh_instance_3d.cpp:68`), so
 * Godot drops the write and draws the whole mesh with slot 0.
 *
 * `material_override` wins over BOTH the per-surface override and the mesh's
 * own material, which is the order the renderer resolves in:
 * `_geometry_instance_add_surface` takes `material_override` ahead of the
 * material handed to it (`render_forward_clustered.cpp:4206`), and the caller
 * already chose `surface_materials[j]` over the mesh's own
 * (`render_forward_clustered.cpp:4267`).
 *
 * Each term falls through on whether GODOT would fill the slot, not on whether
 * this previewer can draw what fills it. A `Ref<Material>` that does not load
 * is null in Godot too and the next layer is then what the surface keeps; a
 * material that loads there but that nothing here draws still OCCUPIES the
 * slot, so it ends the chain and the surface renders the default rather than
 * the layer below — the same rule `ArrayMeshSurfaces` renders its surfaces by.
 */
export function resolvePrimitiveMaterialSlot(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSlotSource | null {
  const source = (ref: string | undefined) =>
    resolveMaterialSlotSource(ref, internalResources, externalResources);
  return (
    source(properties.materialOverride) ??
    source(properties.surfaceMaterialOverrides?.get(0)) ??
    source(findMeshOwnMaterial(properties.mesh, internalResources))
  );
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
