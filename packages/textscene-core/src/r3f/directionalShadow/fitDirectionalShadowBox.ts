/**
 * The orthogonal shadow box over one depth range of the viewing camera, fitted as Godot's
 * `_light_instance_setup_directional_shadow` fits each split (`renderer_scene_cull.cpp:2134-2353`).
 * Pure: it reads THREE maths and writes nothing.
 * `directionalShadow.md` beside this file has the port and its divergences.
 */

import * as THREE from 'three';
import { snapped } from '../../godot/math.js';
import { allFinite } from '../../godot/number.js';
import {
  directionalShadowSlice,
  directionalShadowSnapStep,
  directionalShadowTexelSize,
  pancakesCasters,
  texelPaddedRadius,
  type DirectionalShadowSlice,
} from '../../godot/directionalShadow.js';
import type { DirectionalShadowDeclaration } from './declaration.js';

/** A camera with a depth range, whose world and projection matrices are current. */
export type ViewingCamera = THREE.Camera & {
  near: number;
  far: number;
  isOrthographicCamera?: boolean;
};

export interface DirectionalShadowFitInput {
  camera: ViewingCamera;
  /** Where three puts the shadow camera: the light's world position. */
  lightPosition: THREE.Vector3;
  /** What the shadow camera looks at: the light target's world position. */
  targetPosition: THREE.Vector3;
  /** The shadow camera's `up`, which three's `lookAt` rolls the box by. */
  up: THREE.Vector3;
  declaration: DirectionalShadowDeclaration;
  shadowMapSize: number;
}

/**
 * The shadow camera's frustum, relative to the light's position and in three's conventions:
 * the camera looks down its own -Z, so `near` and `far` are depths along the light's direction.
 */
export interface DirectionalShadowBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  /** The declared depth bias, rescaled to this box's depth range. */
  bias: number;
  /** The declared normal bias in world units, for this box's texel size. */
  normalBias: number;
}

/** The light's axes, as three's `lookAt` builds them. +Z points back towards the light. */
interface LightAxes {
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
}

/**
 * Godot flattens a caster nearer the light than the near plane onto it
 * (`scene_forward_clustered.glsl:679-682`), so every such caster casts. three has no pancaking,
 * so the near plane moves this many diameters of the whole view slice's sphere further towards
 * the light. Every split takes the same reach, so a caster casts into all of them or none.
 */
const CASTER_REACH_IN_DIAMETERS = 1;

const NDC_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** The camera depths the light's shadow covers (`renderer_scene_cull.cpp:2143-2149`). */
export function viewSlice(
  input: Pick<DirectionalShadowFitInput, 'camera' | 'declaration'>
): DirectionalShadowSlice {
  const { camera, declaration } = input;
  return directionalShadowSlice(
    camera.near,
    camera.far,
    declaration.maxDistance,
    camera.isOrthographicCamera === true
  );
}

/** A box over a depth range of the view, or null when the inputs give no finite box. */
export type DirectionalShadowBoxFit = (depths: DirectionalShadowSlice) => DirectionalShadowBox | null;

/**
 * Fits boxes for one light and one render. The light's axes and its caster reach hold for every
 * split, so this computes them once, and each split passes only its own depths. A box is null when
 * the inputs give no finite one, such as a camera with a non-invertible projection. The caller then
 * leaves the light's shadow as it is.
 */
export function directionalShadowBoxFitter(input: DirectionalShadowFitInput): DirectionalShadowBoxFit {
  const axes = lightAxes(input.lightPosition, input.targetPosition, input.up);
  const reach = pancakesCasters(input.declaration.pancakeSize) ? casterReach(input, axes) : null;
  return (depths) => fitBox({ input, axes, reach }, depths);
}

/** What every box of one light and one render shares. Null `reach` keeps three's near clip. */
interface LightFrame {
  input: DirectionalShadowFitInput;
  axes: LightAxes;
  reach: number | null;
}

