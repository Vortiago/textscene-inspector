/**
 * The one gate an authored material reference passes through before it fills a
 * slot: whether GODOT would fill the slot from it, and with what. Every renderer
 * that takes a `Ref<Material>` from a `.tscn` resolves through here, so one
 * authored mistake draws the same thing on a primitive, an ArrayMesh surface, a
 * CSG solid and a GLB override.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { findSubResource } from '../SceneResourcesContext';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { resolveStandardMaterial } from './resolveStandardMaterial';
import { descendsFromClass, isNilLiteral } from '../../godot';
import { isMaterialPath } from '../../resources/materials/standardmaterial3d/loadMaterial';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';

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
 * A slot Godot fills with a material this previewer cannot build.
 *
 * Neither channel is set, which is the shape `ExternalMaterialSlot` already
 * paints its default white for. It is a SOURCE rather than a `null` because the
 * distinction the chain turns on is whether the ENGINE fills the slot: an
 * ORMMaterial3D or a ShaderMaterial loads there perfectly well, so nothing
 * below it is reachable, and falling through would draw the layer Godot hides.
 */
const UNDRAWABLE_MATERIAL: MaterialSlotSource = {};

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
  if (!parsed) return null;
  if (parsed.type === 'SubResource') {
    // Reached only once `resolveStandardMaterial` has declined, so the
    // sub-resource is either absent or some other class. Absent is null in
    // Godot too; any other Material subclass — ORMMaterial3D, ShaderMaterial —
    // loads there and fills the slot, and only the drawing of it is missing.
    const declared = findSubResource(internalResources, parsed.id);
    if (!declared) return null;
    return descendsFromClass(declared.type, 'Material') ? UNDRAWABLE_MATERIAL : null;
  }
  if (parsed.type !== 'ExtResource') return null;
  const declared = externalResources.find((r) => r.id === parsed.id);
  if (!declared) return null;
  // A heading with no `type` at all is hand-written — Godot's saver always
  // writes one (`resource_format_text.cpp:1870`) — so the extension is the only
  // signal left and the lenient parser attempts the override rather than
  // dropping it.
  if (declared.type !== '' && !descendsFromClass(declared.type, 'Material')) return null;
  // The heading says a material; whether the pipeline can BUILD one from the
  // file it points at decides between drawing it and drawing the default, never
  // between filling the slot and leaving it open.
  return isMaterialPath(declared.path) ? { path: declared.path } : UNDRAWABLE_MATERIAL;
}


/**
 * A slot source as the scalar-only renderers draw it: the scene material's
 * decoded scalars, or the `res://` path the pipeline loads, or neither for a
 * slot Godot fills with something this previewer cannot build (or leaves empty),
 * which `StandardMaterialSlot` paints as the default shader.
 */
export function scalarSlotFor(source: MaterialSlotSource | null): {
  scalars: StandardMaterial3DScalars | null;
  externalPath: string | null;
} {
  if (source?.subResource) {
    return {
      scalars: parseStandardMaterial3DScalars(source.subResource.data as Record<string, string>),
      externalPath: null,
    };
  }
  return { scalars: null, externalPath: source?.path ?? null };
}
