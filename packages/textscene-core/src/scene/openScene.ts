import type { SceneGraph } from '../core/SceneGraph.js';
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { fileExtension } from '../resources/fileExtension.js';
import { findSubResource } from '../resources/SubResourceResolver.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { parseSubResourcePath } from '../resources/subResourcePath.js';
import { loadedResourceType } from './loadedResourceType.js';
import type { LoadedResource } from './listed/listedProperties.js';
import type { NodeHandle } from './nodeHandle.js';
import { parseTscnContent, type ParseResult } from './parseScene.js';
import type { SceneFailure, SceneFile } from './sceneFiles.js';
import { SceneListeners } from './sceneListeners.js';
import { SceneNodes } from './sceneNodes.js';
import type { CameraState } from './viewportCameras.js';
import { SceneProperties } from './sceneProperties.js';
import type { SceneWrites } from './sceneWrites.js';
import { createSceneRuntime, type SceneRuntime, type SceneTree } from './sceneRuntime.js';
import { variantOf, type Variant } from './variant.js';
import { writtenSceneGraph } from './writtenScene.js';

/** The path a scene opens under when the host names none. */
export const DEFAULT_ROOT_SCENE_PATH = 'res://__inline__.tscn';

const NO_FILES: readonly SceneFile[] = [];

export interface OpenSceneOptions {
  /** The text of the `.tscn` scene. */
  source: string;
  /** How the scene's `res://` files load. */
  provider: ResourceProvider;
  /** The path the scene opens under, which its relative paths resolve from. */
  rootScenePath?: string;
}

export interface Scene {
  readonly rootScenePath: string;
  readonly provider: ResourceProvider;
  /** The parse of the current text. The same object until `setSource` gives another text. */
  parse(): ParseResult;
  /** The parse with the host's writes laid on as instance overrides: what every view draws. */
  written(): SceneGraph | null;
  /** Replaces the text and frees every node, as a scene change does in Godot. The writes are dropped. */
  setSource(source: string): void;
  /** Calls `listener` after a new parse, and a frame after writes or a tree change. Returns the removal. */
  subscribe(listener: () => void): () => void;
  /** Changes at once with each change a view draws: a new text, a write, or a load that changes the tree. */
  revision(): number;
  /** Each file the scene and the project name, by path, none after `dispose`. `subscribe` tells a change. */
  files(): readonly SceneFile[];
  /** Why the game refuses the whole scene, null where it loads or a read still loads. */
  sceneFailure(): SceneFailure | null;
  /** Lets go of every listener. A view of a disposed scene draws its last parse. */
  dispose(): void;
  /** `get_node` from the scene's root node: throws `Node not found` where `path` names no node. */
  getNode(path: string): NodeHandle;
  getNodeOrNull(path: string): NodeHandle | null;
  /** The names the scene's files set on the node at `path`, in file order. Throws as `getNode` does. */
  fileProperties(path: string): readonly string[];
  /** `load`: a value a property of a resource type takes. A missing file draws as a Missing resource. */
  load(path: string): Promise<Variant>;
  /** Calls `listener` when the node at `path` changes, or the tree's shape for null. Returns the removal. */
  observe(path: string | null, listener: () => void): () => void;
  /** The live path of the current Camera3D of the viewport at `viewport`, null for the root window. */
  currentCamera3D(viewport: string | null): string | null;
  /** The live path of the viewport's current Camera2D, null for none. */
  currentCamera2D(viewport: string | null): string | null;
  /** Each camera inside the tree by live path: its viewport, whether it is current and whether it can be. */
  cameras(): ReadonlyMap<string, CameraState>;
}

/** `written` of one parse, writes and resources: the graph is built again only when one of them moves. */
interface WrittenGraph {
  readonly parse: ParseResult;
  readonly writes: SceneWrites;
  readonly resources: readonly TscnExternalResource[];
  readonly graph: SceneGraph | null;
}

/** A section's class and texts, as a class's `_get` reads a resource. */
function sectionOf(section: TscnInternalResource | null): LoadedResource | null {
  return section && { type: section.type, properties: section.data };
}

