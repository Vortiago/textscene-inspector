/**
 * Maps TscnNode.type strings to React components.
 * Self-registration mirrors the imperative NodeRegistry pattern.
 * Duplicate typeName re-registration silently overwrites — HMR friendly.
 */

import type React from 'react';
import type { TscnNode } from '../parser/types';

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
  private readonly entries = new Map<string, NodeComponent>();

  register(registration: NodeComponentRegistration): void {
    this.entries.set(registration.typeName, registration.Component);
  }

  get(typeName: string): NodeComponent | undefined {
    return this.entries.get(typeName);
  }

  getAllTypeNames(): string[] {
    return Array.from(this.entries.keys());
  }

  clear(): void {
    this.entries.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
