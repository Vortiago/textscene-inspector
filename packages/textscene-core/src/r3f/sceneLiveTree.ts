import type { SceneGraph } from '../core/SceneGraph.js';
import { isGltfPath } from '../godot/import/gltf.js';
import { isEditableInstanceAt } from './editableInstance.js';
import { GLB_SCENE_ROOT_TYPE, glbPathOf, loneGlbRootPath } from '../resources/glbSceneRoot.js';
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
import type { SceneScope, TscnExternalResource, TscnScene } from '../parser/types.js';
import { PROJECT_FILE_PATH } from '../godot/project/project.js';
import { readProjectSettings } from '../resources/projectSettingsFile.js';
import { registerInstanceResource } from '../resources/registerInstanceResource.js';
import { resolveInstancePath } from '../resources/SubResourceResolver.js';
import { sceneReads, type FileRead } from '../resources/loadFailure/fileReads.js';
import { failingReadsOf } from '../resources/loadFailure/sceneFailure.js';
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
import { liveInstancePath, scopeOf } from '../resources/liveNode.js';
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

/** An instance ref, the files it resolves in, and the scene it names. */
interface InstanceRef {
  readonly ref: string | undefined;
  readonly externalResources: readonly TscnExternalResource[];
  readonly path: string;
}

/** The scene the step's node instances: as authored, or, once merged, the one its sub-scene root inherits. */
const instancedSceneOf = perObject(({ raw, step }: LiveLink): InstanceRef | null => {
  const { externalResources } = step.scope;
  if (!step.isMerged)
    return step.instancePath ? { ref: raw.instance, externalResources, path: step.instancePath } : null;
  const path = liveInstancePath(step.node, step.scope);
  return path ? { ref: step.node.instance, externalResources, path } : null;
});

/** The glTF the step's node instances, as authored or through the root of the sub-scene it instances. */
function instancedGltfOf(link: LiveLink): InstanceRef | null {
  const instanced = instancedSceneOf(link);
  return instanced && isGltfPath(instanced.path) ? instanced : null;
}

/** The scene `link` waits on, as Godot has no such node until it loads: a merged root waits on its glTF. */
function awaitedInstanceOf(link: LiveLink, loader: ResourceLoader): InstanceRef | null {
  const { step } = link;
  // A failed or refused instance is a node of its own, as the view draws it with the failed-load mark.
  if (step.isFailedInstance || step.isRefusedInstance) return null;
  if (step.groups.some((group) => group.origin === 'glb')) return null;
  const instanced = step.isMerged ? instancedGltfOf(link) : instancedSceneOf(link);
  return instanced && !(isGltfPath(instanced.path) && hasFailedGltf(loader, instanced.path))
    ? instanced
    : null;
}

function hasFailedGltf(loader: ResourceLoader, path: string): boolean {
  const scene = loader.getCached<TscnScene>('scene', path);
  if (scene === null) return true;
  const glbPath = scene ? loneGlbRootPath(scene.nodes) : undefined;
  return glbPath !== undefined && loader.getCached('glb', glbPath) === null;
}

// Only a file never asked for: a request for a held one emits its answer again, which re-asks a reader.
/** Asks for the scene at `path`, then for each scene its root inherits, as Godot loads a base first. */
function requestSceneChain(loader: ResourceLoader, { ref, externalResources, path }: InstanceRef): void {
  const scene = loader.getCached<TscnScene>('scene', path);
  if (scene === undefined) {
    if (ref) registerInstanceResource(loader, ref, externalResources);
    loader.request('scene', path);
    return;
  }
  if (!scene) return;
  // A glTF's scene is one root that draws the file, whose nodes join the tree once the file loads.
  const glbPath = loneGlbRootPath(scene.nodes);
  if (glbPath) {
    requestGltf(loader, glbPath);
    return;
  }
  const baseRef = scene.nodes.length === 1 ? scene.nodes[0]!.instance : undefined;
  const basePath = baseRef && resolveInstancePath(baseRef, scene.externalResources);
  if (basePath && basePath !== path) {
    requestSceneChain(loader, { ref: baseRef, externalResources: scene.externalResources, path: basePath });
  }
}

