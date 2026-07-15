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
