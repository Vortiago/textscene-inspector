/**
 * Maps Godot Control `type` strings to DOM (not R3F) components — the 2D-UI
 * analogue of NodeComponentRegistry (ADR-0002/0003). Kept separate so the 3D
 * registry stays THREE-typed; both share `createTypeRegistry`.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { createTypeRegistry } from '../../core/createTypeRegistry';
import type { Rect2 } from './native/rect';
import type { SolveNode } from './native/solveTree';

export interface ControlComponentProps {
  node: TscnNode;
  children?: React.ReactNode;
  /**
   * Scene-tree path of this node (root = name, child = `parent/child`). Set by
   * ControlDispatcher; used by containers that must reason about which children
   * actually render as layout items (e.g. GridContainer excludes hidden ones).
   */
  path?: string;
}

export type ControlComponent = React.ComponentType<ControlComponentProps>;

/**
 * Props a NATIVE (WebGL canvas) Control painter receives from
 * `ControlCanvasWalker` — deliberately not `ControlComponentProps`, which is
 * DOM-flavored (its `children` are nested DOM elements a CSS container
 * arranges). A native painter draws only its OWN chrome: `ControlCanvasWalker`
 * positions this node's outer `<group>` and renders its (already-solved,
 * self-positioning) children as siblings, so no child content is threaded
 * through the painter's props. `rect` is in LOCAL space — (0, 0) at this
 * node's own top-left; the walker's outer group already carries its
 * viewport/parent-relative position.
 */
export interface NativeControlComponentProps {
  /** This Control's solved node — collapsed live node, its own styleBoxes/textureSize. */
  solveNode: SolveNode;
  /** This Control's solved rect, LOCAL space (position already applied by the walker). */
  rect: Rect2;
  /**
   * This Control's draw-order key — `bandBase(canvasLayer) + paintIndex`
   * (`native/controlDrawOrder.ts`) — for the painter's own mesh(es). Every 2D
   * material in this codebase is transparent + depthWrite=false, so three's
   * transparent sort decides paint order from this value, never from z.
   *
   * Optional so an existing painter's own isolated unit test (constructing
   * this prop object directly, not through the walker) keeps type-checking
   * without a value: `ControlCanvasWalker` — the only real caller — always
   * supplies one.
   */
  renderOrder: number;
  /**
   * Rendered ONLY for a passthrough host that draws no chrome of its own but
   * must still wrap its descendants in fresh context — `CanvasLayer`'s native
   * painter (`nodes/2d/ui/canvaslayer/NativeComponent.tsx`) is the one type
   * that needs this. Every other registered painter draws fixed chrome and
   * receives `undefined` here: `ControlCanvasWalker` renders a Control's
   * children as SIBLINGS of its painter, not through this prop, except for
   * that one passthrough case.
   */
  children?: ReactNode;
}

export type NativeControlComponent = React.ComponentType<NativeControlComponentProps>;

export interface ControlComponentRegistration {
  typeName: string;
  Component: ControlComponent;
  /**
   * The native (WebGL canvas) painter for this Control type, registered
   * alongside the existing DOM `Component` rather than instead of it — a
   * slice ships its native painter while the DOM overlay is still what
   * production renders. `ControlCanvasWalker` falls back to
   * `<ControlFallback>` for a type with no `Native` yet. At cutover the DOM
   * `Component` field is deleted and this one renamed into it.
   */
  Native?: NativeControlComponent;
  /**
   * Whether this type's native painter receives its Control children as React
   * children instead of the walker rendering them as siblings.
   *
   * Data on the registration rather than a `node.type` comparison in the walker:
   * the walker is generic infrastructure, and `NodeComponentRegistry` already
   * establishes this pattern for exactly this kind of question (`canvasItem`,
   * `container`, `csgShape`). A second wrapping type would otherwise add a
   * second hardcoded branch, and the two could drift on which types wrap.
   *
   * Only a type that establishes a new ambient scope for its subtree needs it —
   * `CanvasLayer`, which publishes a draw-order band and a fresh modulate scope
   * its descendants inherit.
   */
  wrapsChildren?: boolean;
}

class ControlComponentRegistryImpl {
  private readonly registry = createTypeRegistry<ControlComponent>('ControlComponentRegistry');
  private readonly nativeRegistry = createTypeRegistry<NativeControlComponent>(
    'ControlComponentRegistry.native'
  );
  private readonly childWrappingTypes = new Set<string>();

  register(registration: ControlComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
    if (registration.Native) {
      this.nativeRegistry.register(registration.typeName, registration.Native);
    }
    if (registration.wrapsChildren) {
      this.childWrappingTypes.add(registration.typeName);
    }
  }

  get(typeName: string): ControlComponent | undefined {
    return this.registry.get(typeName);
  }

  /** The registered native (WebGL canvas) painter, or undefined until a slice ships one. */
  getNative(typeName: string): NativeControlComponent | undefined {
    return this.nativeRegistry.get(typeName);
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
    this.nativeRegistry.clear();
    this.childWrappingTypes.clear();
  }
}

export const controlComponentRegistry = new ControlComponentRegistryImpl();
