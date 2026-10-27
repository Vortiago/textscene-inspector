/**
 * Fits a Camera3D's three camera to the aspect of the viewport it renders, as Godot rebuilds the
 * projection from `fov`, `size`, `keep_aspect` and `frustum_offset` for each viewport
 * (`camera_3d.cpp:268-283`).
 */
import type * as THREE from 'three';
import { getFovy } from '../../../godot/math/projection.js';
import { radToDeg } from '../../../godot/math/math.js';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** The aspect of a camera that no viewport has fitted yet: Godot's default window, 1152 by 648. */
export const DEFAULT_ASPECT = 16 / 9;

/** The Camera3D properties that the projection takes, before the viewport aspect. */
export interface CameraLens {
  projection: EnumValue<typeof Camera3DProjectionType>;
  fov: number;
  size: number;
  keepAspect: EnumValue<typeof Camera3DKeepAspect>;
  frustumOffset: { x: number; y: number };
}

interface LensFit {
  lens: CameraLens;
  aspect: number | null;
}

/**
 * A three camera identified by its own flags, not `instanceof`, so detection survives a second
 * copy of three, such as the test renderer's.
 */
export type CameraLike = THREE.Camera & {
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
};

type FittableCamera = CameraLike & { userData: { lensFit?: LensFit } };

/** Dispatched on a camera each time `fitToAspect` fits it, so a gizmo that draws its shape redraws. */
interface LensFitEvents {
  lensfit: unknown;
}

/** Calls `listener` after each fit of `camera`. Returns the function that stops it. */
export function onLensFit(camera: THREE.Camera, listener: () => void): () => void {
  const target = camera as unknown as THREE.EventDispatcher<LensFitEvents>;
  target.addEventListener('lensfit', listener);
  return () => target.removeEventListener('lensfit', listener);
}

/** Records the lens that `fitToAspect` reads. The aspect of an earlier fit stays. */
export function setLens(camera: THREE.Camera, lens: CameraLens): void {
  const fittable = camera as FittableCamera;
  fittable.userData.lensFit = { lens, aspect: fittable.userData.lensFit?.aspect ?? null };
}

/** Rebuilds the projection for `aspect`. A camera with no lens is not a Camera3D, so it stays. */
export function fitToAspect(camera: THREE.Camera, aspect: number): void {
  const fittable = camera as FittableCamera;
  const fit = fittable.userData.lensFit;
  if (!fit) return;
  fit.aspect = aspect;
  if (fittable.isOrthographicCamera) fitOrthographic(camera as THREE.OrthographicCamera, fit.lens, aspect);
  if (fittable.isPerspectiveCamera) fitPerspective(camera as THREE.PerspectiveCamera, fit.lens, aspect);
  // After the perspective fit, which sets the aspect the frustum's width reads.
  if (fit.lens.projection === Camera3DProjectionType.FRUSTUM) {
    fitFrustum(camera as THREE.PerspectiveCamera, fit.lens, aspect);
  }
  (camera as unknown as THREE.EventDispatcher<LensFitEvents>).dispatchEvent({ type: 'lensfit' });
}

/** The aspect of the last fit, or null for a camera never fitted. */
export function fittedAspect(camera: THREE.Camera): number | null {
  return (camera as FittableCamera).userData.lensFit?.aspect ?? null;
}

/** `Projection::set_orthogonal` (`projection.cpp:356-362`): `size` is the full kept extent. */
function fitOrthographic(camera: THREE.OrthographicCamera, lens: CameraLens, aspect: number): void {
  const width = lens.keepAspect === Camera3DKeepAspect.KEEP_WIDTH ? lens.size : lens.size * aspect;
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = width / aspect / 2;
  camera.bottom = -width / aspect / 2;
  camera.updateProjectionMatrix();
}

/** three's fov is vertical. Under KEEP_WIDTH Godot's is horizontal (`projection.cpp:252-255`). */
function fitPerspective(camera: THREE.PerspectiveCamera, lens: CameraLens, aspect: number): void {
  camera.fov = lens.keepAspect === Camera3DKeepAspect.KEEP_WIDTH ? getFovy(lens.fov, 1 / aspect) : lens.fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

/**
 * `Projection::set_frustum` (`projection.cpp:396-402`), which `camera_3d.cpp:280` calls without
 * `keep_aspect`: `size` is the height at the near plane, the width is `size × aspect`, and
 * `frustum_offset` shifts both in near-plane units. three's view offset holds the shift, so a later
 * `updateProjectionMatrix` keeps it.
 */
function fitFrustum(camera: THREE.PerspectiveCamera, lens: CameraLens, aspect: number): void {
  const height = lens.size;
  const width = lens.size * aspect;
  camera.fov = radToDeg(2 * Math.atan(height / 2 / camera.near));
  camera.setViewOffset(width, height, lens.frustumOffset.x, -lens.frustumOffset.y, width, height);
}
