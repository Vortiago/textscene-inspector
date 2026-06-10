/**
 * Maps TscnNode.type strings to React components.
 * Self-registration mirrors the imperative NodeRegistry pattern.
 * Duplicate typeName re-registration silently overwrites — HMR friendly.
 */

import type React from 'react';
import type { TscnNode } from '../parser/types';
import { createTypeRegistry } from '../core/createTypeRegistry';

export interface NodeComponentProps {
  node: TscnNode;
  children?: React.ReactNode;
}

export type NodeComponent = React.ComponentType<NodeComponentProps>;

export interface NodeComponentRegistration {
  typeName: string;
  Component: NodeComponent;
}

class NodeComponentRegistryImpl {
  private readonly registry = createTypeRegistry<NodeComponent>();

  register(registration: NodeComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
  }

  get(typeName: string): NodeComponent | undefined {
    return this.registry.get(typeName);
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
