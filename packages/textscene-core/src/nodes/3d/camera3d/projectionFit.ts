/**
 * Fits a Camera3D's three camera to the aspect of the viewport it renders, as Godot rebuilds the
 * projection from `fov` or `size` and `keep_aspect` for each viewport (`camera_3d.cpp:268-283`).
 */
import type * as THREE from 'three';
import { getFovy } from '../../../godot/math/projection.js';
import { KeepAspectMode } from './types';

/** The Camera3D properties that the projection takes, before the viewport aspect. */
export interface CameraLens {
  fov: number;
  size: number;
  keepAspect: KeepAspectMode;
}

interface LensFit {
  lens: CameraLens;
  aspect: number | null;
}

type FittableCamera = THREE.Camera & {
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
  userData: { lensFit?: LensFit };
};

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
}

/** The aspect of the last fit, or null for a camera never fitted. */
export function fittedAspect(camera: THREE.Camera): number | null {
  return (camera as FittableCamera).userData.lensFit?.aspect ?? null;
}

/** `Projection::set_orthogonal` (`projection.cpp:356-362`): `size` is the full kept extent. */
function fitOrthographic(camera: THREE.OrthographicCamera, lens: CameraLens, aspect: number): void {
  const width = lens.keepAspect === KeepAspectMode.KEEP_WIDTH ? lens.size : lens.size * aspect;
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = width / aspect / 2;
  camera.bottom = -width / aspect / 2;
  camera.updateProjectionMatrix();
}

/** three's fov is vertical. Under KEEP_WIDTH Godot's is horizontal (`projection.cpp:252-255`). */
function fitPerspective(camera: THREE.PerspectiveCamera, lens: CameraLens, aspect: number): void {
  camera.fov = lens.keepAspect === KeepAspectMode.KEEP_WIDTH ? getFovy(lens.fov, 1 / aspect) : lens.fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
