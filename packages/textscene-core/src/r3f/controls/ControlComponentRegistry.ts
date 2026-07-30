/**
 * Maps Godot Control `type` strings to DOM (not R3F) components — the 2D-UI
 * analogue of NodeComponentRegistry (ADR-0002/0003). Kept separate so the 3D
 * registry stays THREE-typed; both share `createTypeRegistry`.
 */

import type React from 'react';
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
}

class ControlComponentRegistryImpl {
  private readonly registry = createTypeRegistry<ControlComponent>('ControlComponentRegistry');
  private readonly nativeRegistry = createTypeRegistry<NativeControlComponent>(
    'ControlComponentRegistry.native'
  );

  register(registration: ControlComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
    if (registration.Native) {
      this.nativeRegistry.register(registration.typeName, registration.Native);
    }
  }

  get(typeName: string): ControlComponent | undefined {
    return this.registry.get(typeName);
  }

  /** The registered native (WebGL canvas) painter, or undefined until a slice ships one. */
  getNative(typeName: string): NativeControlComponent | undefined {
    return this.nativeRegistry.get(typeName);
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
  }
}

export const controlComponentRegistry = new ControlComponentRegistryImpl();
