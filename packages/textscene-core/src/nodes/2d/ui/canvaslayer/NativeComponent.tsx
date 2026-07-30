/**
 * `<CanvasLayerNative>` — the native (WebGL canvas) counterpart of
 * `./Component.tsx`'s DOM `<CanvasLayer>`: a full-rect passthrough that is its
 * OWN canvas, not a Control despite living in the Control tree walk
 * (`TWO_D_UI_TYPES` lists it so `buildSolveTree` gives it a `SolveNode` at
 * all).
 *
 * Draws no chrome of its own — mirrors the DOM component (no background, just
 * a wrapper). Registering a `Native` at all is what stops
 * `ControlCanvasWalker` from falling back to `<ControlFallback>`'s outline
 * box, which would otherwise draw a visible rectangle around the whole layer.
 *
 * Mounts a fresh `CanvasLayerIndexProvider` (this layer's own `layer`
 * property, Godot's default 1 — `DEFAULT_CANVAS_LAYER`) and a fresh
 * `CanvasModulateContext` scope (`canvasModulateColor` over this node's OWN
 * raw `children` — a `CanvasLayer` is its own canvas, so a `CanvasModulate`
 * inside it tints only this layer, never the world one) around `children`,
 * mirroring the `CanvasLayer` branch of `NodeDispatcher.tsx`'s `PlainNode`
 * exactly — not a second convention. That dispatcher also resets
 * `EffectiveZProvider` for the same branch; there is no native-Control
 * equivalent here because Light2D culling (what that context feeds) does not
 * extend to native Controls in this codebase.
 *
 * `ControlCanvasWalker` renders `children` through this component ONLY for
 * `CanvasLayer` — every other registered painter draws fixed chrome as a
 * sibling of its Control's descendants (`NativeControlComponentProps`'s own
 * doc comment), since nothing else needs a canvas boundary between a Control
 * and what is nested under it.
 *
 * `visible === false` is handled here directly (mirroring the DOM twin's own
 * inline `display` gate) rather than relying solely on the walker's outer
 * group visibility: this component renders nothing, publishing neither
 * context, when hidden — the same "no descendant reaches the scene" contract
 * a hidden ancestor has everywhere else in this codebase.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { canvasModulateColor, CanvasModulateContext } from '../../../../r3f/canvasModulate';
import { CanvasLayerIndexProvider, DEFAULT_CANVAS_LAYER } from '../../../../r3f/lighting2d/canvasItemPlacement';
import type { CanvasLayerProperties } from './types';

export function CanvasLayerNative({ solveNode, children }: NativeControlComponentProps) {
  const props = solveNode.node.properties as CanvasLayerProperties;
  const layer = props.layer ?? DEFAULT_CANVAS_LAYER;
  // `solveNode.node.children` is the raw, LIVE scene-tree children (unlike
  // `solveNode.children`, which is the already-collapsed Control-only forest)
  // — the exact input `canvasModulateColor` expects, matching
  // `NodeDispatcher.tsx`'s `canvasModulateColor(node.children)`.
  const modulate = useMemo(
    () => canvasModulateColor(solveNode.node.children),
    [solveNode.node.children]
  );

  if (props.visible === false) return null;

  return (
    <CanvasModulateContext.Provider value={modulate}>
      <CanvasLayerIndexProvider value={layer}>{children}</CanvasLayerIndexProvider>
    </CanvasModulateContext.Provider>
  );
}
