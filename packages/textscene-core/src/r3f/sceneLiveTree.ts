import type { SceneGraph } from '../core/SceneGraph.js';
import { isGltfPath } from '../godot/import/gltf.js';
import type { ResourceReference } from '../godot/variant/variantValue.js';
import { projectTreeSettings, type ProjectTreeSettings } from '../parser/projectSettingsParser.js';
import type { SceneScope } from '../parser/types.js';
import { PROJECT_FILE_PATH } from '../godot/project/project.js';
import { readProjectSettings } from '../resources/projectSettingsFile.js';
import { registerInstanceResource } from '../resources/registerInstanceResource.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import type { Scene } from '../scene/openScene.js';
import {
  bindSceneRuntime,
  type SceneRuntime,
  type SceneTree,
  type SceneTreeNode,
} from '../scene/sceneRuntime.js';
import { liveTreeOf, type LiveLink, type LiveTree } from './liveSceneTree.js';
import { nodePathUniquePaths } from './nodePathUniqueNames.js';
import { resourcePipelineOf } from './sceneResourcePipeline.js';
import { currentSharedTree, subscribeToLoadTicks } from './useLiveSceneTree.js';

/** The scene `link` instances where it has not drawn in yet, as Godot has no such node until it loads. */
function awaitedInstancePath({ step }: LiveLink): string | null {
  const isDrawnIn = step.isMerged || step.groups.some((group) => group.origin === 'glb');
  return isDrawnIn ? null : step.instancePath;
}

function requestInstance(loader: ResourceLoader, { raw, step }: LiveLink, path: string): void {
  if (raw.instance) registerInstanceResource(loader, raw.instance, step.scope.externalResources);
  loader.request(isGltfPath(path) ? 'glb' : 'scene', path);
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

function treeNodeOf(link: LiveLink, rootScenePath: string): SceneTreeNode {
  const { node, groups, scope } = link.step;
  return {
    name: node.name,
    type: node.type,
    rawProperties: node.rawProperties,
    childNames: groups.flatMap((group) => group.children.map((child) => child.name)),
    resourceOf: resourceInScope(scope, rootScenePath),
  };
}

/** The scene's view of one Live scene tree: a node is found once every instance above it has loaded. */
function sceneTreeOf(tree: LiveTree, loader: ResourceLoader, rootScenePath: string): SceneTree {
  return {
    node(livePath) {
      const names = livePath.split('/');
      let link: LiveLink | null = null;
      for (let depth = 1; depth <= names.length; depth++) {
        link = tree.at(names.slice(0, depth).join('/'));
        if (!link) return null;
        const awaited = awaitedInstancePath(link);
        if (awaited) {
          requestInstance(loader, link, awaited);
          return null;
        }
      }
      return link && treeNodeOf(link, rootScenePath);
    },
    uniquePaths: (livePath) => nodePathUniquePaths(livePath, tree.roots, tree.ctx),
  };
}

const NO_TREE: SceneTree = { node: () => null, uniquePaths: () => new Map() };

/** The Live scene tree of `scene`, over the loader every view of it shares. */
function sceneRuntimeOf(scene: Scene): SceneRuntime {
  const { loader } = resourcePipelineOf(scene);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  let project: ProjectTreeSettings = projectTreeSettings(null);
  const readProject = async () => {
    const bus = loader.fileEventBus;
    project = projectTreeSettings(bus ? await readProjectSettings(bus) : null);
    notify();
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
        ? sceneTreeOf(liveTreeOf(shared.roots, shared.ctx), loader, scene.rootScenePath)
        : NO_TREE;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      stopTicks();
      loader.fileEventBus?.off('invalidated', onInvalidated);
    },
  };
}

bindSceneRuntime(sceneRuntimeOf);
