import type { EditorControlsHandle, EditorPose } from '../EditorControlsHandle.js';
import type { FreelookControl } from '../freelook.js';
import { frameSceneBounds } from '../frameSceneBounds.js';
import { matrixToTransform3D, transform3DToMatrix } from '../nodeTreeTransforms.js';
import { resolveFrameTarget } from '../resolveFrameTarget.js';
import { liveNodePathOf } from '../../scene/nodePathWalk.js';
import { variantOf, valueOfSceneValue, type SceneValue } from '../../scene/variant.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import { basisOfTransform3D, transform3DOf } from '../../godot/math/transform3d.js';
import type { BasisComponents } from '../../godot/math/basis.js';
import * as THREE from 'three';
import type { EditorCameraBacking } from './editorCameras.js';
import * as logger from '../../logger.js';

/** `Camera3D::ProjectionType` (camera_3d.h:44-48), the two of the editor (node_3d_editor_plugin.h:260). */
const PROJECTION_PERSPECTIVE = 0;
const PROJECTION_ORTHOGONAL = 1;

/** What the camera node reads of the canvas around the handle. */
export interface Camera3DCanvas {
  handle: EditorControlsHandle;
  freelook: FreelookControl;
  /** The drawn scene, which `focus` frames with no node given. */
  scene(): THREE.Object3D;
  /** The root scene the canvas draws. */
  rootScene(): string;
  /** By live path, the objects a node draws. */
  nodeObjects(): ReadonlyMap<string, THREE.Object3D> | null;
  /** Godot has no F while it draws through an authored Camera3D (node_3d_editor_plugin.cpp:1826-1829). */
  isPreviewing(): boolean;
  invalidate(): void;
}

export function editorCamera3D(canvas: Camera3DCanvas): EditorCameraBacking {
  const { handle } = canvas;
  return {
    get(property) {
      switch (property) {
        case 'transform':
          return transformOf(handle.camera);
        case 'position':
          return variantOf({ type: T.VECTOR3, value: handle.camera.position.toArray() });
        case 'fov':
          return handle.fovDegrees();
        case 'near':
          return handle.camera.near;
        case 'far':
          return handle.camera.far;
        case 'projection':
          return handle.isOrthographic ? PROJECTION_ORTHOGONAL : PROJECTION_PERSPECTIVE;
      }
      return null;
    },
    set(property, value) {
      const isSet = setProperty(canvas, property, value);
      if (isSet) canvas.invalidate();
      return isSet;
    },
    call(method, args) {
      if (method === 'reset') {
        // A flight would carry the camera off the pose the reset restores.
        if (canvas.freelook.getState().isToggled) canvas.freelook.toggle();
        handle.reset();
      } else if (method === 'focus') {
        if (!canvas.isPreviewing()) focus(canvas, args[0] ?? null);
      } else {
        throw new Error(`expected a method of the editor camera (reset, focus), got ${method}`);
      }
      canvas.invalidate();
      return null;
    },
    pose: () => handle.pose(),
    scene: canvas.rootScene,
    setPose(pose) {
      handle.setPose(pose as EditorPose);
      canvas.invalidate();
    },
  };
}

function setProperty(canvas: Camera3DCanvas, property: string, value: SceneValue): boolean {
  const { handle } = canvas;
  switch (property) {
    case 'transform': {
      const pose = poseOf(value);
      if (!pose) return false;
      lookFrom(handle, pose);
      return true;
    }
    case 'position': {
      const at = vector3Of(value);
      if (!at) return false;
      handle.camera.position.set(...at);
      handle.update();
      return true;
    }
    case 'fov': {
      if (typeof value !== 'number') return false;
      // Godot's setter refuses the value and the write still reports valid (camera_3d.cpp:725).
      if (value < 1 || value > 179) logger.warn(`[EditorCamera] expected a fov from 1 to 179, got ${value}`);
      else handle.setFov(value);
      return true;
    }
    case 'projection': {
      if (value !== PROJECTION_PERSPECTIVE && value !== PROJECTION_ORTHOGONAL) return false;
      if (handle.isOrthographic !== (value === PROJECTION_ORTHOGONAL)) handle.toggleProjection();
      return true;
    }
    case 'freelook': {
      if (typeof value !== 'boolean') return false;
      if (canvas.freelook.getState().isToggled !== value) canvas.freelook.toggle();
      return true;
    }
  }
  return false;
}

/** F on a node, by its absolute path, else on the whole scene (ADR-0029). */
function focus(canvas: Camera3DCanvas, node: SceneValue | null): void {
  if (node !== null && typeof node !== 'string') {
    throw new Error(`expected the absolute path of a node to focus, got ${String(node)}`);
  }
  const target = resolveFrameTarget(canvas.scene(), liveNodePathOf(node ?? undefined), canvas.nodeObjects());
  frameSceneBounds(target, canvas.handle.camera, canvas.handle);
}

function transformOf(camera: THREE.Camera): SceneValue {
  camera.updateMatrixWorld();
  const transform = matrixToTransform3D(camera.matrixWorld);
  const { x, y, z } = transform.origin;
  return variantOf({ type: T.TRANSFORM3D, value: [...basisOfTransform3D(transform), x, y, z] });
}

/** Keeps the orbit distance: the cursor orbits a point ahead of the camera (node_3d_editor_plugin.h:412). */
function lookFrom(handle: EditorControlsHandle, pose: THREE.Matrix4): void {
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  pose.decompose(position, rotation, new THREE.Vector3());
  const ahead = new THREE.Vector3(0, 0, -handle.cursor().distance).applyQuaternion(rotation);
  handle.target.copy(position).add(ahead);
  handle.camera.position.copy(position);
  handle.update();
}

function poseOf(value: SceneValue): THREE.Matrix4 | null {
  const read = valueOfSceneValue(value);
  if (read.type !== T.TRANSFORM3D) return null;
  const n = read.value as readonly number[];
  const basis = n.slice(0, 9) as unknown as BasisComponents;
  return transform3DToMatrix(transform3DOf(basis, { x: n[9]!, y: n[10]!, z: n[11]! }));
}

function vector3Of(value: SceneValue): [number, number, number] | null {
  const read = valueOfSceneValue(value);
  if (read.type !== T.VECTOR3) return null;
  const [x, y, z] = read.value as readonly number[];
  return [x!, y!, z!];
}
