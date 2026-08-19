/**
 * The `.tres` arrival path: file text → `ParsedResource` → decode → resolved
 * textures → `build.ts`.
 *
 * This is the orchestration `resources/processing/materialProcessing.ts` used to
 * do by SNIFFING value shapes — testing each raw property string for a
 * `Color(` / `Vector3(` prefix, `true`/`false`, else `parseFloat` — into a
 * partial typed bag that only eighteen properties were ever read out of. It
 * decoded a different subset than the inline path, gated different flags, and
 * forced transparency from albedo alpha, which Godot does not do. Nothing here
 * decodes: the shared decode owns every property, and this module only resolves
 * the references it names (ADR-0031).
 *
 * The material may be the file's own `[resource]` body OR a `[sub_resource]` of
 * a file that merely carries it (a mesh's per-surface material), which is why
 * the type switch follows the SUB-RESOURCE's type while its `ExtResource` ids
 * still resolve against the owning file's table — the only scope they exist in.
 */

import * as THREE from 'three';
import { warn } from '../../../logger';
import { parseTresFile, type ParsedResource } from '../../../parser/parsedResource';
import { findSubResource, resolveExtResourcePath } from '../../SubResourceResolver';
import { resolveProceduralTexture } from '../../textures/resolveProceduralTexture';
import {
  pinProceduralTexture,
  unpinProceduralTexture,
} from '../../textures/proceduralTextureCache';
import { BUILDABLE_MATERIAL_TYPES } from '../buildableMaterialTypes';
import { buildStandardMaterial } from './build';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextureSlots, TextureSlot } from './types';

/**
 * The slots this path FETCHES.
 *
 * `anisotropy_flowmap` is absent on purpose: Godot stores the per-pixel
 * anisotropy STRENGTH in the alpha channel and three reads it from blue, so the
 * image needs a channel repack before it means anything. That repack is a canvas
 * readback living in the shared applier layer (`resources/textures/repackFlowmap.ts`),
 * which this layer must not import — so an external material's flowmap is not
 * fetched at all rather than sampled wrongly. Its anisotropy SCALARS still
 * apply, which is already the whole effect for a flowmap-less material.
 */
const APPLIED_TEXTURE_SLOTS: readonly TextureSlot[] = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
  'heightmap_texture',
];

/**
 * Where a built material records the procedural-cache keys it borrowed, so its
 * dispose can hand them back. On `userData` rather than in a side table because
 * the material IS the processor's cache entry: the two cannot fall out of step,
 * and a material that never reaches dispose keeps its pins, which is correct.
 */
const PROCEDURAL_KEYS = 'textsceneProceduralKeys';

/** Loads a texture by its resolved `res://` path; null when it cannot be had. */
export type TextureLoaderFn = (path: string) => Promise<THREE.Texture | null>;

/**
 * Whether a path addresses a file that could hold a material. Several slices
 * claim `.tres`, so this stays a byte-layer predicate rather than a slice claim:
 * a `.tres` reaching the material processor may still turn out to be a TileSet,
 * which the type gate below rejects.
 */
export function isMaterialPath(path: string): boolean {
  return path.endsWith('.tres');
}

/**
 * Build a `THREE.Material` from `.tres` file content.
 *
 * @param content - the `.tres` text
 * @param loadTexture - resolves a texture by `res://` path; omit for materials
 *   whose texture slots should stay empty
 * @param subResourceId - build this `[sub_resource id="…"]` instead of the
 *   file's own `[resource]` body
 */
export async function createMaterialFromContent(
  content: string,
  loadTexture?: TextureLoaderFn,
  subResourceId?: string
): Promise<THREE.Material> {
  // Throws when the [gd_resource] header is absent or typeless.
  const parsed = parseTresFile(content);
  const body = materialBody(parsed, content, subResourceId);
  if (body === null) return defaultStandardMaterial();

  // Gate on the shared set rather than only on the switch's `default`, so a case
  // added here without adding its type there fails loudly instead of becoming a
  // type producers still refuse to address.
  if (!BUILDABLE_MATERIAL_TYPES.has(body.type)) {
    throw new Error(`Unsupported material type: ${body.type}`);
  }

  if (body.type === 'ShaderMaterial') return uncompiledShaderMaterial();

  const scalars = parseStandardMaterial3DScalars(body.properties);
  const { textures, proceduralKeys } = await resolveTextureSlots(
    scalars.textureSlots,
    parsed,
    loadTexture
  );
  let material: THREE.Material;
  try {
    material = buildStandardMaterial(scalars, textures);
  } catch (error) {
    // The pins were taken during resolution; a build that never produces a
    // material can never hand them back through dispose.
    proceduralKeys.forEach(unpinProceduralTexture);
    throw error;
  }
  if (proceduralKeys.length > 0) material.userData[PROCEDURAL_KEYS] = proceduralKeys;
  return material;
}

/**
 * Hand back every procedural texture this material borrowed. Called from the
 * material processor's `dispose`, which is the only place that knows the
 * material is finished with.
 *
 * Unpinning is NOT disposing: the cache owns the pixels and may still be lending
 * them to another material or to a mounted component. All this says is that one
 * borrower is done, which is what lets capacity eviction reclaim the entry once
 * the last one is.
 */
