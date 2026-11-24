import type { SceneGraph } from '../core/SceneGraph.js';
import { isGltfPath } from '../godot/import/gltf.js';
import { GLB_SCENE_ROOT_TYPE } from '../resources/glbSceneRoot.js';
import type { ResourceReference } from '../godot/variant/variantValue.js';
import {
  projectDefaultEnvironmentPath,
  projectFontPath,
  projectThemePath,
  projectTreeSettings,
  projectViewportSize,
  type ProjectSettings,
  type ProjectTreeSettings,
  type ProjectViewportSize,
} from '../parser/projectSettingsParser.js';
import type { SceneScope } from '../parser/types.js';
import { PROJECT_FILE_PATH } from '../godot/project/project.js';
import { readProjectSettings } from '../resources/projectSettingsFile.js';
import { registerInstanceResource } from '../resources/registerInstanceResource.js';
import { sceneReads, type FileRead } from '../resources/loadFailure/fileReads.js';
import { createSceneFileWalk, type WalkStart } from '../resources/sceneFiles/sceneFileWalk.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import type { Scene } from '../scene/openScene.js';
import {
  bindSceneRuntime,
  type SceneRuntime,
  type SceneTree,
  type ContainerVisibility,
  type SceneTreeNode,
  type TreeCamera,
} from '../scene/sceneRuntime.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { scopeOf } from '../resources/liveNode.js';
import { isCamera2DType, isCamera3DType } from './cameraNodeTypes.js';
import { perObject } from '../utils/perObject.js';
import type { ContainerWrite } from '../core/childVisibility.js';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { sortableChildCount, writtenSlotOf } from './canvasItemPass/writtenVisibility.js';
import { liveTreeOf, type LiveLink, type LiveTree } from './liveSceneTree.js';
import { nodePathUniquePaths } from './nodePathUniqueNames.js';
import { resourcePipelineOf } from './sceneResourcePipeline.js';
import { currentSharedTree, subscribeToLoadTicks } from './useLiveSceneTree.js';
import { solvedNodePatchesOf } from './liveNodePatches.js';
import { liveFilesOf } from './liveFiles.js';
import type { PatchLookup } from './nodePatch.js';
import { placedPropertyOf } from './placedProperty.js';

/** The scene `link` instances where it has not drawn in yet, as Godot has no such node until it loads. */
function awaitedInstancePath({ step }: LiveLink): string | null {
  const isDrawnIn = step.isMerged || step.groups.some((group) => group.origin === 'glb');
  return isDrawnIn ? null : step.instancePath;
}

// Only a scene never asked for: a request for a held one emits its answer again, which re-asks a reader.
function requestInstance(loader: ResourceLoader, { raw, step }: LiveLink, path: string): void {
  const type = isGltfPath(path) ? 'glb' : 'scene';
  if (loader.getCached(type, path) !== undefined) return;
  if (raw.instance) registerInstanceResource(loader, raw.instance, step.scope.externalResources);
  loader.request(type, path);
}

/** The resource an id of a node's own texts names, in the scene file the node's scope reads. */
function resourceInScope(scope: SceneScope, rootScenePath: string) {
  return (kind: 'ExtResource' | 'SubResource', id: string): ResourceReference | null => {
    if (kind === 'SubResource')
      return { path: `${scope.instancedScenePaths?.at(-1) ?? rootScenePath}::${id}` };
    const ext = scope.externalResources.find((resource) => resource.id === id);
    return ext ? { path: ext.path } : null;
  };
}

/** How many instances enclose the scene that declares `link`'s node. */
const declaringDepth = (link: LiveLink) =>
  scopeOf(link.raw, link.group.scope).instancedScenePaths?.length ?? 0;

/** How many instances enclose the scene a merged instance root opens, or null for another node. */
const openedDepth = ({ step }: LiveLink) =>
  step.isMerged ? (step.scope.instancedScenePaths?.length ?? 0) : null;

