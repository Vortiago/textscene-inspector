/**
 * Parses Godot resource references (`SubResource("id")` / `ExtResource("id")`).
 *
 * Historical note: this module previously also exported `resolveGeometry`
 * and `resolveMaterial` async helpers that the imperative renderer used
 * to turn TSCN references into THREE.BufferGeometry / THREE.Material.
 * Those were deleted along with the imperative path. The R3F
 * components resolve geometry/material synchronously inside their own
 * Component.tsx files using only the parsers from the `meshes` and
 * `materials` folders, so the runtime resolver layer is gone.
 *
 * `parseResourceReference` survives because both R3F MeshInstance3D and
 * R3F WorldEnvironment use it to read raw TSCN property strings.
 */

import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';

export function parseResourceReference(
  ref: string
): { type: 'SubResource' | 'ExtResource'; id: string } | null {
  const subMatch = ref.match(/^SubResource\s*\(\s*"([^"]+)"\s*\)$/);
  if (subMatch && subMatch[1]) {
    return { type: 'SubResource', id: subMatch[1] };
  }

  const extMatch = ref.match(/^ExtResource\s*\(\s*"([^"]+)"\s*\)$/);
  if (extMatch && extMatch[1]) {
    return { type: 'ExtResource', id: extMatch[1] };
  }

  return null;
}

/**
 * Resolve an `ExtResource("id")` reference — or a raw `res://` path, which
 * passes through — to a `res://` path against the scene's external resources.
 * Returns null when the reference matches neither form or the id isn't
 * registered. The shared primitive behind both instance-path and texture-path
 * resolution (Sprite2D/Sprite3D/AnimatedSprite2D/TextureRect all need it).
 */
export function resolveExtResourcePath(
  ref: string | null | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!ref) return null;
  if (ref.startsWith('res://')) return ref;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  return externalResources.find((r) => r.id === parsed.id)?.path ?? null;
}

/**
 * Find a SubResource by id — the `SubResource("id")` counterpart to
 * `resolveExtResourcePath`. Matches both the parser's structural `id` field and
 * the runtime `data.id` key for cross-pipeline compatibility. Pure (React-free)
 * so callers in either the resource layer or R3F components can share it.
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
 * Resolve a raw `SubResource("id")` property string straight to the internal
 * resource it names — `parseResourceReference` + `findSubResource` in one
 * step. Returns undefined for an absent value, a non-SubResource reference
 * (ExtResource / malformed), or an unknown id. Shared by the R3F components
 * that read a sub-resource-valued property (CollisionShape2D/3D `shape`).
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
 * Peel `CanvasTexture` wrappers off a Texture2D reference, down to the first
 * reference that is not one.
 *
 * A `CanvasTexture` is a first-class Texture2D that wraps a `diffuse_texture`
 * (plus normal/specular maps we do not sample); Godot draws that diffuse map,
 * whatever kind of texture it is. Returning the INNER reference rather than a
 * path is what lets the wrapper compose with every other form: an image, or an
 * inline `GradientTexture2D` with no file behind it at all.
 *
 * To FIXED POINT, not a fixed count: a `diffuse_texture` is itself an ordinary
 * Texture2D slot and may name another wrapper, so peeling N levels makes each
 * caller's answer depend on how deep the chain happens to be — and two callers
 * that must agree, the painter's and the layout solve's, then agree only up to
 * the shallower count. Non-wrappers pass through unchanged, so callers apply
 * this unconditionally. A wrapper naming no `diffuse_texture`, or a chain that
 * leads back into itself, returns undefined: neither names anything to draw.
 */
export function unwrapCanvasTextureRef(
  ref: string | null | undefined,
  internalResources: readonly TscnInternalResource[]
): string | undefined {
  let current = ref;
  // Allocated only once a wrapper is actually found — most references are not
  // one and leave on the first pass.
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
 * Resolve a **Texture2D-valued** property to the `res://` path of a FILE to
 * load. Covers the forms of such a slot that name one:
 *
 *   `res://path`        — passes straight through
 *   `ExtResource("id")` — an external image or `.tres`
 *   `SubResource("id")` — a `CanvasTexture`, unwrapped to its `diffuse_texture`
 *
 * `resolveExtResourcePath` alone returns null for the SubResource form, which
 * renders a CanvasTexture-textured node as a missing-resource placeholder.
 *
 * NOT the resolver a node component should reach for. A Texture2D slot can also
 * hold a texture with no file behind it at all — an inline `GradientTexture2D`,
 * described entirely by the scene — and this returns null for every one of
 * those, because there is no path to return. Components ask `useTexture2D` for
 * a texture instead; this is the path-only half it delegates to, useful on its
 * own only where the caller genuinely wants a file path.
 *
 * An `AtlasTexture` deliberately resolves to NULL rather than to its sheet.
 * The sheet's path is a fine thing to load, but this resolver's answer is also
 * read as "how big is this slot" (a Control's minimum size, via the loader
 * cache), and an AtlasTexture is the size of its REGION, never of the sheet.
 * `useTexture2D` unwraps it explicitly and windows the sheet it loads;
 * `inlineTexture2DSize` answers the size half from the region alone.
 */
export function resolveTexture2DPath(
  ref: string | null | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): string | null {
  return resolveExtResourcePath(unwrapCanvasTextureRef(ref, internalResources), externalResources);
}

/**
 * Resolve a Node's `instance` PackedScene reference to a `res://` scene path.
 * Shared by every R3F caller that turns an instance ref into a path:
 * NodeDispatcher's `InstancedSceneSubtree`, the scene tree's
 * `useSubSceneChildren`, and the live-tree `resolveLiveNode`. Distinct from the same-named
 * resolver on ResourceLoader (metadata + logging), which takes different inputs.
 */
export function resolveInstancePath(
  instanceRef: string,
  externalResources: readonly TscnExternalResource[]
): string | null {
  return resolveExtResourcePath(instanceRef, externalResources);
}
