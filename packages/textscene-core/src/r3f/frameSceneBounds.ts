/**
 * Camera-framing math shared by the auto-fit (`CameraFit`) and the F-to-frame shortcut. A leaf
 * module, since `TscnCanvas` mounts `FrameSelectedShortcut`, which must not import back from it.
 */
import * as THREE from 'three';
import { EDITOR_CAMERA_FOV, editorCameraDirection } from './godotEditorCamera.js';
import { computeWorldBoundingBox } from './bounds.js';

/**
 * How much room to leave around the framed bounds. Exported because the Godot
 * reference harness mirrors it to frame the same picture (`--frame`), and a
 * one-sided change there is invisible.
 */
export const FRAME_MARGIN = 1.6;

/** Largest side of a box: 0 for a point, which a bounds proxy can be. */
function maxExtent(box: THREE.Box3): number {
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}

/** Minimal shape we touch on the viewport controls instance for framing. */
export interface OrbitLike {
  target?: THREE.Vector3;
  update?: () => void;
}

/**
 * Frames the camera on the union of every rendered mesh, back along the editor direction until the
 * largest dimension fits the vertical FOV, and re-points the controls at the centre. A no-op for an
 * empty scene or non-finite bounds.
 */
export function frameSceneBounds(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  controls: OrbitLike | null
): void {
  // Prefer real geometry (meshes); fall back to gizmo lines/points so
  // light- or camera-only scenes (no mesh to frame) still get framed instead
  // of leaving the default camera pointed at an empty void.
  const meshBox = new THREE.Box3();
  const gizmoBox = new THREE.Box3();
  let hasMesh = false;
  let hasGizmo = false;
  scene.traverse((obj) => {
    if (obj.userData?.tscnEmptyState) return;
    // A Label3D glyph mesh is skipped, so async mount timing cannot change the frame. Label3D frames
    // by its zero-size `LABEL3D_BOUNDS_PROXY` alone, as Godot's reference camera does.
    if (obj.userData?.tscnFrameExcluded) return;
    // CSG contributor bounds proxies are INCLUDED: Godot counts a contributor's own
    // unevaluated brush too (modules/csg/csg_shape.cpp:470,507, reached recursively), so a
    // subtracted solid enlarges its bounds on both sides. An invisible one the recursion
    // never reached carries a zero-size proxy, so it lands here as the point Godot has.
    const o = obj as THREE.Mesh & { isLine?: boolean; isLineSegments?: boolean; isPoints?: boolean };
    if (!o.isMesh && !o.isLine && !o.isLineSegments && !o.isPoints) return;
    const objBox = computeWorldBoundingBox(obj, new THREE.Box3());
    if (objBox.isEmpty() || !Number.isFinite(objBox.min.x)) return;
    if (o.isMesh) {
      meshBox.union(objBox);
      hasMesh = true;
    } else {
      gizmoBox.union(objBox);
      hasGizmo = true;
    }
  });
  // A point union is reachable, since every mesh can be a bounds proxy for a node Godot never
  // sized. It is not a mesh to frame from, so it must not win over the gizmo box.
  const box = hasMesh && maxExtent(meshBox) > 0 ? meshBox : hasGizmo ? gizmoBox : hasMesh ? meshBox : null;
  if (!box) return;

  const center = box.getCenter(new THREE.Vector3());
  const maxDim = maxExtent(box);
  if (!Number.isFinite(maxDim)) return;
  if (maxDim <= 0) {
    // Nothing to derive a distance from, so keep the one we have and re-point, which is
    // what Node3DEditorViewport::focus_selection does with the orbit cursor.
    if (controls?.target) {
      camera.position.add(center.clone().sub(controls.target));
      controls.target.copy(center);
      controls.update?.();
    }
    camera.lookAt(center);
    return;
  }

  // The only orthographic camera here is the editor camera's Numpad-5 projection, sized from the same
  // 70-degree field of view; three's 50-degree default would zoom it out by half again.
  const persp = camera as THREE.PerspectiveCamera;
  const fov = ((persp.isPerspectiveCamera ? persp.fov : EDITOR_CAMERA_FOV) * Math.PI) / 180;
  const distance = (maxDim / 2 / Math.tan(fov / 2) || maxDim) * FRAME_MARGIN;

  // Godot's editor viewing angle, so a scene presents the face it does in the editor, a coplanar
  // scene included: Godot's reference camera frames it obliquely, never head-on.
  const dir = editorCameraDirection();
  camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));
  if (persp.isPerspectiveCamera) {
    // The 0.01 near floor must never exceed `distance`, or a microscopic scene (a Decal at size
    // 0.001) sits inside the near plane and renders black.
    persp.near = Math.min(Math.max(0.01, distance / 200), distance / 10);
    persp.far = distance * 200;
    persp.updateProjectionMatrix();
  }
  camera.lookAt(center);
  if (controls?.target) {
    controls.target.copy(center);
    controls.update?.();
  }
}
