/**
 * Turning a MeshInstance3D's authored references into the resources the
 * renderer draws with: which sub-resource (or `.tres` path) the `mesh` names,
 * and which material each surface takes.
 */

import type { MeshInstance3DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { findSubResource } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference, resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { isNilLiteral } from '../../../godot';

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

  // `null` is a legal literal in any resource slot and means no override, so
  // the chain has to fall THROUGH it: the parser stores the property's text,
  // and the string `"null"` is truthy to `??`, which would otherwise drop the
  // mesh's own material for a node that overrides nothing.
  const override = isNilLiteral(properties.materialOverride ?? '')
    ? undefined
    : properties.materialOverride;

  const result: Array<TscnInternalResource | undefined> = new Array(surfaceSlots);
  for (let i = 0; i < surfaceSlots; i++) {
    const ref = override ?? overrides?.get(i) ?? (i === 0 ? meshOwn : undefined);
    result[i] = resolveStandardMaterial(ref, internalResources);
  }
  return result;
}

/**
 * Where an ArrayMesh surface's material comes from: the scene's own
 * `[sub_resource]`, or a `res://` path the pipeline loads.
 *
 * The two channels `ArrayMeshSurfaces` already renders through, named so
 * `material_override` can fill either one for every surface at once.
 */
export interface MaterialSlotSource {
  /** A StandardMaterial3D declared in this scene, already resolved. */
  readonly subResource?: TscnInternalResource;
  /** A `res://` path to an external material `.tres`. */
  readonly path?: string;
}

/**
 * `material_override` as a slot source, or `null` when it names nothing this
 * previewer can draw.
 *
 * `resolveMaterialSubResources` above answers the same question for a PRIMITIVE
 * mesh, whose surface count comes off the override map. An ArrayMesh's surfaces
 * come from the decoded mesh instead, so its material slots are built in
 * `ArrayMeshSurfaces` and need the override in the shape that renderer takes.
 * `render_forward_clustered.cpp:4206` is the precedence it stands ahead of.
 *
 * `null` for a reference that names no material, deliberately: to Godot the
 * property is a `Ref<Material>`, so a reference that does not load as one is
 * null there too, and no override is what the surfaces then keep. That covers
 * both an `ExtResource` this scene never declares and one pointing at a file
 * that is not a material — a `.png` handed to the material pipeline resolves
 * to nothing and would paint every surface default white instead.
 */
export function resolveMaterialOverrideSource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSlotSource | null {
  if (!ref) return null;
  const subResource = resolveStandardMaterial(ref, internalResources);
  if (subResource) return { subResource };
  // `resolveExtResourcePath` also passes a bare `res://…` through, which is a
  // form the property takes.
  const path = resolveExtResourcePath(ref, externalResources);
  return path?.endsWith('.tres') ? { path } : null;
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
