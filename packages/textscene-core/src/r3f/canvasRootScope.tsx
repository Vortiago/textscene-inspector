/**
 * The scope a CANVAS ROOT draws in: the canvas itself, not the node above it.
 *
 * `CanvasItem::get_parent_item()` answers nullptr when the direct parent fails
 * `Object::cast_to<CanvasItem>` or when the item's own `top_level`
 * short-circuits the cast (`scene/main/canvas_item.cpp:565-571`), and
 * `_enter_canvas` then parents the item at the CanvasLayer's or the viewport's
 * own canvas rather than at an ancestor item (`canvas_item.cpp:234-285`).
 * `_render_canvas_item_tree` culls every such root from the canvas transform,
 * `Color(1, 1, 1, 1)`, `p_z = 0` and a null material owner
 * (`servers/rendering/renderer_canvas_cull.cpp:70-83`) — the same four resets
 * `CanvasLayerScope` publishes for the same reason, one canvas further in.
 *
 * VISIBILITY is the one thing that still crosses: `_handle_visibility_change`
 * walks the SCENE-tree children and propagates into a top_level child anyway
 * (`canvas_item.cpp:102-108`). So the root stays nested inside its ancestors'
 * groups — where an eye toggle and a `visible = false` still reach it — and
 * cancels their accumulated transform with an inverse instead of being lifted
 * out of them.
 *
 * `CanvasSpaceContext` is what makes that inverse available: the three-space
 * transform accumulated by `<CanvasItem2D>` groups since the last object whose
 * world matrix is written outright. A `CanvasLayer` contributes nothing to it
 * because it mounts no transform of its own in this walk, which is exactly why
 * a canvas root beneath one still cancels the Node2D above the layer.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import { isCanvasRoot } from './canvasPaintOrder.js';
import { Modulate2DContext, WHITE_MODULATE } from './canvasItemModulate.js';
import { ROOT_TEXTURE_SAMPLER, TextureSampler2DContext } from './canvasItemTextureSampler.js';
import { EffectiveZProvider } from './lighting2d/canvasItemPlacement.js';
import { CanvasItemMaterialProvider } from './components/canvasItemMaterialContext.js';

const CanvasSpaceContext = createContext<THREE.Matrix4 | null>(null);
CanvasSpaceContext.displayName = 'CanvasSpaceContext';

/** The accumulated CanvasItem transform in force here, or `null` for none. */
export function useCanvasSpace(): THREE.Matrix4 | null {
  return useContext(CanvasSpaceContext);
}

export function CanvasSpaceProvider({
  value,
  children,
}: {
  value: THREE.Matrix4 | null;
  children: ReactNode;
}) {
  return <CanvasSpaceContext.Provider value={value}>{children}</CanvasSpaceContext.Provider>;
}

const ParentIsCanvasItemContext = createContext(false);
ParentIsCanvasItemContext.displayName = 'ParentIsCanvasItemContext';

/** Whether the node rendering this subtree is itself a `CanvasItem`. */
export function useParentIsCanvasItem(): boolean {
  return useContext(ParentIsCanvasItemContext);
}

export function ParentIsCanvasItemProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <ParentIsCanvasItemContext.Provider value={value}>{children}</ParentIsCanvasItemContext.Provider>;
}

/**
 * Wraps a node's own rendered content, resetting the canvas scope when the node
 * parents at the canvas instead of at the node above it. A node that nests
 * normally is returned untouched — no extra group, no re-provided context — so
 * the ordinary case renders exactly as it did before this existed.
 *
 * Applied by the node ITSELF rather than by its parent, because an `instance=`
 * node without a `type=` parses as `Node` and only becomes its sub-scene root's
 * type once the PackedScene merges in (ADR-0013): a parent deciding from the
 * host tree would answer for the wrong type.
 */
export function CanvasRootScope({
  node,
  parentIsCanvasItem,
  children,
}: {
  node: TscnNode;
  parentIsCanvasItem: boolean;
  children: ReactNode;
}) {
  const ambient = useCanvasSpace();
  const isRoot = isCanvasRoot(node, parentIsCanvasItem);
  const inverse = useMemo(
    () => (isRoot && ambient ? ambient.clone().invert() : null),
    [isRoot, ambient]
  );
  if (!isRoot) return <>{children}</>;

  const scoped = (
    <CanvasSpaceProvider value={null}>
      <Modulate2DContext.Provider value={WHITE_MODULATE}>
        <TextureSampler2DContext.Provider value={ROOT_TEXTURE_SAMPLER}>
          <CanvasItemMaterialProvider value={null}>
            <EffectiveZProvider value={0}>{children}</EffectiveZProvider>
          </CanvasItemMaterialProvider>
        </TextureSampler2DContext.Provider>
      </Modulate2DContext.Provider>
    </CanvasSpaceProvider>
  );

  // paint-order-safe: a bare transform group OUTSIDE the item's own, which
  // carries the canvas key and so still decides `groupOrder` for its pixels.
  return inverse ? (
    <group matrix={inverse} matrixAutoUpdate={false}>
      {scoped}
    </group>
  ) : (
    scoped
  );
}
