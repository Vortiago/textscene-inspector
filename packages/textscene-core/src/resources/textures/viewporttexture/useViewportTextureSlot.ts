/**
 * `[sub_resource type="ViewportTexture"] viewport_path = NodePath("…")`: a texture
 * slot filled by a `<SubViewport>`'s offscreen render. It names a node, not a
 * file, so it comes through the reactive `ViewportTextureRegistry`, not the loader.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type * as THREE from 'three';

import * as logger from '../../../logger.js';
import { useNodePath } from '../../../r3f/contexts/NodePathContext.js';
import { useViewportPassCycle } from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import { useViewportTexture } from '../../../r3f/contexts/ViewportTextureContext.js';
import { useLocalScene } from '../../../r3f/useUniqueNames.js';
import { viewportTextureRegistryKey } from '../../../r3f/viewportTexturePath.js';
import { unclaimedUniqueNames } from '../../../godot/string/nodePath.js';
import { warn } from '../../../logger.js';

/**
 * Which of a target's two views a consumer samples, as Godot's consumer picks it: a canvas item
 * and a raw material slot sample the plain view, and a `source_color` slot the decoding view.
 */
export type ViewportTextureView = 'plain' | 'decoding';

/** What a ViewportTexture slot resolves to, once cycles are accounted for. */
interface ViewportTextureSlotResult {
  /**
   * The live target's view. Null for no ViewportTexture, an unpublished one,
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
 * A registry path to the view of its published target, which every ViewportTexture consumer shares,
 * `SubViewportContainer` included. The orchestrator drives no pass that `ViewportPassRegistryContext`
 * finds cyclic, so a cyclic target is uninitialised and reports `texture: null` with `cyclic: true`.
 * A consumer keeps its view filled while it is mounted.
 *
 * @param warnAs The caller in the cycle warning, usually its node path. Null
 *   suppresses it, as for `SubViewportContainer`, which the context already names.
 */
export function useViewportTargetSlot(
  path: string | null,
  warnAs: string | null,
  view: ViewportTextureView
): ViewportTextureSlotResult {
  const entry = useViewportTexture(path);
  const cycle = useViewportPassCycle(path);
  const cyclic = cycle !== null;

  const sampled = cyclic ? null : (entry?.[view] ?? null);
  // A layout effect, not a passive one: a frame can run between a commit and its passive
  // effects, and the pass fills only a retained copy, so that frame would sample it unfilled.
  useLayoutEffect(() => sampled?.retain(), [sampled]);

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

  return { texture: sampled?.texture ?? null, cyclic };
}

/**
 * The `view` of the live target a set-up `ViewportTexture`'s `viewportPath` names, rebased onto
 * the registry key (`viewportTextureRegistryKey`). `texture: null` with `cyclic: false` is not an
 * error: a target arrives after first paint. Call it unconditionally, so the hook count stays
 * static, with a null path for a slot that is no set-up ViewportTexture.
 */
export function useViewportTextureSlot(
  viewportPath: string | null,
  view: ViewportTextureView
): ViewportTextureSlotResult {
  const consumerPath = useNodePath();
  // `viewport_path` counts from the local scene root: `_setup_local_to_scene` calls
  // `p_loc_scene->get_node_or_null(path)`, `PROPERTY_USAGE_NODE_PATH_FROM_SCENE_ROOT`.
  // The constructor calls `set_local_to_scene(true)`, so a `.tscn` need not write
  // `resource_local_to_scene`. Only for a ViewportTexture slot, since every texture
  // slot calls this and the owner walk is per node.
  const localScene = useLocalScene(viewportPath === null ? null : consumerPath);
  const uniquePaths = localScene?.uniquePaths;
  const key =
    viewportPath === null
      ? null
      : viewportTextureRegistryKey(localScene?.path ?? null, viewportPath, uniquePaths);
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
    // Dedup on the spelling in a ref, not on effect deps: any change to the table
    // re-runs the effect. The marker clears once the name is claimed, so a renamed
    // claimant warns again.
    const spelling = `${consumerPath}\u0000${viewportPath}`;
    if (reported.current === spelling) return;
    reported.current = spelling;
    warn(
      `[ViewportTexture] ${consumerPath}: viewport_path "${viewportPath}" names ${unclaimed.join(', ')}, which no node in this scene claims.`
    );
  }, [consumerPath, viewportPath, uniquePaths]);
  // Called unconditionally for the rules of hooks. A null key resolves to
  // `{ texture: null, cyclic: false }`.
  return useViewportTargetSlot(key, consumerPath, view);
}
