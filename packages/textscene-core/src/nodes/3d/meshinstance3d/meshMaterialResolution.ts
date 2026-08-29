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
import { descendsFromClass, isNilLiteral } from '../../../godot';
import { isMaterialPath } from '../../../resources/materials/standardmaterial3d/loadMaterial';

/**
 * A resource reference that actually names something, or undefined.
 *
 * `null` is legal in every resource slot and means the slot is empty, but the
 * parser stores the property's TEXT and the string `"null"` is truthy — so a
 * `??` chain over raw refs steps over a cleared slot instead of falling
 * through it.
 */
function heldRef(ref: string | undefined): string | undefined {
  return ref !== undefined && ref !== '' && !isNilLiteral(ref) ? ref : undefined;
}

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
 * Each term falls through on the SOURCE, not on the raw reference: a
 * `Ref<Material>` that does not load is null in Godot too, and the next layer
 * is then what the surface keeps — the same rule `ArrayMeshSurfaces` renders
 * its surfaces by.
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

/**
 * Where a material slot's material comes from: the scene's own
 * `[sub_resource]`, or a `res://` path the pipeline loads.
 *
 * The two channels the renderers fill a slot through, named so one reference
 * can fill either.
 */
export interface MaterialSlotSource {
  /** A StandardMaterial3D declared in this scene, already resolved. */
  readonly subResource?: TscnInternalResource;
  /** A `res://` path to an external material `.tres`. */
  readonly path?: string;
}

/**
 * One authored material reference as a slot source, or `null` when it names
 * nothing this previewer can draw.
 *
 * Shared by every material slot a MeshInstance3D fills: the primitive mesh's
 * single slot above, and `material_override` in the shape `ArrayMeshSurfaces`
 * takes it — that renderer builds its slots off the decoded mesh's surfaces
 * rather than off the node's properties.
 *
 * `null` for a reference that names no material, deliberately: to Godot the
 * property is a `Ref<Material>`, so a reference that does not load as one is
 * null there too, and no override is what the surfaces then keep. Anything
 * else reaches `ExternalMaterialSlot`, whose pipeline builds nothing from a
 * non-material file and paints every surface default white.
 *
 * The `[ext_resource]` heading's declared `type` is what answers it, not the
 * filename: `type="Sky" path="res://sky.tres"` is a `.tres` that is no
 * material. `isMaterialPath` then asks the second question, whether the
 * pipeline can load the file the heading points at.
 *
 * An `ExtResource` is the only reference form that reaches here. A bare
 * `res://…` is not a value this property can hold: unquoted it is an
 * identifier and the file fails to load (`variant_parser.cpp:1619`), quoted it
 * is a STRING, which `can_convert_strict` refuses for an OBJECT slot
 * (`variant.cpp:731-737`), so the write is dropped.
 */
export function resolveMaterialSlotSource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSlotSource | null {
  const held = heldRef(ref);
  if (!held) return null;
  const subResource = resolveStandardMaterial(held, internalResources);
  if (subResource) return { subResource };
  const parsed = parseResourceReference(held);
  if (parsed?.type !== 'ExtResource') return null;
  const declared = externalResources.find((r) => r.id === parsed.id);
  if (!declared) return null;
  // A heading with no `type` at all is hand-written — Godot's saver always
  // writes one (`resource_format_text.cpp:1870`) — so the extension is the only
  // signal left and the lenient parser attempts the override rather than
  // dropping it.
  if (declared.type !== '' && !descendsFromClass(declared.type, 'Material')) return null;
  return isMaterialPath(declared.path) ? { path: declared.path } : null;
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
