/**
 * Parses Godot resource references (`SubResource("id")`, `ExtResource("id")`) and
 * resolves them against the scene's resource tables. An R3F component resolves
 * geometry and material itself, through the parsers in `meshes/` and `materials/`.
 */

import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resourceRef, simplifyResPath } from '../godot/index.js';

export function parseResourceReference(
  ref: string
): { type: 'SubResource' | 'ExtResource'; id: string } | null {
  const parsed = resourceRef(ref);
  return parsed ? { type: parsed.kind, id: parsed.id } : null;
}

/**
 * Resolve an `ExtResource("id")` reference, or a raw `res://` path that passes
 * through, to a `res://` path. Null when the reference matches neither form or
 * the id is not registered.
 */
export function resolveExtResourcePath(
  ref: string | null | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!ref) return null;
  // Simplified on the way out, both arms: Godot runs every resource address
  // through `String::simplify_path`, and a real scene writes the redundant
  // slashes it collapses (`res:///addons/...`).
  if (ref.startsWith('res://')) return simplifyResPath(ref);
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const path = externalResources.find((r) => r.id === parsed.id)?.path;
  return path === undefined ? null : simplifyResPath(path);
}

/**
 * Find a SubResource by id. It matches both the parser's structural `id` field and
 * the runtime `data.id` key, since both pipelines call it.
 */
export function findSubResource(
  internalResources: readonly TscnInternalResource[],
  id: string
): TscnInternalResource | undefined {
  return internalResources.find((r) => {
    const dataId = (r.data as { id?: string }).id;
    return dataId === id || String(r.id) === id;
  });
}

/**
 * Resolve a raw `SubResource("id")` property string to the internal resource it
 * names. Undefined for an absent value, a reference of another form, or an unknown id.
 */
export function resolveSubResourceRef(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  return findSubResource(internalResources, parsed.id);
}

/**
 * Peel `CanvasTexture` wrappers off a Texture2D reference, to fixed point, down to
 * the inner `diffuse_texture` reference Godot draws. The reference, not a path, lets
 * it compose with an image or an inline `GradientTexture2D`. A wrapper with no
 * `diffuse_texture`, or a cycle, returns undefined: neither names anything to draw.
 */
export function unwrapCanvasTextureRef(
  ref: string | null | undefined,
  internalResources: readonly TscnInternalResource[]
): string | undefined {
  let current = ref;
  // Fixed point, not a fixed count: a painter and a layout solve that peel N levels
  // agree only up to the shallower chain. Applying it twice changes nothing. `peeled`
  // is allocated only on the first wrapper, since most references are not one.
  let peeled: Set<string> | undefined;
  while (current) {
    if (peeled?.has(current)) return undefined;
    const sub = resolveSubResourceRef(current, internalResources);
    if (sub?.type !== 'CanvasTexture') return current;
    (peeled ??= new Set()).add(current);
    const diffuse = (sub.data as { diffuse_texture?: unknown }).diffuse_texture;
    current = typeof diffuse === 'string' ? diffuse : undefined;
  }
  return undefined;
}

/**
 * The text-resource (`.tres`, `.res`) path an `ExtResource` reference names, which
 * the caller parses to learn what it holds. Null for any other form. Any text
 * resource, not only an atlas: the texture bus never decodes one, and
 * `decodeExtAtlasTextureRef` declines the non-atlases.
 */
export function resolveExtAtlasTexturePath(
  ref: string | null | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const resource = externalResources.find((r) => r.id === parsed.id);
  if (!resource) return null;
  // The `[ext_resource]` `type=` cannot gate this: Godot writes it from the property
  // slot, so an AtlasTexture in a `texture` slot is recorded `type="Texture2D"`.
  // It lives here, not in the atlastexture slice, which imports this module.
  return isTextResourcePath(resource.path) ? resource.path : null;
}

/** A Godot text-resource file, which carries its own `[gd_resource type=]` header. */
function isTextResourcePath(path: string): boolean {
  return /\.(tres|res)$/i.test(path);
}

/**
 * Resolve a **Texture2D-valued** property (`res://path`, `ExtResource("id")`, or a
 * `SubResource("id")` CanvasTexture) to the path of a file to load. A node component
 * asks `useTexture2D` instead: this returns null for a texture with no file, such as
 * an inline `GradientTexture2D`.
 */
export function resolveTexture2DPath(
  ref: string | null | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): string | null {
  const unwrapped = unwrapCanvasTextureRef(ref, internalResources);
  // An AtlasTexture, inline or `.tres`, resolves to null, not its sheet: this answer
  // also sizes a Control's slot, and an atlas is the size of its region.
  // `inlineTexture2DSize` and `extResourceAtlasTextureSize` answer that size.
  if (resolveExtAtlasTexturePath(unwrapped, externalResources)) return null;
  return resolveExtResourcePath(unwrapped, externalResources);
}

/** Resolve a Node's `instance` PackedScene reference to a `res://` scene path. */
export function resolveInstancePath(
  instanceRef: string,
  externalResources: readonly TscnExternalResource[]
): string | null {
  return resolveExtResourcePath(instanceRef, externalResources);
}