/** The root of the scene that declares the node, as `add_child` under `instantiate` sets the owner. */
function ownerOf(link: LiveLink, ancestors: readonly LiveLink[]): LiveLink | null {
  if (ancestors.length === 0 || link.raw.isUnowned) return null;
  const depth = declaringDepth(link);
  for (let index = ancestors.length - 1; index > 0; index--) {
    if (openedDepth(ancestors[index]!) === depth) return ancestors[index]!;
  }
  return ancestors[0]!;
}

/** The class Godot gives the node: the glTF importer roots a scene at a Node3D (gltf_document.cpp:6885). */
const godotClassOf = (type: string) => (type === GLB_SCENE_ROOT_TYPE ? 'Node3D' : type);

function treeNodeOf(
  tree: LiveTree,
  link: LiveLink,
  ancestors: readonly LiveLink[],
  rootScenePath: string,
  placed: () => PatchLookup
): SceneTreeNode {
  const { node, groups, scope } = link.step;
  const parent = ancestors.at(-1) ?? null;
  return {
    name: node.name,
    type: godotClassOf(node.type),
    rawProperties: node.rawProperties,
    childNames: groups.flatMap((group) => group.children.map((child) => child.name)),
    resourceOf: resourceInScope(scope, rootScenePath),
    containerVisibility: parent && containerVisibilityOf(tree, link, parent),
    sortedProperty: (property) =>
      nodeRegistry.sortedProperties(node.type)?.(node, sortableChildCount(tree, link.step))[property],
    placedProperty: (property) => placedPropertyOf(placed().get(link.path), property),
    sceneFilePath: ancestors.length === 0 ? rootScenePath : (link.step.instancePath ?? ''),
    ownerPath: ownerOf(link, ancestors)?.path ?? null,
  };
}

function containerVisibilityOf(tree: LiveTree, link: LiveLink, parent: LiveLink): ContainerVisibility | null {
  const slot = writtenSlotOf(tree, parent.step, link.raw);
  if (!slot) return null;
  const container = parent.step.node;
  const write = nodeRegistry.childVisibilityWrite(container.type);
  return {
    visible: slot.visible,
    containerPath: parent.path,
    writesFor: (visible) => write?.(container, slot.index, slot.count, visible) ?? NO_CONTAINER_WRITES,
  };
}

const NO_CONTAINER_WRITES: readonly ContainerWrite[] = [];

/** Each camera of the loaded tree with its viewport, in the pre-order `NOTIFICATION_ENTER_TREE` takes. */
const camerasOf = perObject((tree: LiveTree): readonly TreeCamera[] => {
  const cameras: TreeCamera[] = [];
  tree.fold<string | null, void>(null, (link, viewport, descend) => {
    if (awaitedInstancePath(link)) return;
    const { type, rawProperties } = link.step.node;
    const dimension = isCamera3DType(type) ? '3D' : isCamera2DType(type) ? '2D' : null;
    if (dimension) cameras.push({ path: link.path, type, dimension, viewport, rawProperties });
    descend(descendsFromClass(type, 'Viewport') ? link.path : viewport);
  });
  return cameras;
});

/** The scene's view of one Live scene tree: a node is found once every instance above it has loaded. */
function sceneTreeOf(
  tree: LiveTree,
  loader: ResourceLoader,
  rootScenePath: string,
  contentScaleSize: ProjectViewportSize
): SceneTree {
  let patches: PatchLookup | undefined;
  const placed = () => (patches ??= solvedNodePatchesOf(tree, liveFilesOf(loader).current()));
  return {
    contentScaleSize,
    node(livePath) {
      const names = livePath.split('/');
      const ancestors: LiveLink[] = [];
      let link: LiveLink | null = null;
      for (let depth = 1; depth <= names.length; depth++) {
        if (link) ancestors.push(link);
        link = tree.at(names.slice(0, depth).join('/'));
        if (!link) return null;
        const awaited = awaitedInstancePath(link);
        if (awaited) {
          requestInstance(loader, link, awaited);
          return null;
        }
      }
      return link && treeNodeOf(tree, link, ancestors, rootScenePath, placed);
    },
    uniquePaths: (livePath) => nodePathUniquePaths(livePath, tree.roots, tree.ctx),
    cameras: () => camerasOf(tree),
  };
}