function fitBox(
  { input, axes, reach }: LightFrame,
  depths: DirectionalShadowSlice
): DirectionalShadowBox | null {
  const { camera, declaration, shadowMapSize } = input;
  const { centre, radius } = paddedSphere(cameraSliceCorners(camera, depths.near, depths.far), shadowMapSize);

  const centreX = axes.x.dot(centre);
  const centreY = axes.y.dot(centre);
  const centreZ = axes.z.dot(centre);
  const step = directionalShadowSnapStep(radius, shadowMapSize);
  const xMin = snapped(centreX - radius, step);
  const xMax = snapped(centreX + radius, step);
  const yMin = snapped(centreY - radius, step);
  const yMax = snapped(centreY + radius, step);
  // `renderer_scene_cull.cpp:2284` and `:2327`: the far side sits one radius past the centre,
  // the near side one radius plus the pancake towards the light.
  const zFar = centreZ - radius;
  const zNear = centreZ + radius + declaration.pancakeSize;
  const zNearCovered = reach === null ? zNear : Math.max(zNear, reach);

  const eyeX = axes.x.dot(input.lightPosition);
  const eyeY = axes.y.dot(input.lightPosition);
  const eyeZ = axes.z.dot(input.lightPosition);
  const near = eyeZ - zNearCovered;
  const far = eyeZ - zFar;
  const box: DirectionalShadowBox = {
    left: xMin - eyeX,
    right: xMax - eyeX,
    bottom: yMin - eyeY,
    top: yMax - eyeY,
    near,
    far,
    // `renderer_scene_cull.cpp:2348` spends the bias over Godot's own depth range.
    bias: declaration.depthBias * ((zNear - zFar) / (far - near)),
    normalBias: declaration.normalBias * directionalShadowTexelSize(radius, shadowMapSize),
  };
  return allFinite(Object.values(box)) ? box : null;
}

/** The slice corners' sphere (`renderer_scene_cull.cpp:2268-2282`), padded by one texel. */
function paddedSphere(
  corners: THREE.Vector3[],
  shadowMapSize: number
): { centre: THREE.Vector3; radius: number } {
  const { center, radius } = meanCentredSphere(corners);
  return { centre: center, radius: texelPaddedRadius(radius, shadowMapSize) };
}

/**
 * How far towards the light, along `axes.z`, the near plane reaches: one diameter past the whole
 * view slice's own near face, whatever depths the box itself covers.
 */
function casterReach(input: DirectionalShadowFitInput, axes: LightAxes): number {
  const slice = viewSlice(input);
  const { centre, radius } = paddedSphere(
    cameraSliceCorners(input.camera, slice.near, slice.far),
    input.shadowMapSize
  );
  const sliceNearFace = axes.z.dot(centre) + radius + input.declaration.pancakeSize;
  return sliceNearFace + CASTER_REACH_IN_DIAMETERS * 2 * radius;
}

/**
 * The eight world-space corners of the camera's view between two depths
 * (`Projection::get_endpoints`, called at `renderer_scene_cull.cpp:2206`). Each corner ray is
 * unprojected once and cut at a depth, which holds for a perspective and an orthogonal camera.
 */
export function cameraSliceCorners(
  camera: THREE.Camera,
  nearDepth: number,
  farDepth: number
): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (const [x, y] of NDC_CORNERS) {
    const onNearPlane = new THREE.Vector3(x, y, -1).applyMatrix4(camera.projectionMatrixInverse);
    const onFarPlane = new THREE.Vector3(x, y, 1).applyMatrix4(camera.projectionMatrixInverse);
    for (const depth of [nearDepth, farDepth]) {
      corners.push(pointAtDepth(onNearPlane, onFarPlane, depth).applyMatrix4(camera.matrixWorld));
    }
  }
  return corners;
}

/**
 * The sphere round the points' mean (`renderer_scene_cull.cpp:2268-2280`). Without a centre,
 * `Sphere.setFromPoints` centres on the bounding box and so fits a different radius.
 */
function meanCentredSphere(points: THREE.Vector3[]): THREE.Sphere {
  const mean = new THREE.Vector3();
  for (const point of points) mean.add(point);
  return new THREE.Sphere().setFromPoints(points, mean.divideScalar(points.length));
}

/** The point on the view-space line through `a` and `b` whose depth, along -Z, is `depth`. */
function pointAtDepth(a: THREE.Vector3, b: THREE.Vector3, depth: number): THREE.Vector3 {
  const t = (-depth - a.z) / (b.z - a.z);
  return a.clone().lerp(b, t);
}

/**
 * Built by the same `Matrix4.lookAt` three's `LightShadow.updateMatrices` runs through
 * `Object3D.lookAt`, so a box fitted on these axes is the box three draws. A direction parallel
 * to `up` takes three's own nudge, and the box stays square to it.
 */
function lightAxes(
  lightPosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  up: THREE.Vector3
): LightAxes {
  const basis = new THREE.Matrix4().lookAt(lightPosition, targetPosition, up);
  const axes: LightAxes = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  basis.extractBasis(axes.x, axes.y, axes.z);
  return axes;
}
