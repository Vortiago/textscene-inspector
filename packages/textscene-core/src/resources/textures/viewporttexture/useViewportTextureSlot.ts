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
 *
 * CYCLE FALLBACK — the choke point. `useViewportTargetSlot` is the ONE place
 * that turns a registry path into a texture, and every current and future
 * ViewportTexture consumer reaches it (`useViewportTextureSlot` is a thin,
 * ref-resolving wrapper over it; `SubViewportContainer` — which already knows
 * its nested viewport's path directly, with no SubResource ref to resolve —
 * calls it too). `ViewportPassRegistryContext` can find a target's dependency
 * chain unsatisfiable (a cycle): the orchestrator itself never drives that
 * pass, so the registry's entry (if published at all) sits on GPU storage that
 * was never written into — sampling it directly would be a live, uninitialised
 * texture with no visible signal that anything is wrong. `useViewportPassCycle`
 * is this hook's own seam onto that: a cyclic target reports `texture: null`
 * unconditionally (never the raw unwritten one), `cyclic: true`, so every
 * caller can route to ITS OWN missing/placeholder branch instead of silently
 * sampling garbage.
 */

import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';

import * as logger from '../../../logger.js';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver.js';
import { useNodePath } from '../../../r3f/contexts/NodePathContext.js';
import { useViewportPassCycle } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
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

/** What a ViewportTexture slot resolves to, once cycles are accounted for. */
export interface ViewportTextureSlotResult {
  /**
   * The live target's texture. Null when the reference names no
   * ViewportTexture, names one that has not published yet, OR names one
   * whose pass sits in an unrenderable dependency cycle — `cyclic`
   * distinguishes the three; a caller that only checks `texture` treats a
   * cycle exactly like "not published yet" (draws nothing), which is safe
   * but mutes the visible signal a cycle is supposed to give.
   */
  texture: THREE.Texture | null;
  /**
   * True when this slot names a real ViewportTexture whose target's pass is
   * cyclic (`useViewportPassCycle`). The registry may still hold a published
   * entry, but its GPU storage was never written into, which is exactly why
   * `texture` is forced null rather than handing back that entry's raw
   * texture. Callers MUST route a cyclic slot to their own visible
   * missing/placeholder branch, not their "still loading" one.
   */
  cyclic: boolean;
}

/**
 * The choke point every ViewportTexture consumer shares: resolve a registry
 * PATH (not yet a SubResource ref — see `useViewportTextureSlot` for that) to
 * its published texture, folding in the cycle fallback described in this
 * module's doc comment.
 *
 * `warnAs` identifies the caller in the cycle warning (typically its own
 * dispatcher-absolute node path) — pass null to suppress the warning
 * entirely, for a caller that already gets the same fact some other way
 * (`SubViewportContainer` relies on `ViewportPassRegistryContext`'s own
 * cycle-detection warning, which already names this exact path once).
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
 * The live target a `ViewportTexture` slot names, resolved from the
 * SubResource `ref` and rebased onto the registry's dispatcher-absolute key
 * (`viewportTextureRegistryKey`) before delegating to the shared choke point,
 * `useViewportTargetSlot`.
 *
 * `texture: null` with `cyclic: false` is not an error: targets arrive after
 * first paint (the publisher's effect runs after mount), so a consumer
 * re-renders into the texture when the reactive registry map updates. Calling
 * this unconditionally keeps the hook count static for slots that may or may
 * not hold a ViewportTexture.
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
  // Called unconditionally (rules of hooks) — only `key` varies; a null key
  // resolves to the same `{ texture: null, cyclic: false }` shape a slot
  // naming no ViewportTexture always returned.
  return useViewportTargetSlot(key, consumerPath);
}
