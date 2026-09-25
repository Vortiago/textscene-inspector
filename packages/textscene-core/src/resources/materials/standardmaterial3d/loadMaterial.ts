/**
 * The `.tres` arrival path: file text → `ParsedResource` → decode → resolved textures →
 * `build.ts`. Nothing here decodes: it resolves the references the shared decode names
 * (ADR-0031). A `[sub_resource]` material takes its own type, while its `ExtResource`
 * ids resolve against the owning file's table, the only scope they exist in.
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
 * The slots this path fetches. Not `anisotropy_flowmap`: Godot stores its strength in
 * alpha and three reads blue, and the repack (`resources/textures/repackFlowmap.ts`) is
 * a canvas readback this layer must not import. The anisotropy scalars still apply.
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
 * Where a built material records the procedural-cache keys it borrowed, for its dispose
 * to hand back. On `userData`, not a side table, as the material is the processor's
 * cache entry: a material that never reaches dispose keeps its pins, which is correct.
 */
const PROCEDURAL_KEYS = 'textsceneProceduralKeys';

/** Loads a texture by its resolved `res://` path; null when it cannot be had. */
export type TextureLoaderFn = (path: string) => Promise<THREE.Texture | null>;

/**
 * Whether a path addresses a file that could hold a material. Several slices read
 * `.tres`, so this is a byte-layer predicate, not a slice claim: the type gate below
 * rejects a `.tres` that turns out to be a TileSet.
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

  // Gate on the shared set, not only the switch's `default`, so a case added here
  // without its type there fails loudly.
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
    // The pins were taken during resolution. A build that produces no material can
    // never hand them back through dispose.
    proceduralKeys.forEach(unpinProceduralTexture);
    throw error;
  }
  if (proceduralKeys.length > 0) material.userData[PROCEDURAL_KEYS] = proceduralKeys;
  return material;
}

/**
 * Hand back every procedural texture this material borrowed, from the material
 * processor's `dispose`. Unpinning is not disposing: the cache owns the pixels and may
 * lend them elsewhere, and eviction reclaims an entry once its last borrower is done.
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
 * Which section of the file to build. `null` means a header-only `.tres` with no
 * `[resource]` section, which warns rather than throws. Leading whitespace is
 * tolerated because the scanning loop trims heading lines.
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
 * Fill every slot the decode kept, resolving against the owning file's tables. An
 * `ExtResource` image goes through the injected loader, all slots in parallel. A
 * `SubResource` of a type with no rasteriser, or a dangling id, leaves its slot empty.
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

    // A procedural `SubResource`, such as a GradientTexture2D, rasterises from the file
    // in hand, as it resolves to no file path.
    const procedural = resolveProceduralTexture(reference, parsed.subResources);
    if (procedural) {
      // Pinned per slot as it resolves: a later slot can insert into the same LRU and
      // evict an earlier one nothing holds yet.
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
 * A header-only `.tres` yields a default-constructed StandardMaterial3D, as in Godot.
 * The same decode builds it from an empty property bag, so "Godot's defaults" has one
 * definition.
 */
function defaultStandardMaterial(): THREE.Material {
  return buildStandardMaterial(parseStandardMaterial3DScalars({}));
}

/**
 * A ShaderMaterial draws the surface Godot binds when a mesh has no usable material
 * (ADR-0041), as its `[sub_resource]` arrival does. No GLSL is compiled, so this is every
 * ShaderMaterial, and the warning carries the diagnosis.
 */
function uncompiledShaderMaterial(): THREE.Material {
  warn(
    "[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface."
  );
  return buildStandardMaterial(null);
}
