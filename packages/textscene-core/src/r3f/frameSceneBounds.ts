/**
 * Camera-framing math shared by `<TscnCanvas>`'s auto-fit (`CameraFit`) and
 * the F-to-frame shortcut (`FrameSelectedShortcut`). A leaf module (THREE +
 * bounds only) so both consumers can import it without a module cycle —
 * `TscnCanvas` mounts `FrameSelectedShortcut`, so the shortcut must never
 * import back from `TscnCanvas` itself.
 */
import * as THREE from 'three';
import { computeWorldBoundingBox } from './bounds.js';

/** Minimal shape we touch on the OrbitControls instance for framing. */
export interface OrbitLike {
  target?: THREE.Vector3;
  update?: () => void;
}

/**
 * Frame the camera so the whole scene fits the viewport. Unions the bounding
 * boxes of every rendered Mesh (skipping the empty-state grid), then pulls the
 * camera back along an isometric-ish direction far enough that the largest
 * dimension fits the vertical FOV, and re-points OrbitControls at the centre.
 * No-op for empty scenes or non-finite bounds.
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
  const box = hasMesh ? meshBox : hasGizmo ? gizmoBox : null;
  if (!box) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;

  // 2D-canvas scenes sit on ~one plane (z spread is only z_index draw steps);
  // view them straight-on (down -Z, +Y up) instead of the 3D isometric angle,
  // so sprites read flat and upright rather than tilted in perspective.
  const maxXY = Math.max(size.x, size.y);
  const isFlat = size.z <= Math.max(maxXY, 1) * 0.02;

  const persp = camera as THREE.PerspectiveCamera;
  const fov = ((persp.isPerspectiveCamera ? persp.fov : 50) * Math.PI) / 180;
  const fitDim = isFlat ? Math.max(maxXY, 0.001) : maxDim;
  const distance = ((fitDim / 2 / Math.tan(fov / 2)) || fitDim) * (isFlat ? 1.15 : 1.6);

  const dir = isFlat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0.7, 1).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));
  if (persp.isPerspectiveCamera) {
    // Keep the near plane below the framing distance so microscopic scenes
    // (e.g. a Decal authored at size 0.001) aren't clipped entirely: the 0.01
    // floor must never exceed `distance`, or the content sits inside the near
    // plane and the viewport renders black.
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