export function releaseProceduralTextures(material: THREE.Material): void {
  const keys = material.userData[PROCEDURAL_KEYS];
  if (!Array.isArray(keys)) return;
  (keys as string[]).forEach(unpinProceduralTexture);
  delete material.userData[PROCEDURAL_KEYS];
}

interface MaterialBody {
  type: string;
  properties: Record<string, string>;
}

/**
 * Which section of the file to build. `null` means "a header-only `.tres`" — no
 * `[resource]` section at all, which is valid enough to warn about rather than
 * throw. Leading whitespace is tolerated because the scanning loop trims
 * heading lines.
 */
function materialBody(
  parsed: ParsedResource,
  content: string,
  subResourceId: string | undefined
): MaterialBody | null {
  if (subResourceId !== undefined) {
    const sub = findSubResource(parsed.subResources, subResourceId);
    if (!sub) {
      // An address naming a sub-resource the file does not declare is as
      // unresolvable as a missing file, and reaches the consumer the same way:
      // cached as a failure, so the slot renders its neutral default.
      throw new Error(
        `Sub-resource "${subResourceId}" is not declared in this ${parsed.resourceType} .tres`
      );
    }
    return { type: sub.type, properties: sub.data as Record<string, string> };
  }
  if (!/^[ \t]*\[resource\b/m.test(content)) {
    warn(
      `[material] .tres has no [resource] section (type="${parsed.resourceType}") — using default StandardMaterial3D.`
    );
    return null;
  }
  return { type: parsed.resourceType, properties: parsed.properties };
}

interface ResolvedSlots {
  textures: ResolvedTextureSlots;
  /** Procedural-cache keys pinned for this material; released on its dispose. */
  proceduralKeys: string[];
}

/**
 * Fill every slot the decode kept, from the two kinds of reference a material
 * file can carry — both resolved against the OWNING FILE's tables, which is the
 * only scope their ids exist in.
 *
 * A `SubResource` naming a PROCEDURAL texture is rasterised synchronously: it is
 * described entirely by the file in hand (the texture block plus the `Gradient`
 * it references), so there is nothing to fetch. This is what lets a material
 * `.tres` carry its own gradient — `[sub_resource type="GradientTexture2D"]`
 * beside the `[resource]` body — which the ExtResource-only path dropped on the
 * floor, since such a reference resolves to no file path.
 *
 * An `ExtResource` names an image file and goes through the injected loader, all
 * slots in parallel. Anything else — a `SubResource` of a type with no
 * rasteriser (`NoiseTexture2D`, `CanvasTexture`), a dangling id — leaves its slot
 * empty.
 *
 * Procedural textures are BORROWED from a shared, capacity-bounded cache, so
 * each one is pinned the moment it resolves. Pinning per slot rather than in one
 * pass afterwards matters: resolving a later slot can insert into the same LRU
 * and evict an earlier one that nothing is holding yet.
 */
async function resolveTextureSlots(
  slots: Readonly<Partial<Record<TextureSlot, string>>>,
  parsed: ParsedResource,
  loadTexture: TextureLoaderFn | undefined
): Promise<ResolvedSlots> {
  const textures: ResolvedTextureSlots = {};
  const proceduralKeys: string[] = [];
  const requests: Promise<[TextureSlot, THREE.Texture | null]>[] = [];

  for (const slot of APPLIED_TEXTURE_SLOTS) {
    const reference = slots[slot];
    if (reference === undefined) continue;

    const procedural = resolveProceduralTexture(reference, parsed.subResources);
    if (procedural) {
      pinProceduralTexture(procedural.key);
      proceduralKeys.push(procedural.key);
      textures[slot] = procedural.texture;
      continue;
    }

    if (!loadTexture) continue;
    const path = resolveExtResourcePath(reference, parsed.extResources);
    if (path === null) continue;
    requests.push(loadTexture(path).then((texture) => [slot, texture]));
  }

  for (const [slot, texture] of await Promise.all(requests)) textures[slot] = texture;
  return { textures, proceduralKeys };
}

/**
 * A header-only `.tres` yields a default-constructed StandardMaterial3D — which
 * is what Godot's own `[gd_resource type="StandardMaterial3D"]` with no body
 * describes. Built through the same decode as everything else, from an empty
 * property bag, so "Godot's defaults" has one definition.
 */
function defaultStandardMaterial(): THREE.Material {
  return buildStandardMaterial(parseStandardMaterial3DScalars({}));
}

/**
 * We compile no GLSL (ADR-0041), so a ShaderMaterial draws the surface Godot
 * itself binds when a mesh has no usable material. Same surface its
 * `[sub_resource]` arrival draws — the engine cannot tell the two apart, so
 * neither may we — and the warning below carries the diagnosis instead of the
 * pixels.
 */
function uncompiledShaderMaterial(): THREE.Material {
  warn(
    "[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface."
  );
  return buildStandardMaterial(null);
}
