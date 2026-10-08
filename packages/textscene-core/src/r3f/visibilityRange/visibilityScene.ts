/**
 * The visibility-range cull of a scene's geometry instances, run once for each render of the
 * scene, before its render list and its shadow pass. Each render camera keeps its own hysteresis
 * state, as each Godot viewport does (`renderer_scene_cull.h:301`).
 */

import * as THREE from 'three';
import { cullVisibility, type VisibilityCullInstance } from '../../godot/visibilityCull';
import type { VisibilityRange } from '../../godot/visibilityRange';
import { observeSceneCull } from '../sceneRenderCamera';
import { sceneSplitsHold } from '../directionalShadow/fitSceneDirectionalShadows';

/** What places an instance in the cull's topology: which instances it measures, and their links. */
export interface VisibilityLinks {
  /** Its node path, or null outside the dispatcher, where nothing can name it as a parent. */
  readonly path: string | null;
  /** The node path of its visibility parent, or null for none. */
  readonly parentPath: string | null;
  readonly hasRange: boolean;
}

/** A GeometryInstance3D as the scene cull sees it. */
export interface VisibilityInstance {
  /** A new object whenever a field changes, so the cull rebuilds its topology only then. */
  readonly links: VisibilityLinks;
  readonly range: VisibilityRange;
  /** Whether the scene cull indexes it (`godot/visibilityCull.ts`). */
  readonly isIndexed: boolean;
  /** Writes its world AABB. The scene's world matrices are current when the cull calls it. */
  worldBox(target: THREE.Box3): void;
  /** Takes the cull's result for the render about to draw: whether it draws, and its range fade. */
  apply(isVisible: boolean, fade: number): void;
}

interface InstanceState {
  /** The links the topology was built from. */
  links: VisibilityLinks;
  /** Its `viewport_state` bit per render camera. */
  wasVisible: WeakMap<THREE.Camera, boolean>;
}

/** The instances the cull measures, each with its parent's index among them, and the rest. */
interface Topology {
  members: VisibilityInstance[];
  parents: number[];
  unmeasured: VisibilityInstance[];
}

interface SceneInstances {
  /** In registration order, which stands for the order Godot sets the parent links. */
  instances: Map<VisibilityInstance, InstanceState>;
  /** Null once an instance joins, leaves or relinks, until the next cull rebuilds it. */
  topology: Topology | null;
  stopObserving: () => void;
}

/** Written only by `registerVisibilityInstance`. A scene leaves it with its last instance. */
const scenes = new WeakMap<THREE.Scene, SceneInstances>();

/** Adds `instance` to the cull of `scene` until the returned function runs. */
export function registerVisibilityInstance(scene: THREE.Scene, instance: VisibilityInstance): () => void {
  const registry = scenes.get(scene) ?? createRegistry(scene);
  registry.instances.set(instance, { links: instance.links, wasVisible: new WeakMap() });
  registry.topology = null;
  return () => {
    registry.instances.delete(instance);
    registry.topology = null;
    if (registry.instances.size > 0) return;
    registry.stopObserving();
    scenes.delete(scene);
  };
}

function createRegistry(scene: THREE.Scene): SceneInstances {
  const registry: SceneInstances = { instances: new Map(), topology: null, stopObserving: () => {} };
  registry.stopObserving = observeSceneCull(scene, (camera) => cullScene(scene, registry, camera));
  scenes.set(scene, registry);
  return registry;
}

/** Scratch, reused by every cull: three renders one scene at a time. */
const viewProjection = new THREE.Matrix4();
const cameraFrustum = new THREE.Frustum();
const cameraPosition = new THREE.Vector3();
const box = new THREE.Box3();
const boxCentre = new THREE.Vector3();

function cullScene(scene: THREE.Scene, registry: SceneInstances, camera: THREE.Camera): void {
  const { members, parents, unmeasured } = currentTopology(registry);
  for (const instance of unmeasured) instance.apply(true, 1);
  if (members.length === 0) return;

  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cameraFrustum.setFromProjectionMatrix(viewProjection);
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);

  const states = members.map((instance) => registry.instances.get(instance)!);
  const inputs = members.map((instance, i): VisibilityCullInstance => {
    instance.worldBox(box);
    return {
      range: instance.range,
      isIndexed: instance.isIndexed,
      parent: parents[i]!,
      distance: cameraPosition.distanceTo(box.getCenter(boxCentre)),
      isInView: cameraFrustum.intersectsBox(box) || sceneSplitsHold(scene, box),
      wasVisible: states[i]!.wasVisible.get(camera) ?? false,
    };
  });
  cullVisibility(inputs).forEach((result, i) => {
    states[i]!.wasVisible.set(camera, result.wasVisible);
    members[i]!.apply(result.isVisible, result.fade);
  });
}

/** The registry's topology, rebuilt when an instance joined, left or relinked since the last cull. */
function currentTopology(registry: SceneInstances): Topology {
  for (const [instance, state] of registry.instances) {
    if (instance.links === state.links) continue;
    state.links = instance.links;
    registry.topology = null;
  }
  registry.topology ??= buildTopology([...registry.instances.keys()]);
  return registry.topology;
}

/**
 * The instances the cull must measure, those with a range, a parent or a dependant, each with its
 * parent's index. A parent path that names no registered instance is no parent.
 */
function buildTopology(instances: readonly VisibilityInstance[]): Topology {
  const byPath = new Map<string, VisibilityInstance>();
  for (const instance of instances)
    if (instance.links.path !== null) byPath.set(instance.links.path, instance);

  const parentOf = new Map<VisibilityInstance, VisibilityInstance | null>();
  for (const instance of instances) {
    const { parentPath, hasRange } = instance.links;
    const parent = parentPath === null ? undefined : byPath.get(parentPath);
    if (parent) {
      parentOf.set(instance, parent);
      if (!parentOf.has(parent)) parentOf.set(parent, null);
    } else if (hasRange && !parentOf.has(instance)) {
      parentOf.set(instance, null);
    }
  }
  const members = [...parentOf.keys()];
  const indexOf = new Map(members.map((instance, i) => [instance, i]));
  return {
    members,
    parents: members.map((instance) => {
      const parent = parentOf.get(instance);
      return parent ? indexOf.get(parent)! : -1;
    }),
    unmeasured: instances.filter((instance) => !parentOf.has(instance)),
  };
}
