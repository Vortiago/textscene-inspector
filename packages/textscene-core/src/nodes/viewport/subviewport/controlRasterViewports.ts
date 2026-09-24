/**
 * The `'dom'` sub-viewports the Control-raster pass (`ControlRasterPass.tsx`)
 * publishes, each with its dispatcher-absolute path and the resource scope of the
 * scene its Controls were authored in (ADR-0009, ADR-0013). Pure: the rendering
 * half is gated by `pnpm test:visual`.
 */

import type { TscnNode } from '../../../parser/types.js';
import type { ControlProperties } from '../../2d/ui/control/types.js';
import { LTR_LAYOUT_ENV, resolveLayoutRtl, type LayoutDirectionEnv } from '../../../godot/index.js';
import { TWO_D_UI_TYPES } from '../../../r3f/controls/has2DUIContent.js';
import { liveChildGroups, type SceneScope } from '../../../r3f/liveSceneTree.js';
import { joinPath } from '../../../utils/nodePath.js';
import { isViewportBoundary } from './viewportBoundary.js';
import { resolveViewportSubtree, viewportContentKind } from './viewportContent.js';
import type { SubViewportProperties } from './types.js';

/**
 * Read surface for the loader's PackedScene cache. Structural rather than the
 * concrete `ResourceLoader`, so the walk stays pure and a test supplies a map.
 * Every cached scene carries both resource pools, so this satisfies
 * `liveChildGroups`' `CachedSceneSource` surface without an adapter.
 */
export interface SceneScopeSource {
  getCached: (path: string) => (SceneScope & { nodes: readonly TscnNode[] }) | null | undefined;
}

/** A sub-viewport whose target is produced by rasterising a Control subtree. */
export interface ControlRasterViewport extends SceneScope {
  /** Dispatcher-absolute path: the key `viewportTextureRegistryKey` resolves to. */
  path: string;
  /** The sub-viewport node, collapsed if it is itself an instance root. */
  node: TscnNode;
  /** Target size in pixels: the rect its Controls are laid out against. */
  size: { x: number; y: number };
  /** `transparent_bg`: false means the target clears to Godot's default clear colour. */
  transparentBg: boolean;
  /**
   * `Control::is_layout_rtl()` for the nearest ancestor Control, or `null` where
   * there is none. The climb (`control.cpp:3584-3598`) steps over a `SubViewport`,
   * so its Controls inherit the enclosing Control's direction, which the raster
   * pass cannot see from the viewport's children.
   */
  inheritedRtl: boolean | null;
}

/** Godot's `SubViewport.size` default, `Vector2i(512, 512)`. */
const DEFAULT_SIZE = 512;

/** Guards a pathological cyclic scene cache; real scenes nest a handful deep. */
const MAX_DEPTH = 100;

/**
 * Every Control-only sub-viewport in `roots`, depth-first, with its path and the
 * scope its Controls resolve in. A found sub-viewport is still descended into: a
 * nested one draws into its own target, and `ControlDispatcher` stops at it.
 */
export function collectControlRasterViewports(
  roots: readonly TscnNode[],
  sceneCache: SceneScopeSource,
  scope: SceneScope,
  layoutDirectionEnv: LayoutDirectionEnv = LTR_LAYOUT_ENV
): ControlRasterViewport[] {
  const found: ControlRasterViewport[] = [];

  const walk = (
    nodes: readonly TscnNode[],
    parentPath: string,
    current: SceneScope,
    depth: number,
    /** What the rtl climb would find above `nodes` (`ControlRasterViewport.inheritedRtl`). */
    inheritedRtl: boolean | null
  ): void => {
    if (depth > MAX_DEPTH) return;
    for (const node of nodes) {
      const path = joinPath(parentPath, node.name);

      // liveChildGroups decides instance-collapse and per-group resource scope,
      // the same decision `useBuildSolveTree`'s walk makes for the on-screen pass.
      // A single-root instance puts all its children in the sub-scene's scope. A
      // multi-root one keeps its authored children in the outer scope.
      const groups = liveChildGroups(node, current, sceneCache);
      // A collapsed single-root instance (ADR-0013) becomes its sub-scene
      // root. Every other origin leaves the node's own identity alone.
      const mergedGroup = groups.find((group) => group.origin === 'merged');
      const effective = mergedGroup?.mergedNode ?? node;

      const effectiveScope: SceneScope = mergedGroup ? mergedGroup.scope : current;

      // Classified on the resolved subtree, as `useViewportContentKind` does: a
      // raw `instance=` child reads as 3D, so both owners of this key would
      // decline and leave the consumer blank.
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
          inheritedRtl,
          ...effectiveScope,
        });
      }

      // `TWO_D_UI_TYPES` is this codebase's set of Control-like types
      // (`buildSolveTree.ts` reads it too). `CanvasLayer` is in it and states no
      // direction, which costs nothing: an unset `layout_direction` is inherited
      // and relays what it was given (`control.cpp:3555`).
      const childRtl = TWO_D_UI_TYPES.has(effective.type)
        ? resolveLayoutRtl(
            (effective.properties as ControlProperties).layoutDirection,
            inheritedRtl,
            layoutDirectionEnv
          )
        : inheritedRtl;

      // Every group descends in its own scope: the sub-scene's for
      // `merged`/`subscene`, the outer one for `inline`/`glb`.
      for (const group of groups) {
        walk(group.children, path, group.scope, depth + 1, childRtl);
      }
    }
  };

  walk(roots, '', scope, 0, null);
  return found;
}
