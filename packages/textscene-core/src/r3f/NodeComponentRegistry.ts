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
  /**
   * Whether this type draws anything of its own.
   *
   * `'transform-only'` says the node is finished and correct while drawing
   * nothing — a Timer, a joint, an XR tracker (ADR-0008). It registers a base
   * component so its children land in the right transform space, and its
   * comparison sheet reads `linter-only`. Defaults to `'draws'`.
   *
   * A type that SHOULD draw but does not yet registers no component at all and
   * falls through to `GenericNodeFallback`; that absence is what
   * `rendersOwnVisual` reports as "not implemented". The distinction matters
   * because a parser registration alone already clears the tree's badge.
   */
  renderIntent?: 'draws' | 'transform-only';
}

class NodeComponentRegistryImpl {
  // The whole registration is stored, and every flag is answered from it. Four
  // parallel Sets/Maps meant each new flag cost add/delete plumbing in
  // `register`, a line in `clear`, and a field — three places to forget.
  private readonly registry = createTypeRegistry<NodeComponentRegistration>(
    'NodeComponentRegistry'
  );

  register(registration: NodeComponentRegistration): void {
    this.registry.register(registration.typeName, registration);
  }

  get(typeName: string): NodeComponent | undefined {
    return this.registry.get(typeName)?.Component;
  }

  /** True when the type registered as CanvasItem (2D-canvas world content). */
  isCanvasItem(typeName: string): boolean {
    return this.registry.get(typeName)?.canvasItem === true;
  }

  /** True when the type registered as a workspace-neutral container. */
  isContainer(typeName: string): boolean {
    return this.registry.get(typeName)?.container === true;
  }

  /** True when the type takes part in CSG boolean evaluation. */
  isCsgShape(typeName: string): boolean {
    return this.registry.get(typeName)?.csgShape !== undefined;
  }

  /** True when the type registered as drawing nothing of its own (ADR-0008). */
  isTransformOnly(typeName: string): boolean {
    return this.registry.get(typeName)?.renderIntent === 'transform-only';
  }

  /** The CSG registration for a type, or undefined when it is not a CSG shape. */
  getCsgShape(typeName: string): CsgShapeRegistration | undefined {
    return this.registry.get(typeName)?.csgShape;
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  clear(): void {
    this.registry.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
