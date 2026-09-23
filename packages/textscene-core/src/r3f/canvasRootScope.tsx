/**
 * The scope a canvas root (`isCanvasRoot`) draws in: the canvas itself, not the node above it.
 * `_render_canvas_item_tree` culls each root from the canvas transform, `Color(1, 1, 1, 1)`,
 * `p_z = 0` and a null material owner (`servers/rendering/renderer_canvas_cull.cpp:70-83`),
 * the four resets `CanvasLayerScope` publishes one canvas further in.
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

/**
 * The three-space transform the `<CanvasItem2D>` groups accumulate since the last object whose
 * world matrix is written outright. A `CanvasLayer` mounts no transform in this walk and adds
 * nothing, so a canvas root beneath one still cancels the Node2D above the layer.
 */
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
 * Wraps a node's content, resetting the canvas scope when it parents at the
 * canvas. A node that nests normally gets no extra group or context. The node
 * applies it itself: an `instance=` node parses as `Node` until it merges (ADR-0013).
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
  // Visibility still crosses: `_handle_visibility_change` propagates into a top_level child
  // (`canvas_item.cpp:102-108`). So the root stays inside its ancestors' groups, where an eye
  // toggle and `visible = false` reach it, and cancels their transform with this inverse.
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

  // paint-order-safe: a bare transform group outside the item's own, which
  // carries the canvas key and so still decides `groupOrder` for its pixels.
  return inverse ? (
    <group matrix={inverse} matrixAutoUpdate={false}>
      {scoped}
    </group>
  ) : (
    scoped
  );
}
