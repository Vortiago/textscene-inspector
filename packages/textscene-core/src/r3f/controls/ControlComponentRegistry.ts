/**
 * Maps a Godot Control `type` to its native (WebGL canvas) painter, the 2D-UI
 * twin of NodeComponentRegistry (ADR-0002). It is separate, so the 3D registry
 * stays THREE-typed, and both share `createTypeRegistry`.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import { createTypeRegistry } from '../../core/createTypeRegistry';
import type { NativeTheme } from './native/nativeTheme';
import type { TextMeasurer } from './native/solverRegistry';
import type { Rect2 } from './native/rect';
import type { SolveNode } from './native/solveTree';
import type { ControlOwnTint } from './native/controlTint';
import type { SealedHandoff } from './native/solveHandoff';

/**
 * The props `ControlCanvasWalker` gives a painter, which draws only its own
 * chrome: the walker positions the node's outer `<group>` and renders its solved
 * children as siblings.
 */
export interface NativeControlComponentProps {
  /** The solved node: the merged live node, with its own styleBoxes and textureSize. */
  solveNode: SolveNode;
  /** The solved rect in local space, (0, 0) at the node's top-left. The walker applies the position. */
  rect: Rect2;
  /**
   * The default theme at the project's `gui/theme/default_theme_scale`. The
   * walker hands down the one the solve used, so a painter and its solver see
   * the same metrics.
   */
  theme: NativeTheme;
  /**
   * The own-pixel tint: the inherited modulate, own `modulate` included, times `self_modulate`, in
   * sRGB with one linear conversion on `color`. The walker composes it once, as `CanvasItem2D` does.
   * Required, since an optional tint falls back to opaque white in silence. A test gets every
   * required prop from `painterEnv` (`native/testing/painterProps.ts`).
   */
  tint: ControlOwnTint;
  /**
   * Whether Controls in this viewport snap to whole pixels, as the walker resolved it. The project's
   * `gui/common/snap_controls_to_pixels` sets only the root window (`main/main.cpp`), and every other
   * Viewport keeps `true`. A painter needs it for sibling CanvasItems that snap on their own
   * account, such as a ScrollContainer's bars.
   */
  snapToPixels: boolean;
  /**
   * The solve's text measurer, or `null` before the metrics arrive, so a
   * painter's layout of a string agrees with the minimum size it produced.
   */
  measureText: TextMeasurer | null;
  /**
   * The solved rects of the direct children, by node path. Chrome placed by
   * the children, such as a split container's grabber, reads the solver's
   * layout, not a recomputation that can silently disagree.
   */
  childRects: ReadonlyMap<string, Rect2>;
  /**
   * The canvas key every Node2D canvas item takes (`canvasPaintOrder.ts`). Every 2D material is
   * transparent without depth writes, so three sorts by this, never by z. A painter that wraps its
   * pixels in its own group puts this on the group too, or three sorts it to the canvas front.
   */
  renderOrder: number;
  /**
   * The key at the end of this node's contiguous run, for chrome that draws after the whole subtree
   * like Godot's `INTERNAL_MODE_BACK` children: ScrollContainer's bars (`scene/gui/scroll_container.cpp:919,924`),
   * and those of LineEdit, OptionButton, RichTextLabel and SplitContainer. The next sibling starts one
   * past it, so add a fraction such as +0.25. Required, since a `renderOrder` fallback hides a bar.
   */
  subtreeChromeRenderOrder: number;
  /**
   * The own clamped `z_final` (`accumulateCanvasItemZ`) that a 2D light's z window tests, since
   * `_cull_canvas_item` passes the accumulated `p_z` on (`servers/rendering/renderer_canvas_cull.cpp`).
   * Required though no painter reads it yet: `useCanvasItemLighting` falls back to `useEffectiveZ()`,
   * the parent's z, so a lit painter passes this in, as `CanvasItem2D.tsx` does.
   */
  effectiveZ: number;
  /**
   * The **solve handoff** the Control's `ContainerLayoutFn` sealed (`SolvedControl.meta`), or
   * `undefined`. Only the producing slice's channel opens it (`native/solveHandoff.ts`). A painter
   * pure in `(node, theme)` calls its solver's share instead. Required, so a painter that needs it
   * cannot re-derive a wrong value in silence.
   */
  meta: SealedHandoff | undefined;
  /**
   * The Control children, only for a type registered with `wrapsChildren`.
   * Every other painter gets `undefined`, since the walker renders its
   * children as siblings.
   */
  children?: ReactNode;
}

export type NativeControlComponent = React.ComponentType<NativeControlComponentProps>;

export interface ControlComponentRegistration {
  typeName: string;
  /** The native (WebGL canvas) painter for this Control type. */
  Component: NativeControlComponent;
  /**
   * Whether the painter takes its Control children as React children. A type that opens an ambient
   * scope for its subtree sets it: a CanvasLayer, ParallaxBackground included, publishes a draw-order
   * band and a modulate scope, and ScrollContainer and GraphEdit publish clip planes.
   */
  wrapsChildren?: boolean;
}

class ControlComponentRegistryImpl {
  private readonly registry = createTypeRegistry<NativeControlComponent>('ControlComponentRegistry');
  // Data on the registration, not a `node.type` test in the generic walker, as
  // `NodeComponentRegistry` does for `canvasItem`, `container` and `csgShape`.
  private readonly childWrappingTypes = new Set<string>();

  register(registration: ControlComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
    if (registration.wrapsChildren) {
      this.childWrappingTypes.add(registration.typeName);
    }
  }

  /** The registered native (WebGL canvas) painter, or undefined until a slice ships one. */
  get(typeName: string): NativeControlComponent | undefined {
    return this.registry.get(typeName);
  }

  /** Whether this type's native painter takes its children rather than the walker placing them. */
  wrapsChildren(typeName: string): boolean {
    return this.childWrappingTypes.has(typeName);
  }

  has(typeName: string): boolean {
    return this.registry.has(typeName);
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
    this.childWrappingTypes.clear();
  }
}

export const controlComponentRegistry = new ControlComponentRegistryImpl();
