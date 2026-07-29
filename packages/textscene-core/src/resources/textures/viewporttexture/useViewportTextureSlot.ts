/**
 * `[sub_resource type="ViewportTexture"] viewport_path = NodePath("…")` — a
 * texture slot filled by whatever a `<SubViewport>` rendered offscreen.
 *
 * Unlike every other texture sub-resource this one resolves to no file and to
 * no rasterisable data: it names a NODE, and the pixels only exist once that
 * node has rendered. That is why it comes through a hook reading the reactive
 * `ViewportTextureRegistry` rather than through `resolveTexture2DPath`, whose
 * `string | null` return type (a `res://` path) structurally cannot carry it.
 *
 * Godot resolves `viewport_path` against the **local scene root**, not against
 * the node holding the texture — `ViewportTexture::_setup_local_to_scene` calls
 * `p_loc_scene->get_node_or_null(path)` where `p_loc_scene` is
 * `get_local_scene()`, and the property is registered with
 * `PROPERTY_USAGE_NODE_PATH_FROM_SCENE_ROOT`. That is exactly why such a
 * resource is always local to its scene (`ViewportTexture::ViewportTexture()`
 * calls `set_local_to_scene(true)` unconditionally, so a `.tscn` need not even
 * write `resource_local_to_scene`).
 */

import type * as THREE from 'three';

import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver.js';
import { useNodePath } from '../../../r3f/contexts/NodePathContext.js';
import { useViewportTexture } from '../../../r3f/contexts/ViewportTextureContext.js';
import {
  resolveViewportTexturePath,
  viewportTextureRegistryKey,
} from '../../../r3f/viewportTexturePath.js';

/** The `type` a ViewportTexture sub-resource declares. */
export const VIEWPORT_TEXTURE_TYPE = 'ViewportTexture';

/**
 * Whether a texture reference names a ViewportTexture — the guard a slot uses
 * to skip the file-loading path, which would otherwise resolve it to null and
 * render a missing-resource placeholder over a viewport that is working fine.
 */
export function isViewportTextureRef(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): boolean {
  return resolveSubResourceRef(ref, internalResources)?.type === VIEWPORT_TEXTURE_TYPE;
}

/**
 * The live target a `ViewportTexture` slot names, or null when the reference is
 * not a ViewportTexture, names no viewport, or names one that has not published
 * yet.
 *
 * Null is not an error: targets arrive after first paint (the publisher's
 * effect runs after mount), so a consumer re-renders into the texture when the
 * reactive registry map updates. Calling this unconditionally keeps the hook
 * count static for slots that may or may not hold one.
 */
export function useViewportTextureSlot(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): THREE.Texture | null {
  const consumerPath = useNodePath();
  const resource = resolveSubResourceRef(ref, internalResources);
  const viewportPath =
    resource?.type === VIEWPORT_TEXTURE_TYPE
      ? resolveViewportTexturePath((resource.data as { viewport_path?: string }).viewport_path)
      : null;
  const key = viewportPath === null ? null : viewportTextureRegistryKey(consumerPath, viewportPath);
  return useViewportTexture(key)?.texture ?? null;
}
