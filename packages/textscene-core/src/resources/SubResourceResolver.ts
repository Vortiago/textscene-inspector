/**
 * Parses Godot resource references (`SubResource("id")` / `ExtResource("id")`).
 *
 * Historical note: this module previously also exported `resolveGeometry`
 * and `resolveMaterial` async helpers that the imperative renderer used
 * to turn TSCN references into THREE.BufferGeometry / THREE.Material.
 * WI-R3F-6 deleted those along with the imperative path. The R3F
 * components resolve geometry/material synchronously inside their own
 * Component.tsx files using only the parsers from the `meshes` and
 * `materials` folders, so the runtime resolver layer is gone.
 *
 * `parseResourceReference` survives because both R3F MeshInstance3D and
 * R3F WorldEnvironment use it to read raw TSCN property strings.
 */

import type { TscnExternalResource } from '../parser/types.js';

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
 * Resolve a Node's `instance` PackedScene reference to a `res://` scene path.
 * Shared by every R3F caller that turns an instance ref into a path:
 * NodeDispatcher's `InstancedSceneSubtree`, the scene tree's
 * `useSubSceneChildren`, and `resolveNodeByPath`. Distinct from the same-named
 * resolvers on SceneGraphBuilder (resolves against a scenes map) and
 * ResourceLoader (metadata + logging), which take different inputs.
 */
export function resolveInstancePath(
  instanceRef: string,
  externalResources: readonly TscnExternalResource[]
): string | null {
  return resolveExtResourcePath(instanceRef, externalResources);
}
