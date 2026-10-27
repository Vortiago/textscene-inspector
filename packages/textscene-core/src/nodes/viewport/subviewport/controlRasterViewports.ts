/**
 * The `'dom'` sub-viewports the Control-raster pass (`ControlRasterPass.tsx`)
 * publishes, each with its dispatcher-absolute path and the resource scope of the
 * scene its Controls were authored in (ADR-0009, ADR-0013). Pure: the rendering
 * half is gated by `pnpm test:visual`.
 */

import type { TscnNode } from '../../../parser/types.js';
import type { ControlProperties } from '../../2d/ui/control/types.js';
import { LTR_LAYOUT_ENV, resolveLayoutRtl, type LayoutDirectionEnv } from '../../../godot/scene/control.js';
import { TWO_D_UI_TYPES } from '../../../r3f/controls/has2DUIContent.js';
import {
  liveTreeOf,
  type CachedSceneSource,
  type LiveTreeContext,
  type SceneScope,
} from '../../../r3f/liveSceneTree.js';
import { isViewportBoundary } from './viewportBoundary.js';
import { resolveViewportSubtree, viewportContentKind } from './viewportContent.js';

/** A sub-viewport whose target is produced by rasterising a Control subtree. */
export interface ControlRasterViewport extends SceneScope {
  /** Dispatcher-absolute path: the key `viewportTextureRegistryKey` resolves to. */
  path: string;
  /** The sub-viewport node, collapsed if it is itself an instance root. */
  node: TscnNode;
  /**
   * `Control::is_layout_rtl()` for the nearest ancestor Control, or `null` where
   * there is none. The climb (`control.cpp:3584-3598`) steps over a `SubViewport`,
   * so its Controls inherit the enclosing Control's direction, which the raster
   * pass cannot see from the viewport's children.
   */
  inheritedRtl: boolean | null;
}

/**
 * Every Control-only sub-viewport in `roots`, depth-first, with its path and the
 * scope its Controls resolve in. A found sub-viewport is still descended into: a
 * nested one draws into its own target, and `ControlDispatcher` stops at it.
 */
export function collectControlRasterViewports(
  roots: readonly TscnNode[],
  sceneCache: CachedSceneSource,
  scope: SceneScope,
  layoutDirectionEnv: LayoutDirectionEnv = LTR_LAYOUT_ENV
): ControlRasterViewport[] {
  const found: ControlRasterViewport[] = [];
  const ctx: LiveTreeContext = {
    externalResources: scope.externalResources,
    internalResources: scope.internalResources,
    sceneCache,
  };

  // The step decides instance-collapse and per-group resource scope, the same decision
  // `useBuildSolveTree`'s walk makes for the on-screen pass.
  const tree = liveTreeOf(roots, ctx);
  tree.fold<boolean | null, void>(null, (link, inheritedRtl, descend) => {
    const { step, path } = link;
    // Classified on the resolved subtree, as `useViewportContentKind` does: a
    // raw `instance=` child reads as 3D, so both owners of this key would
    // decline and leave the consumer blank.
    if (
      isViewportBoundary(step.node.type) &&
      viewportContentKind(resolveViewportSubtree(tree, link)) === 'dom'
    ) {
      found.push({ path, node: step.node, inheritedRtl, ...step.scope });
    }

    // `TWO_D_UI_TYPES` is this codebase's set of Control-like types
    // (`buildSolveTree.ts` reads it too). `CanvasLayer` is in it and states no
    // direction, which costs nothing: an unset `layout_direction` is inherited
    // and relays what it was given (`control.cpp:3555`).
    descend(
      TWO_D_UI_TYPES.has(step.node.type)
        ? resolveLayoutRtl(
            (step.node.properties as ControlProperties).layoutDirection,
            inheritedRtl,
            layoutDirectionEnv
          )
        : inheritedRtl
    );
  });
  return found;
}
