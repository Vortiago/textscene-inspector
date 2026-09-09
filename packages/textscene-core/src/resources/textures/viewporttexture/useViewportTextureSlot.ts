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

import { useEffect, useMemo, useRef } from 'react';
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
  // The consumer's OWNER's table: a `%Name` authored inside an instanced
  // sub-scene is claimed on that sub-scene's root, which is what this node
  // resolves through when it sits there (node.cpp:1930-1938). Only for a slot
  // that holds a ViewportTexture — every texture slot calls this, and the
  // owner walk is per node.
  const claims = useUniqueNameClaims(viewportPath === null ? null : consumerPath);
  // Live paths, not authored ones: the registry is keyed the way the composed
  // render tree spells a path, which is what a claim's `livePath` carries. Only
  // for a slot that holds a ViewportTexture — every texture slot calls this.
  const uniquePaths = useMemo(
    () => (viewportPath !== null && claims ? uniqueNameLivePaths(claims) : undefined),
    [claims, viewportPath]
  );
  const key =
    viewportPath === null
      ? null
      : viewportTextureRegistryKey(consumerPath, viewportPath, uniquePaths);
  // In an effect, not in the render body: a module-level "already reported" set
  // written during render is impure, survives every scene switch — so a literal
  // fixed and re-broken warned once for the life of the session — and grows
  // without bound.
  //
  // The dedup keys on the SPELLING last warned for, held in a ref, not on the
  // effect's dependencies: `uniquePaths` descends from the SceneGraph, which is
  // a fresh object per re-parse, so dependency comparison alone re-fires on
  // every debounced keystroke. The table is re-checked on every run and the
  // marker cleared once the name is claimed, so the same spelling warns again
  // when its claimant is renamed away — the table changed, not the text. Same
  // hazard and same answer as the publisher, which keys on
  // `viewportTextureUniqueNameKey` rather than the node.
  const reported = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!consumerPath || viewportPath === null || !uniquePaths) return;
    const unclaimed = unclaimedUniqueNames(viewportPath, uniquePaths);
    if (unclaimed.length === 0) {
      reported.current = undefined;
      return;
    }
    const spelling = `${consumerPath}\u0000${viewportPath}`;
    if (reported.current === spelling) return;
    reported.current = spelling;
    warn(
      `[ViewportTexture] ${consumerPath}: viewport_path "${viewportPath}" names ${unclaimed.join(', ')}, which no node in this scene claims.`
    );
  }, [consumerPath, viewportPath, uniquePaths]);
  return useViewportTexture(key)?.texture ?? null;
}
