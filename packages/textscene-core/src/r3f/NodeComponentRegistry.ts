/**
 * Maps TscnNode.type strings to React components.
 * Self-registration mirrors the imperative NodeRegistry pattern.
 * Duplicate typeName re-registration silently overwrites — HMR friendly.
 */

import type React from 'react';
import type { TscnInternalResource, TscnNode } from '../parser/types';
import { createTypeRegistry } from '../core/createTypeRegistry';
import type { CsgShapeRegistration } from './csg/csgRegistration';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { YSortItem } from './ySortItems';

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
  /**
   * A pass over the whole authored tree that this type needs before the graph
   * is built, because its component cannot reach the node it names on its own:
   * a RemoteTransform moving its target, a CSGPolygon3D reading its path. Runs
   * once per parse, in stage order; a pass registered by two types (the 2D and
   * 3D relays share one) runs once. See `useParsedScene`.
   */
  scenePass?: ScenePassRegistration;
  /**
   * Present for a CanvasItem that the y-sort pass decomposes into per-row
   * groups rather than dispatching whole (a TileMapLayer): what to read off the
   * node, and the component that draws one group. See `YSortDispatcher`.
   */
  ySortGroup?: YSortGroupRegistration;
}

export interface YSortGroupDescription {
  tileSetRef: string;
  /** The layer's own `position.y`, added to the accumulated world Y. */
  positionY: number;
  ySortOrigin: number;
  cells: readonly PlacedCell[] | null;
}

export interface YSortGroupRegistration {
  describe: (node: TscnNode) => YSortGroupDescription;
  Renderer: React.ComponentType<{ item: YSortItem; z: number; band: number; node: TscnNode }>;
}

/** Every pass takes the parsed roots and hands back the roots to build from. */
export type ScenePass = (
  nodes: TscnNode[],
  internalResources: readonly TscnInternalResource[]
) => TscnNode[];

/**
 * `transforms` passes move nodes; `paths` passes read where nodes ended up, so
 * every transform pass runs before any path pass whatever the barrel order.
 */
export interface ScenePassRegistration {
  stage: 'transforms' | 'paths';
  run: ScenePass;
}

const SCENE_PASS_STAGES: readonly ScenePassRegistration['stage'][] = ['transforms', 'paths'];

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
  getYSortGroup(typeName: string): YSortGroupRegistration | undefined {
    return this.registry.get(typeName)?.ySortGroup;
  }

  getCsgShape(typeName: string): CsgShapeRegistration | undefined {
    return this.registry.get(typeName)?.csgShape;
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  /** The registered passes, each once, in stage order then registration order. */
  scenePasses(): readonly ScenePass[] {
    const seen = new Set<ScenePass>();
    const out: ScenePass[] = [];
    for (const stage of SCENE_PASS_STAGES) {
      for (const typeName of this.registry.getAllTypeNames()) {
        const pass = this.registry.get(typeName)?.scenePass;
        if (!pass || pass.stage !== stage || seen.has(pass.run)) continue;
        seen.add(pass.run);
        out.push(pass.run);
      }
    }
    return out;
  }

  clear(): void {
    this.registry.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
