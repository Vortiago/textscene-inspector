/**
 * The visibility-range cull of a scene's geometry instances, run once for each render of the
 * scene, before its render list and its shadow pass. Each render camera keeps its own hysteresis
 * state, as each Godot viewport does (`renderer_scene_cull.h:301`).
 */

import * as THREE from 'three';
import { acyclicParents, cullVisibility, type VisibilityCullInstance } from '../../godot/visibilityCull';
import { NO_VISIBILITY_RANGE, type VisibilityRange } from '../../godot/visibilityRange';
import { observeSceneCull } from '../sceneRenderCamera';
import { sceneSplitsHold } from '../directionalShadow/fitSceneDirectionalShadows';
import { compareTreeOrder, type TreeOrder } from '../contexts/TreeOrderContext';

/** Where an instance's node sits in the scene tree, and which node it names as visibility parent. */
export interface NodePlace {
  /** Its node path, or null outside the dispatcher, where nothing can name it as a parent. */
  readonly path: string | null;
  /** The node path of its visibility parent, or null for none. */
  readonly parentPath: string | null;
  /** Godot sets the visibility links in tree order, as each node enters the tree (`node_3d.cpp:176`). */
  readonly order: TreeOrder;
}

/** What places an instance in the cull's topology: which instances it measures, and their links. */
export interface VisibilityLinks extends NodePlace {
  readonly hasRange: boolean;
}

/** A GeometryInstance3D as the scene cull sees it. */
export interface VisibilityInstance {
  /** A new object whenever a field changes, so the cull rebuilds its topology only then. */
  readonly links: VisibilityLinks;
  readonly range: VisibilityRange;
  /**
   * Whether its pose and its box are known. The cull keeps the last result of an instance it cannot
   * place, and of each of its dependants, and hides one it has never measured. Godot never holds
   * an instance it cannot measure.
   */
  readonly isPlaced: boolean;
  /** Whether the scene cull indexes it (`godot/visibilityCull.ts`). Read only while it is placed. */
  readonly isIndexed: boolean;
  /** Writes its world AABB, while it is placed. The scene's world matrices are current when the cull calls it. */
  worldBox(target: THREE.Box3): void;
  /** Takes the cull's result for the render about to draw: whether it draws, and its range fade. */
  apply(isVisible: boolean, fade: number): void;
}

interface InstanceState {
  /** The links the topology was built from. */
  links: VisibilityLinks;
  /** Whether the cull has measured it once, so a later render it cannot measure keeps that result. */
  hasResult: boolean;
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
  registry.instances.set(instance, { links: instance.links, hasResult: false, wasVisible: new WeakMap() });
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
  const isMeasured = measuredMembers(members, parents);
  const inputs = members.map((instance, i): VisibilityCullInstance => {
    if (!isMeasured[i]) return unmeasuredInput(parents[i]!);
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
    const state = states[i]!;
    if (!isMeasured[i]) {
      if (!state.hasResult) members[i]!.apply(false, 1);
      return;
    }
    state.hasResult = true;
    state.wasVisible.set(camera, result.wasVisible);
    members[i]!.apply(result.isVisible, result.fade);
  });
}

/**
 * Whether the cull can measure each member: it is placed, and so is each visibility parent above
 * it along the links Godot keeps. A dependant's result reads its parent's.
 */
function measuredMembers(members: readonly VisibilityInstance[], parents: readonly number[]): boolean[] {
  const isPlaced = members.map((instance) => instance.isPlaced);
  const links = acyclicParents(parents);
  return members.map((_, i) => {
    for (let at = i; at >= 0; at = links[at]!) if (!isPlaced[at]) return false;
    return true;
  });
}

/** A stand-in for a member the cull cannot measure: it keeps its links, and its result is dropped. */
function unmeasuredInput(parent: number): VisibilityCullInstance {
  return {
    range: NO_VISIBILITY_RANGE,
    isIndexed: false,
    parent,
    distance: 0,
    isInView: false,
    wasVisible: false,
  };
}

/** The registry's topology, rebuilt when an instance joined, left or relinked since the last cull. */
function currentTopology(registry: SceneInstances): Topology {
  for (const [instance, state] of registry.instances) {
    if (instance.links === state.links) continue;
    state.links = instance.links;
    registry.topology = null;
  }
  registry.topology ??= buildTopology(inTreeOrder(registry.instances.keys()));
  return registry.topology;
}

/** Stable, so instances outside the dispatcher, which tie at the root, keep registration order. */
function inTreeOrder(instances: Iterable<VisibilityInstance>): VisibilityInstance[] {
  return [...instances].sort((a, b) => compareTreeOrder(a.links.order, b.links.order));
}

/**
 * The instances the cull must measure, those with a range, a parent or a dependant, each with its
 * parent's index, from `instances` in tree order. A parent path that names no registered instance
 * is no parent.
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
  // In tree order, not `parentOf`'s, which takes a parent before its own turn: the cull refuses
  // the later link that closes a cycle.
  const members = instances.filter((instance) => parentOf.has(instance));
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
