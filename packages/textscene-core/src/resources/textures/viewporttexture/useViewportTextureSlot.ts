/**
 * `[sub_resource type="ViewportTexture"] viewport_path = NodePath("…")`: a texture
 * slot filled by a `<SubViewport>`'s offscreen render. It names a node, not a
 * file, so it comes through the reactive `ViewportTextureRegistry`, not
 * `resolveTexture2DPath`, whose `string | null` cannot carry it.
 */

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

import * as logger from '../../../logger.js';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver.js';
import { useNodePath } from '../../../r3f/contexts/NodePathContext.js';
import { useViewportPassCycle } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import {
  useUniqueNamePaths,
  useViewportTexture,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import {
  resolveViewportTexturePath,
  viewportTextureRegistryKey,
} from '../../../r3f/viewportTexturePath.js';
import { unclaimedUniqueNames } from '../../../utils/nodePath.js';
import { warn } from '../../../logger.js';
import { VIEWPORT_TEXTURE_TYPE } from './types.js';

/**
 * Whether a texture reference names a ViewportTexture: the guard that skips the
 * file-loading path, which would draw a missing-resource placeholder instead.
 */
export function isViewportTextureRef(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): boolean {
  return resolveSubResourceRef(ref, internalResources)?.type === VIEWPORT_TEXTURE_TYPE;
}

/** What a ViewportTexture slot resolves to, once cycles are accounted for. */
export interface ViewportTextureSlotResult {
  /**
   * The live target's texture. Null for no ViewportTexture, an unpublished one,
   * or one in an unrenderable pass cycle, which `cyclic` tells apart. A caller
   * that checks only `texture` draws nothing for a cycle: safe, but silent.
   */
  texture: THREE.Texture | null;
  /**
   * True when the named target's pass is cyclic (`useViewportPassCycle`). Its GPU
   * storage was never written, so `texture` is null. A caller routes a cyclic slot
   * to its own visible placeholder branch, not its "still loading" one.
   */
  cyclic: boolean;
}

/**
 * The choke point every ViewportTexture consumer shares, `SubViewportContainer`
 * included: a registry path to its published texture. The orchestrator never
 * drives a pass that `ViewportPassRegistryContext` finds cyclic, so its target is
 * uninitialised and this reports `texture: null` with `cyclic: true`.
 *
 * @param warnAs The caller in the cycle warning, usually its node path. Null
 *   suppresses it, as for `SubViewportContainer`, which the context already names.
 */
export function useViewportTargetSlot(
  path: string | null,
  warnAs: string | null
): ViewportTextureSlotResult {
  const entry = useViewportTexture(path);
  const cycle = useViewportPassCycle(path);
  const cyclic = cycle !== null;

  const lastWarnedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!cyclic || path === null || warnAs === null) {
      lastWarnedKey.current = null;
      return;
    }
    const key = `${warnAs}->${path}`;
    if (lastWarnedKey.current === key) return;
    lastWarnedKey.current = key;
    logger.warn(
      `[Viewport] ${warnAs} falls back to its own placeholder — its ViewportTexture target ${path} sits in an unrenderable pass cycle`
    );
  }, [cyclic, path, warnAs]);

  return { texture: cyclic ? null : entry?.texture ?? null, cyclic };
}

/**
 * The live target a `ViewportTexture` slot's `ref` names, rebased onto the
 * registry key (`viewportTextureRegistryKey`). `texture: null` with `cyclic: false`
 * is not an error: a target arrives after first paint. Call it unconditionally,
 * so the hook count stays static.
 */
export function useViewportTextureSlot(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ViewportTextureSlotResult {
  const consumerPath = useNodePath();
  const resource = resolveSubResourceRef(ref, internalResources);
  const viewportPath =
    resource?.type === VIEWPORT_TEXTURE_TYPE
      ? resolveViewportTexturePath((resource.data as { viewport_path?: string }).viewport_path)
      : null;
  // The owner's table: a `%Name` inside an instanced sub-scene is claimed on its
  // root (node.cpp:1930-1938). Only for a ViewportTexture slot, since every
  // texture slot calls this and the owner walk is per node.
  const uniquePaths = useUniqueNamePaths(viewportPath === null ? null : consumerPath);
  // `viewport_path` counts from the local scene root: `_setup_local_to_scene` calls
  // `p_loc_scene->get_node_or_null(path)`, `PROPERTY_USAGE_NODE_PATH_FROM_SCENE_ROOT`.
  // The constructor calls `set_local_to_scene(true)`, so a `.tscn` need not write
  // `resource_local_to_scene`.
  const key =
    viewportPath === null
      ? null
      : viewportTextureRegistryKey(consumerPath, viewportPath, uniquePaths);
  // In an effect, not the render body: a module-level set written during render
  // is impure, survives every scene switch and grows without bound.
  const reported = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!consumerPath || viewportPath === null || !uniquePaths) return;
    const unclaimed = unclaimedUniqueNames(viewportPath, uniquePaths);
    if (unclaimed.length === 0) {
      reported.current = undefined;
      return;
    }
    // Dedup on the spelling in a ref, not on effect deps: `uniquePaths` is a fresh
    // object per re-parse. The marker clears once the name is claimed, so a renamed
    // claimant warns again, as the publisher's `viewportTextureUniqueNameKey` does.
    const spelling = `${consumerPath}\u0000${viewportPath}`;
    if (reported.current === spelling) return;
    reported.current = spelling;
    warn(
      `[ViewportTexture] ${consumerPath}: viewport_path "${viewportPath}" names ${unclaimed.join(', ')}, which no node in this scene claims.`
    );
  }, [consumerPath, viewportPath, uniquePaths]);
  // Called unconditionally for the rules of hooks. A null key resolves to
  // `{ texture: null, cyclic: false }`.
  return useViewportTargetSlot(key, consumerPath);
}
