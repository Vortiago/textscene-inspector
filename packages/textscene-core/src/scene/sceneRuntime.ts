import type { ContainerWrite } from '../core/childVisibility.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { ProjectViewportSize } from '../parser/projectSettingsParser.js';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { TscnScene } from '../parser/types.js';
import type { ResourceReference, VariantValue } from '../godot/variant/variantValue.js';
import type { Scene } from './openScene.js';
import type { WalkedFiles } from '../resources/sceneFiles/sceneFileWalk.js';

/** A node of the Live scene tree as the scene reads it: its own instance overrides and writes laid on. */
export interface SceneTreeNode {
  readonly name: string;
  /** The Godot class, the sub-scene root's where an instance merged into it. */
  readonly type: string;
  readonly rawProperties: Readonly<Record<string, string>>;
  readonly childNames: readonly string[];
  /** The resource an `ExtResource` or `SubResource` of the node's own texts names, or null with none. */
  resourceOf(kind: 'ExtResource' | 'SubResource', id: string): ResourceReference | null;
  /** The `visible` the parent container writes on the node, or null where none writes it. */
  readonly containerVisibility: ContainerVisibility | null;
  /** The value the node's getter resolves from its sortable children, else undefined. */
  sortedProperty(property: string): VariantValue | undefined;
  /** The value a live pass lays over the stored one, a RemoteTransform target's pose, else undefined. */
  placedProperty(property: string): VariantValue | undefined;
  /** The scene the node instances, or the root scene's own path for the root node, else empty. */
  readonly sceneFilePath: string;
  /** The live path of the root of the scene that declares the node, null for the root node. */
  ownerPath(): string | null;
  /** Whether an `[editable]` of any file that encloses the node lists it (`packed_scene.cpp:691-695`). */
  isEditableInstance(): boolean;
}

/** A container's hold on one sortable child's `visible`, as its sort writes it. */
export interface ContainerVisibility {
  readonly visible: boolean;
  readonly containerPath: string;
  /** What the container writes on itself when the child's `visible` is set. */
  writesFor(visible: boolean): readonly ContainerWrite[];
}

/** A Camera3D or a Camera2D of the loaded tree, as it enters its viewport. */
export interface TreeCamera {
  readonly path: string;
  readonly type: string;
  readonly dimension: '3D' | '2D';
  /** The live path of the nearest Viewport above the camera, null for the root window. */
  readonly viewport: string | null;
  readonly rawProperties: Readonly<Record<string, string>>;
}

/** The Live scene tree over one written graph and one snapshot of the loads. */
export interface SceneTree {
  /** Null where the loaded tree has no such node. It loads each scene the walk enters unloaded. */
  node(livePath: string): SceneTreeNode | null;
  /** The `%Name` table a NodePath on the node reads, to live paths (`node.cpp:1930-1938`). */
  uniquePaths(livePath: string): ReadonlyMap<string, string>;
  /** The cameras of the loaded nodes in the order they enter the tree. The same array while no load moves. */
  cameras(): readonly TreeCamera[];
  /** The root window's `content_scale_size`, the project's viewport size: its default until the read ends. */
  readonly contentScaleSize: ProjectViewportSize;
}

/** What the scene reads of the renderer: the Live scene tree and its loads. */
export interface SceneRuntime {
  tree(graph: SceneGraph): SceneTree;
  /** Calls `listener` when a load changes the tree. Returns the removal. */
  subscribe(listener: () => void): () => void;
  /** The files the root scene and the project name, and the failure. The same object while none moves. */
  files(graph: SceneGraph | null): WalkedFiles;
  /** Calls `listener` when a load answers for one of those files. Returns the removal. */
  subscribeFiles(listener: () => void): () => void;
  /** The parse of the scene at `scenePath`, null before it loads. */
  loadedScene(scenePath: string): TscnScene | null;
  /** The parse of the `.tres` or `.res` file at `path`, null where it does not load. */
  loadedResource(path: string): Promise<ParsedResource | null>;
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
