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

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';

import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver.js';
import { useNodePath } from '../../../r3f/contexts/NodePathContext.js';
import {
  useUniqueNameClaims,
  useViewportTexture,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import {
  resolveViewportTexturePath,
  viewportTextureRegistryKey,
} from '../../../r3f/viewportTexturePath.js';
import { unclaimedUniqueNames } from '../../../utils/nodePath.js';
import { uniqueNameLivePaths } from '../../../utils/uniqueNames.js';
import { warn } from '../../../logger.js';
import { VIEWPORT_TEXTURE_TYPE } from './types.js';

/**
 * Report a `viewport_path` whose leading `%Name` nothing in the scene claims, in
 * the one case where that is knowable rather than a race.
 *
 * A COMPOUND `%Name/rest` is dead the moment the table lacks the name: a
 * publisher registers its own path and at most its own single-segment `%Name`
 * alias, so no key a consumer can build ever appears and the null is permanent.
 * A BARE `%Name` is left alone — the alias answers it, including for content
 * composed in from an instanced sub-scene, which the authored-tree table has no
 * opinion about, and targets arrive after first paint anyway.
 */
function warnUnclaimedAlias(
  consumerPath: string,
  viewportPath: string,
  uniquePaths: ReadonlyMap<string, string>
): void {
  if (!viewportPath.includes('/')) return;
  const unclaimed = unclaimedUniqueNames(viewportPath, uniquePaths);
  if (unclaimed.length === 0) return;
  warn(
    `[ViewportTexture] ${consumerPath}: viewport_path "${viewportPath}" names ${unclaimed.join(', ')}, which no node in this scene claims.`
  );
}

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
  const claims = useUniqueNameClaims();
  // Live paths, not authored ones: the registry is keyed the way the composed
  // render tree spells a path, which is what a claim's `livePath` carries.
  const uniquePaths = useMemo(() => (claims ? uniqueNameLivePaths(claims) : undefined), [claims]);
  const resource = resolveSubResourceRef(ref, internalResources);
  const viewportPath =
    resource?.type === VIEWPORT_TEXTURE_TYPE
      ? resolveViewportTexturePath((resource.data as { viewport_path?: string }).viewport_path)
      : null;
  const key =
    viewportPath === null
      ? null
      : viewportTextureRegistryKey(consumerPath, viewportPath, uniquePaths);
  // In an effect, not in the render body. A module-level "already reported" set
  // written during render is impure, survives every scene switch — so a literal
  // fixed and re-broken, or the same path in another scene, warned once for the
  // life of the session — and grows without bound. React's own dependency
  // comparison is the dedup, and it is scoped to this consumer's mount.
  useEffect(() => {
    if (consumerPath && viewportPath !== null && uniquePaths) {
      warnUnclaimedAlias(consumerPath, viewportPath, uniquePaths);
    }
  }, [consumerPath, viewportPath, uniquePaths]);
  return useViewportTexture(key)?.texture ?? null;
}
