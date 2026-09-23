/**
 * Where a node's material lives, and how to render it. A material reference is a
 * scene `[sub_resource]` or an `ExtResource` `.tres`, and each needs its own slot
 * component. Every node type with a material reference reads this one choice,
 * since each Godot setter takes a `Ref<Material>` whatever its origin.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { warn } from '../../logger';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { findSubResource } from '../SceneResourcesContext';

export type MaterialSource =
  /** A StandardMaterial3D `[sub_resource]` of the previewed scene. */
  | { kind: 'scene'; resource: TscnInternalResource }
  /** A `res://` path the material pipeline loads. */
  | { kind: 'path'; path: string }
  /**
   * The slot names a Material this previewer cannot build: Godot's default 3D
   * surface (ADR-0041). `undefined` names no material, as Godot's invalid RID
   * does, so an empty slot keeps what it had while this replaces it.
   */
  | { kind: 'default' };

export function resolveMaterialSource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed) return undefined;

  if (parsed.type === 'SubResource') {
    const resource = findSubResource(internalResources, parsed.id);
    if (resource?.type === 'ShaderMaterial') {
      // Declined: the StandardMaterial3D decode would yield a white matte
      // material, not Godot's default surface (ADR-0041). It warns on every
      // reparse, since a scene body has no cache like the `.tres` loader's.
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
      return { kind: 'default' };
    }
    if (!resource || resource.type !== 'StandardMaterial3D') return undefined;
    return { kind: 'scene', resource };
  }

  const ext = externalResources.find((r) => r.id === parsed.id);
  // Only a `.tres` is a material document, which is exactly what the pipeline
  // that would load it accepts (`standardmaterial3d/loadMaterial.ts`'s
  // `isMaterialPath`). Minting an address it must refuse buys a guaranteed-failed
  // load and the same default surface this returns.
  if (!ext?.path || !ext.path.endsWith('.tres')) return undefined;
  return { kind: 'path', path: ext.path };
}
