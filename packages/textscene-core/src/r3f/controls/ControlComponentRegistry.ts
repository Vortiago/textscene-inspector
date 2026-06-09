/**
 * Maps Godot Control `type` strings to DOM (not R3F) components — the 2D-UI
 * analogue of NodeComponentRegistry (ADR-0002/0003). Kept separate so the 3D
 * registry stays THREE-typed; both share `createTypeRegistry`.
 */

import type React from 'react';
import type { TscnNode } from '../../parser/types';
import { createTypeRegistry } from '../../core/createTypeRegistry';

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

export interface ControlComponentRegistration {
  typeName: string;
  Component: ControlComponent;
}

class ControlComponentRegistryImpl {
  private readonly registry = createTypeRegistry<ControlComponent>();

  register(registration: ControlComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
  }

  get(typeName: string): ControlComponent | undefined {
    return this.registry.get(typeName);
  }

  has(typeName: string): boolean {
    return this.registry.has(typeName);
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
  }
}

export const controlComponentRegistry = new ControlComponentRegistryImpl();