export function openScene({
  source,
  provider,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
}: OpenSceneOptions): Scene {
  let currentSource = source;
  let parsed: ParseResult | null = null;
  let written: WrittenGraph | null = null;
  /** Written only by `runtime`: made at the first lookup, so a scene no host asks of loads no tree. */
  let sceneRuntime: SceneRuntime | null = null;
  /** Written only by `dispose`: a read of the files after it would build a runtime that nothing disposes. */
  let isDisposed = false;

  const parse = (): ParseResult => (parsed ??= parseTscnContent(currentSource, rootScenePath));
  const graph = (): SceneGraph | null => parse().sceneGraph;
  const properties = new SceneProperties(
    rootScenePath,
    () => graph()?.scenes.get(rootScenePath),
    (livePath) => tree()?.node(livePath) ?? null,
    (livePath) => writtenTree()?.node(livePath) ?? null,
    (path) => resource(path)
  );
  const tree = (): SceneTree | null => {
    const current = graph();
    return current ? runtime().tree(current) : null;
  };
  const writtenTree = (): SceneTree | null => {
    const current = scene.written();
    return current ? runtime().tree(current) : null;
  };
  /** A sub-resource of the root scene, else of a scene the tree has loaded. */
  const subResource = (path: string): TscnInternalResource | null => {
    const { filePath, subResourceId } = parseSubResourcePath(path);
    if (subResourceId === undefined) return null;
    const owner =
      filePath === rootScenePath ? graph()?.scenes.get(rootScenePath) : runtime().loadedScene(filePath);
    return (owner && findSubResource(owner.internalResources, subResourceId)) ?? null;
  };
  /** A sub-resource of a scene through `subResource`, else the resource the loader parses of a file. */
  const resource = async (path: string): Promise<LoadedResource | null> => {
    const { filePath, subResourceId } = parseSubResourcePath(path);
    if (fileExtension(filePath) === '.tscn') return sectionOf(subResource(path));
    const parsed = await runtime().loadedResource(filePath);
    if (!parsed) return null;
    if (subResourceId === undefined) return { type: parsed.resourceType, properties: parsed.properties };
    return sectionOf(findSubResource(parsed.subResources, subResourceId) ?? null);
  };
  /** The class `load` gives: a sub-resource's heading names it, and no file is asked for one. */
  const resourceClass = async (path: string): Promise<string | null> =>
    parseSubResourcePath(path).subResourceId === undefined
      ? loadedResourceType(provider, path)
      : (subResource(path)?.type ?? null);
  const nodes = new SceneNodes({ graph, tree, resourceClass, resource }, properties, (path) =>
    listeners.written(path)
  );
  const listeners = new SceneListeners((path) => nodes.getNodeOrNull(path)?.path ?? null);

  const scene: Scene = {
    rootScenePath,
    provider,
    parse,
    written() {
      const current = parse();
      const writes = properties.writes();
      const resources = properties.resources();
      if (written?.parse !== current || written.writes !== writes || written.resources !== resources) {
        const laid = current.sceneGraph && writtenSceneGraph(current.sceneGraph, writes, resources);
        written = { parse: current, writes, resources, graph: laid };
      }
      return written.graph;
    },
    setSource(next) {
      if (next === currentSource) return;
      currentSource = next;
      parsed = null;
      nodes.clear();
      listeners.textChanged();
    },
    subscribe: (listener) => listeners.subscribe(listener),
    revision: () => listeners.revision(),
    files: () => (isDisposed ? NO_FILES : runtime().files(scene.written()).files),
    sceneFailure: () => (isDisposed ? null : runtime().files(scene.written()).failure),
    dispose() {
      isDisposed = true;
      listeners.clear();
      sceneRuntime?.dispose();
      sceneRuntime = null;
    },
    getNode: (path) => nodes.getNode(path),
    getNodeOrNull: (path) => nodes.getNodeOrNull(path),
    fileProperties: (path) => nodes.fileProperties(nodes.getNode(path).path),
    async load(path) {
      const className = (await resourceClass(path)) ?? undefined;
      return variantOf({ type: T.OBJECT, resource: { path }, ...(className ? { className } : {}) });
    },
    observe: (path, listener) => listeners.observe(path, listener),
    currentCamera3D: (viewport) => nodes.cameras.camera3D(viewport),
    currentCamera2D: (viewport) => nodes.cameras.camera2D(viewport),
    cameras: () => nodes.cameras.states(),
  };

  function runtime(): SceneRuntime {
    if (!sceneRuntime) {
      sceneRuntime = createSceneRuntime(scene);
      sceneRuntime.subscribe(() => listeners.treeChanged());
      sceneRuntime.subscribeFiles(() => listeners.filesChanged());
    }
    return sceneRuntime;
  }

  return scene;
}
