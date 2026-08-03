/**
 * Which sub-viewports are published from a **DOM raster** rather than from a
 * WebGL pass, and in which resource scope their Controls resolve.
 *
 * `viewportContentKind` already decides the OWNERSHIP split — the offscreen
 * publisher takes `'3d'` and `'2d'`, this path takes `'dom'` — because Controls
 * are DOM (ADR-0003) and there is no WebGL source to render. What that
 * classifier cannot answer is where the sub-viewport SITS: the registry is keyed
 * by dispatcher-absolute node path, and the Controls beneath it resolve
 * ExtResource/SubResource ids against the scene they were AUTHORED in, which is
 * not the host scene once an instance is in the way (ADR-0009, ADR-0013). The
 * committed corpus makes that concrete: `gui_in_3d.tscn` instances
 * `gui_panel_3d.tscn`, whose `TextureRect` names `ExtResource("2")` — an id the
 * host scene never defines.
 *
 * The scope rules mirror `ControlDispatcher`'s own walk exactly, because the
 * host mounts that dispatcher and must hand it the scope it would have had:
 * a collapsed single-root instance puts ALL its children in the sub-scene's
 * scope; a multi-root one keeps the instance node, its authored children in the
 * outer scope and the loaded roots in the sub-scene's.
 *
 * Pure (no React, no THREE, no DOM) so the path/scope rules are asserted
 * directly — the rasterisation half needs real layout and is gated in the
 * browser (ADR-0024).
 */

import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types.js';
import { mergeInstanceRoot } from '../../../resources/mergeInstanceRoot.js';
import { resolveInstancePath } from '../../../resources/SubResourceResolver.js';
import { joinPath } from '../../../utils/nodePath.js';
import { isViewportBoundary } from './viewportBoundary.js';
import { viewportContentKind } from './viewportContent.js';
import type { SubViewportProperties } from './types.js';

/** The resource scope a subtree resolves its ids against. */
export interface SceneScope {
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

/**
 * Read surface for the loader's PackedScene cache. Structural rather than the
 * concrete `ResourceLoader`, so the walk stays pure and a test supplies a map.
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

      // The sub-scene behind an `instance=`, once loaded — the only thing that
      // can change the scope below this node.
      const scenePath = node.instance
        ? resolveInstancePath(node.instance, current.externalResources)
        : null;
      const subScene = scenePath ? sceneCache.getCached(scenePath) : undefined;
      const subScope: SceneScope | null = subScene
        ? {
            internalResources: subScene.internalResources,
            externalResources: subScene.externalResources,
          }
        : null;
      // A single-root sub-scene collapses INTO the instance node (ADR-0013), so
      // the node itself is already the sub-scene's root and is read in that scope.
      const merged = subScene
        ? mergeInstanceRoot(node, subScene, current.externalResources)
        : null;
      const effective = merged ?? node;

      if (isViewportBoundary(effective.type) && viewportContentKind(effective) === 'dom') {
        const properties = effective.properties as SubViewportProperties;
        found.push({
          path,
          node: effective,
          size: {
            x: Math.max(1, Math.round(properties.size?.x ?? DEFAULT_SIZE)),
            y: Math.max(1, Math.round(properties.size?.y ?? DEFAULT_SIZE)),
          },
          transparentBg: properties.transparent_bg === true,
          ...(merged && subScope ? subScope : current),
        });
      }

      if (merged && subScope) {
        // Collapsed: every child came from the sub-scene root, in its scope.
        walk(merged.children, path, subScope, depth + 1);
        continue;
      }
      // Host-authored children keep the outer scope whether or not the instance
      // resolved; a multi-root sub-scene's roots are injected beneath the
      // instance node in the sub-scene's scope.
      walk(node.children, path, current, depth + 1);
      if (subScene && subScope) walk(subScene.nodes, path, subScope, depth + 1);
    }
  };

  walk(roots, '', scope, 0);
  return found;
}
