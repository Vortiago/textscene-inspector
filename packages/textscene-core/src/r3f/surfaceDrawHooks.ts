/**
 * Godot surface state that three holds per object, applied per draw group: a billboard's
 * pose, shadow-pass membership and SHADOWS_ONLY. three calls each before-hook and its
 * after-hook around one group's draw, with that group's material (`WebGLRenderer.js:2158-2183`,
 * `WebGLShadowMap.js:540-548`), so one mesh can mix surfaces the way Godot does.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/billboard';
import {
  billboardModeOf,
  castsShadowOf,
} from '../resources/materials/standardmaterial3d/materialBag';
import { billboardWorldMatrix } from './surfaceBillboard';

/** The four `Object3D` hooks, one prop each: the material factory guard rejects a spread. */
export interface SurfaceDrawHooks {
  onBeforeRender: THREE.Object3D['onBeforeRender'];
  onAfterRender: THREE.Object3D['onAfterRender'];
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
  onAfterShadow: THREE.Object3D['onAfterShadow'];
}

/** What one `cast_shadow` value changes in a draw (`shadowCasting.ts` holds the four). */
export interface CastRule {
  /** One colour-pass draw of `material`: `poseColourDraw` or `skipColourDraw`. */
  colourDraw: (
    object: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    camera: THREE.Camera
  ) => void;
  /** Sets three's shared depth material's side for the surface `material` draws. */
  shadowSide: (depthMaterial: THREE.Material, material: THREE.Material) => void;
}

/**
 * three passes the object as the second `onBeforeShadow` argument
 * (`WebGLShadowMap.js:535,549`) and the geometry group as the last, but types
 * them `Scene` and `Group`. Narrow to what this file reads.
 */
type ShadowHookObject = { material?: THREE.Material | THREE.Material[] };
type ShadowHookGroup = { materialIndex?: number } | null;

/** The material three draws for `group` of `object`, from inside a shadow hook. */
export function drawnMaterial(object: unknown, group: unknown): THREE.Material | undefined {
  const material = (object as ShadowHookObject | null)?.material;
  if (!Array.isArray(material)) return material;
  return material[(group as ShadowHookGroup)?.materialIndex ?? 0];
}

/**
 * What the open draw changed, for its after-hook to put back. Written only by a
 * before-hook and cleared by the after-hook three calls next: three draws one group at
 * a time, so no two draws are ever open together.
 */
let posed: THREE.Object3D | null = null;
const posedMatrixWorld = new THREE.Matrix4();
const posedModelView = new THREE.Matrix4();
let skipped: THREE.BufferGeometry | null = null;
let skippedCount = Infinity;

/** Scratch for the billboarded matrix, overwritten by every draw. */
const billboarded = new THREE.Matrix4();

/**
 * Make this draw draw nothing: an empty `drawRange` gives the GPU zero elements
 * (`WebGLRenderer.js:1223-1250`). On the geometry, which a clone or an overlay shares,
 * so the after-hook puts the count back before any other draw.
 */
function skip(geometry: THREE.BufferGeometry): void {
  skipped = geometry;
  skippedCount = geometry.drawRange.count;
  geometry.drawRange.count = 0;
}

/**
 * Give this draw the billboarded pose of `material`'s mode. three uploads `matrixWorld`
 * as `modelMatrix` and `modelViewMatrix` beside it, so both move and both come back.
 *
 * @returns whether the pose moved
 */
function pose(
  object: THREE.Object3D,
  material: THREE.Material,
  mainCamera: THREE.Camera,
  passCamera: THREE.Camera
): boolean {
  // three multiplies `instanceMatrix` after `modelMatrix`, so a swapped matrix would turn
  // every instance about the batch origin. Godot's per-instance billboard needs a shader.
  if ((object as THREE.InstancedMesh).isInstancedMesh) return false;
  const mode = billboardModeOf(material);
  const camera = mode === BillboardMode.BILLBOARD_PARTICLES ? passCamera : mainCamera;
  if (!billboardWorldMatrix(billboarded, object.matrixWorld, camera.matrixWorld, mode)) return false;
  posed = object;
  posedMatrixWorld.copy(object.matrixWorld);
  posedModelView.copy(object.modelViewMatrix);
  object.matrixWorld.copy(billboarded);
  return true;
}

function closeDraw(): void {
  if (skipped) {
    skipped.drawRange.count = skippedCount;
    skipped = null;
  }
  if (posed) {
    posed.matrixWorld.copy(posedMatrixWorld);
    posed.modelViewMatrix.copy(posedModelView);
    posed = null;
  }
}

/** A drawing colour pass: the surface billboards if its material says so. */
export const poseColourDraw: CastRule['colourDraw'] = (object, _geometry, material, camera) => {
  pose(object, material, camera, camera);
};

/** SHADOWS_ONLY's colour pass: the surface draws nothing, and still casts. */
export const skipColourDraw: CastRule['colourDraw'] = (_object, geometry) => {
  skip(geometry);
};

export function surfaceDrawHooks(rule: CastRule): SurfaceDrawHooks {
  return Object.freeze({
    // three recomputes `modelViewMatrix` from `matrixWorld` after this hook (`:2160`).
    onBeforeRender(this: THREE.Object3D, _renderer, _scene, camera, geometry, material) {
      rule.colourDraw(this, geometry, material, camera);
    },
    onAfterRender: closeDraw,
    // three sets `modelViewMatrix` once per object before its group loop
    // (`WebGLShadowMap.js:528`), so a moved pose recomputes it here. The main camera
    // stays the billboard's, as `MAIN_CAM_INV_VIEW_MATRIX` is on a shadow pass.
    onBeforeShadow(
      this: THREE.Object3D,
      _renderer,
      object,
      camera,
      shadowCamera,
      geometry,
      depthMaterial,
      group
    ) {
      const material = drawnMaterial(object, group);
      if (!material) return;
      rule.shadowSide(depthMaterial, material);
      // Godot's render list leaves such a surface out (`render_forward_clustered.cpp:4078-4088`).
      if (!castsShadowOf(material)) {
        skip(geometry);
        return;
      }
      if (pose(this, material, camera, shadowCamera)) {
        this.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, this.matrixWorld);
      }
    },
    onAfterShadow: closeDraw,
  } satisfies SurfaceDrawHooks);
}
