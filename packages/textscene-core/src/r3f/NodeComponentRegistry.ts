/**
 * Maps TscnNode.type strings to React components. Types self-register, as with
 * NodeRegistry. Re-registering a typeName overwrites without a warning, for HMR.
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
   * True for CanvasItem types (sprites, tilemaps, 2D physics, Camera2D). The dispatcher
   * renders these only in the 2D canvas, never the 3D viewport, as Godot's editor does.
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
   * Whether this type draws anything of its own. Defaults to `'draws'`.
   * `'transform-only'`: complete while drawing nothing, like a Timer or a joint
   * (ADR-0008), with sheet status `linter-only`. `'pending'`: Godot draws it and this
   * does not yet, so the badge and the sheet show a gap.
   */
  // A pending type keeps its base component. An unregistered type would also lose
  // `visible` (`GenericNodeFallback`) and sit in both canvases (`drawsInWorkspace`),
  // so a 3D emitter would drag its subtree into the 2D one.
  renderIntent?: 'draws' | 'transform-only' | 'pending';
  /**
   * A pass over the authored tree before the graph is built, for a component that
   * cannot reach the node it names: a RemoteTransform's target, a CSGPolygon3D's path.
   * Runs once per parse in stage order, once even when two types share it. See
   * `useParsedScene`.
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
  Renderer: React.ComponentType<{
    item: YSortItem;
    /** The canvas this row draws on, as a rank (`canvasPaintOrder.ts`). */
    layerRank: number;
    /** The row's own draw sequence within its parent's run. */
    sequence: number;
    node: TscnNode;
  }>;
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
  // The whole registration is stored and answers every flag, so a new flag needs no
  // plumbing in `register` or `clear`.
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