function requestGltf(loader: ResourceLoader, glbPath: string): void {
  if (loader.getCached('glb', glbPath) === undefined) loader.request('glb', glbPath);
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

/** How many instances enclose the deepest scene a merged instance root opens, or null for another node. */
const openedDepth = ({ step }: LiveLink) =>
  step.isMerged ? (step.scope.instancedScenePaths?.length ?? 0) : null;

/** Whether `root` opens the scene at `depth`: each scene of its chain of inherited roots, as one instance. */
function opensSceneAt(root: LiveLink, depth: number): boolean {
  const deepest = openedDepth(root);
  return deepest !== null && declaringDepth(root) < depth && depth <= deepest;
}

/** The root of the scene that declares the node, as `add_child` under `instantiate` sets the owner. */
function ownerOf(link: LiveLink, ancestors: readonly LiveLink[]): LiveLink | null {
  if (ancestors.length === 0 || link.raw.isUnowned) return null;
  // The instance node of a glTF is the root its importer builds, so it owns each node of the file.
  const gltfInstance = ancestors.find(
    ({ step }) => step.instancePath !== null && isGltfPath(step.instancePath)
  );
  if (gltfInstance) return gltfInstance;
  const depth = declaringDepth(link);
  for (let index = ancestors.length - 1; index > 0; index--) {
    if (opensSceneAt(ancestors[index]!, depth)) return ancestors[index]!;
  }
  return ancestors[0]!;
}

/** The class Godot gives the node: the glTF importer roots a scene at a Node3D (gltf_document.cpp:6885). */
function godotClassOf(link: LiveLink): string {
  const { type } = link.step.node;
  return type === GLB_SCENE_ROOT_TYPE || instancedGltfOf(link) ? 'Node3D' : type;
}

/** The scene the host opened: its path, and the instances its `[editable]` lines name. */
interface RootScene {
  readonly scenePath: string;
  readonly editablePaths: readonly string[];
}

function treeNodeOf(
  tree: LiveTree,
  link: LiveLink,
  ancestors: readonly LiveLink[],
  root: RootScene,
  placed: () => PatchLookup
): SceneTreeNode {
  const { node, groups, scope } = link.step;
  const parent = ancestors.at(-1) ?? null;
  return {
    name: node.name,
    type: godotClassOf(link),
    rawProperties: node.rawProperties,
    childNames: groups.flatMap((group) => group.children.map((child) => child.name)),
    resourceOf: resourceInScope(scope, root.scenePath),
    containerVisibility: parent && containerVisibilityOf(tree, link, parent),
    sortedProperty: (property) =>
      nodeRegistry.sortedProperties(node.type)?.(node, sortableChildCount(tree, link.step))[property],
    placedProperty: (property) => placedPropertyOf(placed().get(link.path), property),
    sceneFilePath: ancestors.length === 0 ? root.scenePath : (link.step.instancePath ?? ''),
    ownerPath: () => ownerOf(link, ancestors)?.path ?? null,
    isEditableInstance: () => isEditableInstanceAt(link.path, tree.roots, tree.ctx, root.editablePaths),
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
const camerasIn = perObject((loader: ResourceLoader) =>
  perObject((tree: LiveTree): readonly TreeCamera[] => camerasOf(tree, loader))
);

function camerasOf(tree: LiveTree, loader: ResourceLoader): readonly TreeCamera[] {
  const cameras: TreeCamera[] = [];
  tree.fold<string | null, void>(null, (link, viewport, descend) => {
    if (awaitedInstanceOf(link, loader)) return;
    const { type, rawProperties } = link.step.node;
    const dimension = isCamera3DType(type) ? '3D' : isCamera2DType(type) ? '2D' : null;
    if (dimension) cameras.push({ path: link.path, type, dimension, viewport, rawProperties });
    descend(descendsFromClass(type, 'Viewport') ? link.path : viewport);
  });
  return cameras;
}

/** The scene's view of one Live scene tree: a node is found once every instance above it has loaded. */
/** A heading can seat a node under a walked one from an unloaded instance beside it: a miss loads those. */
function requestAwaitedChildren(tree: LiveTree, loader: ResourceLoader, walked: readonly LiveLink[]): void {
  for (const parent of walked)
    for (const group of parent.step.groups)
      for (const child of group.children) {
        const link = tree.at(`${parent.path}/${child.name}`);
        const awaited = link && awaitedInstanceOf(link, loader);
        if (awaited) requestSceneChain(loader, awaited);
      }
}

function sceneTreeOf(
  tree: LiveTree,
  loader: ResourceLoader,
  root: RootScene,
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
        if (!link) {
          requestAwaitedChildren(tree, loader, ancestors);
          return null;
        }
        const awaited = awaitedInstanceOf(link, loader);
        if (awaited) {
          requestSceneChain(loader, awaited);
          return null;
        }
        // The root of a glTF the host opens draws the file, and the file's nodes join once it loads.
        const openedGltfPath = glbPathOf(link.step.node);
        if (openedGltfPath) requestGltf(loader, openedGltfPath);
      }
      return link && treeNodeOf(tree, link, ancestors, root, placed);
    },
    uniquePaths: (livePath) => nodePathUniquePaths(livePath, tree.roots, tree.ctx),
    cameras: () => camerasIn(loader)(tree),
  };
}

const NO_EDITABLE_PATHS: readonly string[] = [];

function rootSceneOf(scene: Scene, graph: SceneGraph): RootScene {
  const editablePaths = graph.scenes.get(graph.rootScene)?.editableInstances ?? NO_EDITABLE_PATHS;
  return { scenePath: scene.rootScenePath, editablePaths };
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
  const scene = root
    ? [{ owner: root.path, reads: sceneReads(root.path, root), failingReads: failingReadsOf(root) }]
    : [];
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
        ? sceneTreeOf(
            liveTreeOf(shared.roots, shared.ctx),
            loader,
            rootSceneOf(scene, graph),
            contentScaleSize
          )
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
    loadedScene: (scenePath) => loader.getCached<TscnScene>('scene', scenePath) ?? null,
    loadedResource: (path) => loader.parsedResource(path),
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
