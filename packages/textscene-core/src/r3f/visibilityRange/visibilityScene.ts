/**
 * The visibility-range cull of a scene's geometry instances, run once for each render of the
 * scene, before its render list and its shadow pass. Each render camera keeps its own hysteresis
 * state, as each Godot viewport does (`renderer_scene_cull.h:301`).
 */

import * as THREE from 'three';
import { cullVisibility, type VisibilityCullInstance } from '../../godot/visibilityCull';
import { hasVisibilityRange, type VisibilityRange } from '../../godot/visibilityRange';
import { observeSceneCull } from '../sceneRenderCamera';
import { sceneSplitsHold } from '../directionalShadow/fitSceneDirectionalShadows';

/** A GeometryInstance3D as the scene cull sees it. */
export interface VisibilityInstance {
  /** Its node path, or null outside the dispatcher, where nothing can name it as a parent. */
  readonly path: string | null;
  readonly range: VisibilityRange;
  /** The node path of its visibility parent, or null for none. */
  readonly parentPath: string | null;
  /** Writes its world AABB. The scene's world matrices are current when the cull calls it. */
  worldBox(target: THREE.Box3): void;
  /** Takes the cull's result for one render. Only a canvas render's `fade` reaches React. */
  apply(isVisible: boolean, fade: number, isCanvasRender: boolean): void;
}

interface SceneInstances {
  /** In registration order, which stands for the order Godot sets the parent links. */
  instances: Set<VisibilityInstance>;
  /** Each instance's `viewport_state` bit per render camera. */
  wasVisible: WeakMap<VisibilityInstance, WeakMap<THREE.Camera, boolean>>;
  stopObserving: () => void;
}

/** Written only by `registerVisibilityInstance`. A scene leaves it with its last instance. */
const scenes = new WeakMap<THREE.Scene, SceneInstances>();

/** Adds `instance` to the cull of `scene` until the returned function runs. */
export function registerVisibilityInstance(scene: THREE.Scene, instance: VisibilityInstance): () => void {
  let registry = scenes.get(scene);
  if (!registry) {
    const created: SceneInstances = {
      instances: new Set(),
      wasVisible: new WeakMap(),
      stopObserving: () => {},
    };
    created.stopObserving = observeSceneCull(scene, (camera, target) =>
      cullScene(scene, created, camera, target === null)
    );
    scenes.set(scene, created);
    registry = created;
  }
  registry.instances.add(instance);
  registry.wasVisible.set(instance, new WeakMap());

  const owner = registry;
  return () => {
    owner.instances.delete(instance);
    if (owner.instances.size > 0) return;
    owner.stopObserving();
    scenes.delete(scene);
  };
}

/** Scratch, reused by every cull: three renders one scene at a time. */
const viewProjection = new THREE.Matrix4();
const cameraFrustum = new THREE.Frustum();
const cameraPosition = new THREE.Vector3();
const box = new THREE.Box3();
const boxCentre = new THREE.Vector3();

function cullScene(
  scene: THREE.Scene,
  registry: SceneInstances,
  camera: THREE.Camera,
  isCanvasRender: boolean
): void {
  const culled = culledInstances(registry.instances);
  for (const instance of registry.instances) {
    if (!culled.has(instance)) instance.apply(true, 1, isCanvasRender);
  }
  if (culled.size === 0) return;

  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cameraFrustum.setFromProjectionMatrix(viewProjection);
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);

  const members = [...culled.keys()];
  const indexOf = new Map(members.map((instance, i) => [instance, i]));
  const inputs = members.map((instance): VisibilityCullInstance => {
    instance.worldBox(box);
    const parent = culled.get(instance)!;
    return {
      range: instance.range,
      parent: parent ? indexOf.get(parent)! : -1,
      distance: cameraPosition.distanceTo(box.getCenter(boxCentre)),
      isInView: cameraFrustum.intersectsBox(box) || sceneSplitsHold(scene, box),
      wasVisible: registry.wasVisible.get(instance)!.get(camera) ?? false,
    };
  });
  cullVisibility(inputs).forEach((result, i) => {
    const instance = members[i]!;
    registry.wasVisible.get(instance)!.set(camera, result.wasVisible);
    instance.apply(result.isVisible, result.fade, isCanvasRender);
  });
}

/**
 * The instances the cull must measure, each with its visibility parent or null: those with a
 * range, a parent, or a dependant. A parent path that names no registered instance is no parent.
 */
function culledInstances(
  instances: Set<VisibilityInstance>
): Map<VisibilityInstance, VisibilityInstance | null> {
  const byPath = new Map<string, VisibilityInstance>();
  for (const instance of instances) if (instance.path !== null) byPath.set(instance.path, instance);

  const culled = new Map<VisibilityInstance, VisibilityInstance | null>();
  for (const instance of instances) {
    const parent = instance.parentPath === null ? undefined : byPath.get(instance.parentPath);
    if (parent) {
      culled.set(instance, parent);
      if (!culled.has(parent)) culled.set(parent, null);
    } else if (hasVisibilityRange(instance.range) && !culled.has(instance)) {
      culled.set(instance, null);
    }
  }
  return culled;
}
