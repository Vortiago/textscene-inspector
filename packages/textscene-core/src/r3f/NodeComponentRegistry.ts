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
import { descendsFromClass } from '../godot/classdb/classBaseTypes';
import { withGeometryInstance } from './visibilityRange/geometryInstance';
import { isInvisibleBase } from './invisibleBase';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent';
import type { EditorIconRegistration } from './nodeIcon/editorIconRegistration';

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
   * `'transform-only'`: its runtime effect is nil or already implemented (ADR-0008).
   * A nil effect takes sheet status `linter-only`; an implemented driver (a
   * RemoteTransform relay, an AnimationPlayer's tracks) compares on `done` or
   * `limitation`.
   * `'pending'`: Godot draws or drives with it and this does not yet (ADR-0045), so
   * the badge and the sheet show a gap and the sheet is `unimplemented`.
   */
  // A pending type keeps its base component. An unregistered type would also lose
  // `visible` (`GenericNodeFallback`) and sit in both canvases (`drawsInWorkspace`),
  // so a 3D emitter would drag its subtree into the 2D one.
  renderIntent?: 'draws' | 'transform-only' | 'pending';
  /**
   * A pass for a component that cannot reach the node it names: a RemoteTransform's target, a
   * CSGPolygon3D's path, a MeshInstance3D's skeleton. A parse stage pass runs over the authored
   * tree before the graph is built, once per parse in stage order, once even when two types share
   * it (`useParsedScene`). A `live` registration declares a pass over the Live scene tree, which
   * its reader names (`useLiveScenePass`, ADR-0060).
   */
  scenePass?: ScenePassRegistration;
  /**
   * Present for a CanvasItem that the y-sort pass decomposes into per-row
   * groups rather than dispatching whole (a TileMapLayer): what to read off the
   * node, and the component that draws one group. See `YSortDispatcher`.
   */
  ySortGroup?: YSortGroupRegistration;
  /**
   * The billboard icon Godot's 3D editor draws at the node's origin (ADR-0056). The dispatcher
   * mounts it inside the node's transform for every render intent, so a `pending` or `transform-only`
   * type keeps its status.
   */
  editorIcon?: EditorIconRegistration;
}

export interface YSortGroupDescription {
  tileSetRef: string;
  /** The layer's own `position.y`, added to the accumulated world Y. */
  positionY: number;
  ySortOrigin: number;
  cells: readonly PlacedCell[] | null;
}

interface YSortGroupRegistration {
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
export type ParseScenePass = (
  nodes: TscnNode[],
  internalResources: readonly TscnInternalResource[]
) => TscnNode[];

/** A pass and the types whose registrations carry it. */
interface RegisteredParseScenePass {
  run: ParseScenePass;
  typeNames: string[];
}

/**
 * `transforms` passes move nodes; `paths` passes read where nodes ended up, so
 * every transform pass runs before any path pass whatever the barrel order.
 */
interface ParseScenePassRegistration {
  stage: 'transforms' | 'paths';
  run: ParseScenePass;
}

/** A drive on the live stage. The reader names the pass, so the registry runs nothing. */
interface LiveScenePassRegistration {
  stage: 'live';
}

type ScenePassRegistration = ParseScenePassRegistration | LiveScenePassRegistration;

/**
 * The badge reads the declared intent, so it must agree with the component: a `pending` gap
 * mounts only an invisible base, and a `draws` type draws. The one exception is the 3D
 * pass-through (`container`) of a 2D-UI type, which its Control component draws.
 */
function assertIntentMatchesComponent({
  typeName,
  Component,
  renderIntent = 'draws',
  container,
}: NodeComponentRegistration) {
  const mountsBase = isInvisibleBase(Component);
  if (renderIntent === 'pending' && !mountsBase) {
    throw new Error(
      `${typeName}: renderIntent 'pending' expects an invisible base, got a component that draws`
    );
  }
  if (renderIntent === 'draws' && mountsBase && !(container && TWO_D_UI_TYPES.has(typeName))) {
    throw new Error(
      `${typeName}: renderIntent 'draws' expects a component that draws, got an invisible base`
    );
  }
}

const PARSE_STAGES: readonly ParseScenePassRegistration['stage'][] = ['transforms', 'paths'];

class NodeComponentRegistryImpl {
  // The whole registration is stored and answers every flag, so a new flag needs no
  // plumbing in `register` or `clear`.
  private readonly registry = createTypeRegistry<NodeComponentRegistration>('NodeComponentRegistry');

  /**
   * A GeometryInstance3D type's component is mounted inside the node's place in the scene cull,
   * drawn or not, so every such type takes part in the visibility range.
   */
  register(registration: NodeComponentRegistration): void {
    assertIntentMatchesComponent(registration);
    const { typeName, Component } = registration;
    const mounted = descendsFromClass(typeName, 'GeometryInstance3D')
      ? withGeometryInstance(Component)
      : Component;
    this.registry.register(typeName, { ...registration, Component: mounted });
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

  /** True for an unregistered type or a container: the dispatcher mounts it in either workspace. */
  passesThrough(typeName: string): boolean {
    const registration = this.registry.get(typeName);
    return registration === undefined || registration.container === true;
  }

  /** True when the type takes part in CSG boolean evaluation. */
  isCsgShape(typeName: string): boolean {
    return this.registry.get(typeName)?.csgShape !== undefined;
  }

  /** The declared intent, or undefined when the type registers no component. */
  renderIntentOf(typeName: string): NodeComponentRegistration['renderIntent'] | undefined {
    const registration = this.registry.get(typeName);
    return registration === undefined ? undefined : (registration.renderIntent ?? 'draws');
  }

  /** The icon registration of a type, or undefined when Godot's editor draws no icon for it. */
  editorIconOf(typeName: string): EditorIconRegistration | undefined {
    return this.registry.get(typeName)?.editorIcon;
  }

  getYSortGroup(typeName: string): YSortGroupRegistration | undefined {
    return this.registry.get(typeName)?.ySortGroup;
  }

  /** The CSG registration for a type, or undefined when it is not a CSG shape. */
  getCsgShape(typeName: string): CsgShapeRegistration | undefined {
    return this.registry.get(typeName)?.csgShape;
  }

  getAllTypeNames(): string[] {
    return this.registry.getAllTypeNames();
  }

  /**
   * The registered parse stage passes, each once with the types that share it, in stage order then
   * registration order.
   */
  parseScenePasses(): readonly RegisteredParseScenePass[] {
    const byRun = new Map<ParseScenePass, RegisteredParseScenePass>();
    for (const stage of PARSE_STAGES) {
      for (const typeName of this.registry.getAllTypeNames()) {
        const pass = this.registry.get(typeName)?.scenePass;
        if (pass?.stage !== stage) continue;
        const registered = byRun.get(pass.run) ?? { run: pass.run, typeNames: [] };
        registered.typeNames.push(typeName);
        byRun.set(pass.run, registered);
      }
    }
    return [...byRun.values()];
  }

  /** Every type that registers a pass on either stage: each acts on nodes other than its own. */
  scenePassTypeNames(): ReadonlySet<string> {
    return new Set(
      this.registry.getAllTypeNames().filter((typeName) => this.registry.get(typeName)?.scenePass)
    );
  }

  clear(): void {
    this.registry.clear();
  }
}

export const nodeComponentRegistry = new NodeComponentRegistryImpl();
