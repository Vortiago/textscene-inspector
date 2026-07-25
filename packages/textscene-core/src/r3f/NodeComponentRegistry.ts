/**
 * Maps TscnNode.type strings to React components.
 * Self-registration mirrors the imperative NodeRegistry pattern.
 * Duplicate typeName re-registration silently overwrites — HMR friendly.
 */

import type React from 'react';
import type { TscnNode } from '../parser/types';
import { createTypeRegistry } from '../core/createTypeRegistry';
import type { CsgShapeRegistration } from './csg/csgRegistration';

export interface NodeComponentProps {
  node: TscnNode;
  children?: React.ReactNode;
}

export type NodeComponent = React.ComponentType<NodeComponentProps>;

export interface NodeComponentRegistration {
  typeName: string;
  Component: NodeComponent;
  /**
   * True for CanvasItem types (Node2D world content: sprites, tilemaps,
   * 2D physics, Camera2D…). The workspace-aware dispatcher renders these
   * only in the 2D world canvas — never in the 3D viewport — mirroring
   * Godot's editor split.
   */
  canvasItem?: boolean;
  /**
   * True for plain-`Node`-derived container types (Node, AnimationPlayer,
   * AudioStreamPlayer…): neither 2D nor 3D, so they pass through BOTH
   * workspaces and their children render wherever they belong.
   */
  container?: boolean;
  /**
   * Present for CSG types, exposing the node's solid as data so the boolean evaluator
   * can consume triangles rather than a React element. See csg/csgRegistration.ts.
   */
  csgShape?: CsgShapeRegistration;
}

class NodeComponentRegistryImpl {
  private readonly registry = createTypeRegistry<NodeComponent>('NodeComponentRegistry');
  private readonly canvasItemTypes = new Set<string>();
  private readonly containerTypes = new Set<string>();
  private readonly csgShapes = new Map<string, CsgShapeRegistration>();

  register(registration: NodeComponentRegistration): void {
    this.registry.register(registration.typeName, registration.Component);
    if (registration.canvasItem) this.canvasItemTypes.add(registration.typeName);
    else this.canvasItemTypes.delete(registration.typeName);
    if (registration.container) this.containerTypes.add(registration.typeName);
    else this.containerTypes.delete(registration.typeName);
    if (registration.csgShape) this.csgShapes.set(registration.typeName, registration.csgShape);
    else this.csgShapes.delete(registration.typeName);
  }

  get(typeName: string): NodeComponent | undefined {
    return this.registry.get(typeName);
  }

  /** True when the type registered as CanvasItem (2D-canvas world content). */
  isCanvasItem(typeName: string): boolean {
    return this.canvasItemTypes.has(typeName);
  }

  /** True when the type registered as a workspace-neutral container. */
  isContainer(typeName: string): boolean {
    return this.containerTypes.has(typeName);
  }

  /** True when the type takes part in CSG boolean evaluation. */
  isCsgShape(typeName: string): boolean {
    return this.csgShapes.has(typeName);
  }

  /** The CSG registration for a type, or undefined when it is not a CSG shape. */
  getCsgShape(typeName: string): CsgShapeRegistration | undefined {
    return this.csgShapes.get(typeName);
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
    this.canvasItemTypes.clear();
    this.containerTypes.clear();
    this.csgShapes.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
