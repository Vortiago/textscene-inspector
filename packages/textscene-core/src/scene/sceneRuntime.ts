import type { SceneGraph } from '../core/SceneGraph.js';
import type { ResourceReference } from '../godot/variant/variantValue.js';
import type { Scene } from './openScene.js';

/** A node of the Live scene tree as the scene reads it: its own instance overrides and writes laid on. */
export interface SceneTreeNode {
  readonly name: string;
  /** The Godot class, the sub-scene root's where an instance merged into it. */
  readonly type: string;
  readonly rawProperties: Readonly<Record<string, string>>;
  readonly childNames: readonly string[];
  /** The resource an `ExtResource` or `SubResource` of the node's own texts names, or null with none. */
  resourceOf(kind: 'ExtResource' | 'SubResource', id: string): ResourceReference | null;
}

/** The Live scene tree over one written graph and one snapshot of the loads. */
export interface SceneTree {
  /** Null where the loaded tree has no such node. It asks for each scene its walk enters and finds unloaded. */
  node(livePath: string): SceneTreeNode | null;
  /** The `%Name` table a NodePath on the node at `livePath` reads, `%Name` to live path (`node.cpp:1930-1938`). */
  uniquePaths(livePath: string): ReadonlyMap<string, string>;
}

/** What the scene reads of the renderer: the Live scene tree and its loads. */
export interface SceneRuntime {
  tree(graph: SceneGraph): SceneTree;
  /** Calls `listener` when a load changes the tree. Returns the removal. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

type RuntimeFactory = (scene: Scene) => SceneRuntime;

/** Written only by {@link bindSceneRuntime}, once the renderer's Live scene tree loads. */
let runtimeFactory: RuntimeFactory | null = null;

/** The renderer binds its Live scene tree here, so the scene module imports no React and no three.js. */
export function bindSceneRuntime(factory: RuntimeFactory): void {
  runtimeFactory = factory;
}

export function createSceneRuntime(scene: Scene): SceneRuntime {
  if (!runtimeFactory) {
    throw new Error(
      'expected the renderer to bind the Live scene tree, found none: import @textscene/renderer'
    );
  }
  return runtimeFactory(scene);
}
