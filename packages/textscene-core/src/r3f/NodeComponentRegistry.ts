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
   * nothing — a Timer, a joint, an XR tracker (ADR-0008). Its comparison sheet
   * reads `linter-only`. Defaults to `'draws'`.
   *
   * `'pending'` says Godot draws this and we do not yet: the badge and the
   * sheet call it a gap, but the base component stays registered. Absence of a
   * registration says the same thing about the badge and three other things
   * besides — `GenericNodeFallback` carries no `visible`, and
   * `drawsInWorkspace` reads an unregistered type as belonging to BOTH
   * canvases, so a 3D emitter drags its subtree into the 2D one. Declaring the
   * gap is not the same as forfeiting the transform space it lives in.
   */
  renderIntent?: 'draws' | 'transform-only' | 'pending';
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

  /** True when the type registered a base component while its own visual is still a gap. */
  isPending(typeName: string): boolean {
    return this.registry.get(typeName)?.renderIntent === 'pending';
  }

  /** The declared intent, or undefined when the type registers no component. */
  renderIntentOf(typeName: string): NodeComponentRegistration['renderIntent'] | undefined {
    const registration = this.registry.get(typeName);
    return registration === undefined ? undefined : (registration.renderIntent ?? 'draws');
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
