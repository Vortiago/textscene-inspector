/**
 * Camera-framing math shared by `<TscnCanvas>`'s auto-fit (`CameraFit`) and
 * the F-to-frame shortcut (`FrameSelectedShortcut`). A leaf module (THREE +
 * bounds only) so both consumers can import it without a module cycle —
 * `TscnCanvas` mounts `FrameSelectedShortcut`, so the shortcut must never
 * import back from `TscnCanvas` itself.
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
/** A near-flat (2D) scene is viewed head-on and needs far less room. */
export const FLAT_FRAME_MARGIN = 1.15;

/** Minimal shape we touch on the viewport controls instance for framing. */
export interface OrbitLike {
  target?: THREE.Vector3;
  update?: () => void;
}

/**
 * Frame the camera so the whole scene fits the viewport. Unions the bounding
 * boxes of every rendered Mesh (skipping the empty-state grid), then pulls the
 * camera back along an isometric-ish direction far enough that the largest
 * dimension fits the vertical FOV, and re-points the controls at the centre.
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
    // A Label3D's own real glyph mesh (`LabelGlyphs.tsx`'s own doc has the
    // measurement) — skipped so an incidental async-mount timing accident
    // can never change the frame. Label3D's contribution to auto-framing is
    // its zero-size bounds proxy (`nodes/3d/label3d/Component.tsx`'s
    // `LABEL3D_BOUNDS_PROXY`) ALONE, matching what Godot's own reference
    // camera is placed from.
    if (obj.userData?.tscnFrameExcluded) return;
    // CSG contributor bounds proxies are deliberately INCLUDED here.
    //
    // Excluding them looks right (a fully-subtracted brush cannot then enlarge the
    // opening frame) and is wrong in practice: the CSG library loads asynchronously
    // while CameraFit's last retry fires at 1100 ms, so a root whose result has not
    // landed yet would be framed against nothing. A CSGCombiner3D has no solid of its
    // own to stand in for it, so the scene framed on empty space. Measured: the
    // csg-combiner golden auto-framed to a 26% different picture.
    //
    // Including them can only ever frame too LARGE, never too small, because a boolean
    // result is a subset of the union of its contributions. Too large is a cosmetic
    // margin; too small is an unusable opening view.
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

  // The only orthographic camera framing ever sees is the editor camera in its
  // Numpad-5 projection, whose frustum is sized from the SAME 70-degree field
  // of view (`GodotEditorControls`); framing it at three's unrelated 50-degree
  // default would leave it zoomed out by half again.
  const persp = camera as THREE.PerspectiveCamera;
  const fov = ((persp.isPerspectiveCamera ? persp.fov : EDITOR_CAMERA_FOV) * Math.PI) / 180;
  const fitDim = isFlat ? Math.max(maxXY, 0.001) : maxDim;
  const distance =
    ((fitDim / 2 / Math.tan(fov / 2)) || fitDim) * (isFlat ? FLAT_FRAME_MARGIN : FRAME_MARGIN);

  // Godot's own editor viewing angle, so a framed scene presents the same face
  // it does in the editor (godotEditorCamera.ts). A flat scene is still viewed
  // head-on — an edge-on plane frames to nothing.
  const dir = isFlat ? new THREE.Vector3(0, 0, 1) : editorCameraDirection();
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
