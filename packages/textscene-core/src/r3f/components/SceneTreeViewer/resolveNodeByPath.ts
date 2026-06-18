/**
 * `resolveNodeByPath` — the inspector's "find one node by its tree path" adapter
 * over the **live scene tree** (`r3f/liveSceneTree.ts`).
 *
 * The traversal itself — Instance root merge / collapse (ADR-0013), per-sub-scene
 * ExtResource scoping, GLB-internal descent, and the slash path scheme — now
 * lives in one place so the tree, viewport, inspector, and panels can't drift
 * apart (the recurring "node inside an instance is invisible" bug). This file
 * stays as the stable entry point + import surface for `NodeDetailsPanel` and its
 * tests; it forwards to `resolveLiveNode`.
 */
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import {
  resolveLiveNode,
  type CachedSceneSource,
  type CachedGlbSource,
} from '../../liveSceneTree';

export type { CachedSceneSource, CachedGlbSource };

export function resolveNodeByPath(
  path: string,
  roots: readonly TscnNode[],
  externalResources: readonly TscnExternalResource[],
  sceneCache: CachedSceneSource,
  glbCache?: CachedGlbSource
): TscnNode | null {
  return resolveLiveNode(path, roots, { externalResources, sceneCache, glbCache });
}