const NO_CAMERAS: readonly TreeCamera[] = [];
const NO_TREE: Omit<SceneTree, 'contentScaleSize'> = {
  node: () => null,
  uniquePaths: () => new Map(),
  cameras: () => NO_CAMERAS,
};

/** Godot loads these files as the game starts, for every scene (theme_db.cpp:52-53). */
function projectReads(settings: ProjectSettings | null): FileRead[] {
  const named: [string | null, string][] = [
    [projectDefaultEnvironmentPath(settings), 'Environment'],
    [projectThemePath(settings), 'Theme'],
    [projectFontPath(settings), 'Font'],
  ];
  return named.flatMap(([path, type]) => (path?.startsWith('res://') ? [{ path, type }] : []));
}

/** Undefined while the engine reads the project settings, null where the project has none. */
type ProjectRead = ProjectSettings | null | undefined;

function walkStarts(graph: SceneGraph | null, settings: ProjectRead): WalkStart[] {
  const root = graph?.scenes.get(graph.rootScene);
  const scene = root ? [{ owner: root.path, reads: sceneReads(root.path, root) }] : [];
  if (settings === null) return scene;
  const engine = {
    owner: null,
    reads: [{ path: PROJECT_FILE_PATH, type: 'ProjectSettings' }],
    isReading: settings === undefined,
  };
  return [...scene, engine, { owner: PROJECT_FILE_PATH, reads: projectReads(settings ?? null) }];
}

/** The Live scene tree of `scene`, over the loader every view of it shares. */
function sceneRuntimeOf(scene: Scene): SceneRuntime {
  const { loader } = resourcePipelineOf(scene);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const fileListeners = new Set<() => void>();
  const notifyFiles = () => {
    for (const listener of [...fileListeners]) listener();
  };
  const fileWalk = createSceneFileWalk(loader, notifyFiles);
  let settings: ProjectRead;
  /** Written only by `files`. A write moves the graph on each drag frame, so equal reads keep the starts. */
  let starts: { graph: SceneGraph | null; settings: ProjectRead; key: string; starts: WalkStart[] } | null =
    null;
  let project: ProjectTreeSettings = projectTreeSettings(null);
  let contentScaleSize = projectViewportSize(null);
  const readProject = async () => {
    const bus = loader.fileEventBus;
    settings = bus ? await readProjectSettings(bus) : null;
    project = projectTreeSettings(settings ?? null);
    contentScaleSize = projectViewportSize(settings ?? null);
    notify();
    notifyFiles();
  };
  const onInvalidated = (path: string) => {
    if (path === PROJECT_FILE_PATH) void readProject();
  };
  void readProject();
  loader.fileEventBus?.on('invalidated', onInvalidated);
  const stopTicks = subscribeToLoadTicks(loader, notify);
  return {
    tree(graph: SceneGraph) {
      const shared = currentSharedTree(graph, loader, project);
      return shared
        ? sceneTreeOf(liveTreeOf(shared.roots, shared.ctx), loader, scene.rootScenePath, contentScaleSize)
        : { ...NO_TREE, contentScaleSize };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    files(graph) {
      if (starts?.graph !== graph || starts.settings !== settings) {
        const next = walkStarts(graph, settings);
        const key = JSON.stringify(next);
        starts = { graph, settings, key, starts: key === starts?.key ? starts.starts : next };
      }
      return fileWalk.files(starts.starts);
    },
    subscribeFiles(listener) {
      fileListeners.add(listener);
      return () => fileListeners.delete(listener);
    },
    dispose() {
      fileWalk.dispose();
      fileListeners.clear();
      listeners.clear();
      stopTicks();
      loader.fileEventBus?.off('invalidated', onInvalidated);
    },
  };
}

bindSceneRuntime(sceneRuntimeOf);
