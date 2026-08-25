/**
 * Which sub-viewports are published from the native Control-raster pass
 * (`ControlRasterPass.tsx`) rather than from the 3D/2D offscreen pass, and in
 * which resource scope their Controls resolve.
 *
 * `viewportContentKind` already decides the OWNERSHIP split — the offscreen
 * publisher takes `'3d'` and `'2d'`, this path takes `'dom'` (Controls have no
 * WebGL SOURCE of their own to render, though the native pipeline draws them as
 * ordinary three.js objects once handed a subtree). What that classifier
 * cannot answer is where the sub-viewport SITS: the registry is keyed by
 * dispatcher-absolute node path, and the Controls beneath it resolve
 * ExtResource/SubResource ids against the scene they were AUTHORED in, which is
 * not the host scene once an instance is in the way (ADR-0009, ADR-0013). The
 * committed corpus makes that concrete: `gui_in_3d.tscn` instances
 * `gui_panel_3d.tscn`, whose `TextureRect` names `ExtResource("2")` — an id the
 * host scene never defines.
 *
 * The instance-collapse and per-sub-scene scoping is `liveSceneTree.ts`'s
 * `liveChildGroups` — the SAME primitive `useBuildSolveTree`'s own live-tree
 * walk is built on — so this walk only decides WHICH group a Control-raster
 * viewport sits in and pairs it with that group's already-resolved scope,
 * rather than re-deriving instance-collapse/scope rules by hand: a collapsed
 * single-root instance puts ALL its children in the sub-scene's scope; a
 * multi-root one keeps the instance node, its authored children in the outer
 * scope and the loaded roots in the sub-scene's.
 *
 * Pure (no React, no THREE, no DOM) so the path/scope rules are asserted
 * directly — the rasterisation half needs a real renderer and is gated by
 * `pnpm test:visual`'s golden images.
 */

import type { TscnNode } from '../../../parser/types.js';
import { liveChildGroups, type SceneScope } from '../../../r3f/liveSceneTree.js';
import { joinPath } from '../../../utils/nodePath.js';
import { isViewportBoundary } from './viewportBoundary.js';
import { resolveViewportSubtree, viewportContentKind } from './viewportContent.js';
import type { SubViewportProperties } from './types.js';

/**
 * Read surface for the loader's PackedScene cache. Structural rather than the
 * concrete `ResourceLoader`, so the walk stays pure and a test supplies a map.
 * Every cached scene carries BOTH resource pools, so this satisfies
 * `liveChildGroups`' `CachedSceneSource` surface without an adapter.
 */
export interface SceneScopeSource {
  getCached: (path: string) => (SceneScope & { nodes: readonly TscnNode[] }) | null | undefined;
}

/** A sub-viewport whose target is produced by rasterising a Control subtree. */
export interface ControlRasterViewport extends SceneScope {
  /** Dispatcher-absolute path — the key `viewportTextureRegistryKey` resolves to. */
  path: string;
  /** The sub-viewport node, collapsed if it is itself an instance root. */
  node: TscnNode;
  /** Target size in pixels: the rect its Controls are laid out against. */
  size: { x: number; y: number };
  /** `transparent_bg` — false means the target clears to Godot's default clear colour. */
  transparentBg: boolean;
}

/** Godot's `SubViewport.size` default, `Vector2i(512, 512)`. */
const DEFAULT_SIZE = 512;

/** Guards a pathological cyclic scene cache; real scenes nest a handful deep. */
const MAX_DEPTH = 100;

/**
 * Every Control-only sub-viewport in `roots`, depth-first, with its path and the
 * scope its Controls resolve in.
 *
 * A found sub-viewport is still descended into: a NESTED sub-viewport draws
 * into its own target in Godot, and `ControlDispatcher` stops at that inner
 * boundary, so the outer host would otherwise leave a hole exactly there.
 */
export function collectControlRasterViewports(
  roots: readonly TscnNode[],
  sceneCache: SceneScopeSource,
  scope: SceneScope
): ControlRasterViewport[] {
  const found: ControlRasterViewport[] = [];

  const walk = (
    nodes: readonly TscnNode[],
    parentPath: string,
    current: SceneScope,
    depth: number
  ): void => {
    if (depth > MAX_DEPTH) return;
    for (const node of nodes) {
      const path = joinPath(parentPath, node.name);

      // liveChildGroups decides instance-collapse and per-group resource scope
      // — the SAME decision `useBuildSolveTree`'s walk makes for the on-screen
      // native pass.
      const groups = liveChildGroups(node, current, sceneCache);
      // A collapsed single-root instance (ADR-0013) BECOMES its sub-scene
      // root; every other origin leaves the node's own identity alone.
      const mergedGroup = groups.find((group) => group.origin === 'merged');
      const effective = mergedGroup?.mergedNode ?? node;

      const effectiveScope: SceneScope = mergedGroup ? mergedGroup.scope : current;

      // Classified on the RESOLVED subtree, the same input the SubViewport
      // component's own `useViewportContentKind` uses: an `instance=` child is
      // an untyped childless `Node` until its sub-scene lands, which
      // `viewportContentKind` reads as 3D. Classifying the raw children here
      // would let both owners of this key decline and leave the consumer blank.
      if (
        isViewportBoundary(effective.type) &&
        viewportContentKind(
          resolveViewportSubtree(effective, effectiveScope.externalResources, sceneCache)
        ) === 'dom'
      ) {
        const properties = effective.properties as SubViewportProperties;
        found.push({
          path,
          node: effective,
          size: {
            x: Math.max(1, Math.round(properties.size?.x ?? DEFAULT_SIZE)),
            y: Math.max(1, Math.round(properties.size?.y ?? DEFAULT_SIZE)),
          },
          transparentBg: properties.transparent_bg === true,
          ...effectiveScope,
        });
      }

      // Every group descends in ITS OWN scope: the sub-scene's for
      // `merged`/`subscene`, the outer one for `inline`/`glb`. A found
      // sub-viewport is still descended into (see module doc).
      for (const group of groups) {
        walk(group.children, path, group.scope, depth + 1);
      }
    }
  };

  walk(roots, '', scope, 0);
  return found;
}
