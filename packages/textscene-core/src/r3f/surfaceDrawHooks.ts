/**
 * Godot surface state that three holds per object, applied per draw group instead: a
 * billboarding material's pose, a blended surface's absence from the shadow pass, and
 * SHADOWS_ONLY's hidden colour draw. three calls a before-hook and its after-hook around
 * each group's draw (`WebGLRenderer.js:2158-2183`, `WebGLShadowMap.js:540-548`), with
 * that group's material, so one mesh can mix surfaces the way Godot does.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/billboard';
import { billboardModeOf } from '../resources/materials/standardmaterial3d/materialBag';
import { billboardWorldMatrix } from './surfaceBillboard';
import { drawnMaterial, type ShadowCastingEffects } from './shadowCasting';

/** The four `Object3D` hooks, spread onto a `<mesh>` as props. */
export interface SurfaceDrawHooks {
  onBeforeRender: THREE.Object3D['onBeforeRender'];
  onAfterRender: THREE.Object3D['onAfterRender'];
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
  onAfterShadow: THREE.Object3D['onAfterShadow'];
}

/**
 * What the open draw changed, for its after-hook to put back. Written only by a
 * before-hook and cleared by the after-hook three calls next: three draws one group at
 * a time, so no two draws are ever open together.
 */
let posed: THREE.Object3D | null = null;
const posedMatrixWorld = new THREE.Matrix4();
const posedModelView = new THREE.Matrix4();
let muted: THREE.Material | null = null;
let mutedColorWrite = true;
let mutedDepthWrite = true;

/** Scratch for the billboarded matrix, overwritten by every draw. */
const billboarded = new THREE.Matrix4();

/**
 * Godot keeps an additive, subtractive or multiply surface out of the shadow pass
 * (`render_forward_clustered.cpp:4078-4088`). MIX is three's `NormalBlending`
 * (`blendState.ts`), and every other mode is not.
 */
function isExcludedFromShadowPass(material: THREE.Material): boolean {
  return material.blending !== THREE.NormalBlending;
}

/**
 * Switch off every write for this draw. On the material itself: a `.tres` material and
 * three's depth material are shared, which the after-hook's restore makes safe.
 */
function mute(material: THREE.Material): void {
  muted = material;
  mutedColorWrite = material.colorWrite;
  mutedDepthWrite = material.depthWrite;
  material.colorWrite = false;
  material.depthWrite = false;
}

/**
 * Give this draw the billboarded pose of `material`'s mode. three uploads `matrixWorld`
 * as `modelMatrix` and `modelViewMatrix` beside it, so both move and both come back.
 *
 * @returns whether the material billboards, so the caller knows the pose moved
 */
function pose(
  object: THREE.Object3D,
  material: THREE.Material,
  mainCamera: THREE.Camera,
  passCamera: THREE.Camera
): boolean {
  const mode = billboardModeOf(material);
  const camera = mode === BillboardMode.PARTICLES ? passCamera : mainCamera;
  if (!billboardWorldMatrix(billboarded, object.matrixWorld, camera.matrixWorld, mode)) return false;
  posed = object;
  posedMatrixWorld.copy(object.matrixWorld);
  posedModelView.copy(object.modelViewMatrix);
  object.matrixWorld.copy(billboarded);
  return true;
}

function closeDraw(): void {
  if (muted) {
    muted.colorWrite = mutedColorWrite;
    muted.depthWrite = mutedDepthWrite;
    muted = null;
  }
  if (posed) {
    posed.matrixWorld.copy(posedMatrixWorld);
    posed.modelViewMatrix.copy(posedModelView);
    posed = null;
  }
}

function hooksFor(effects: ShadowCastingEffects): SurfaceDrawHooks {
  return Object.freeze({
    // three recomputes `modelViewMatrix` from `matrixWorld` after this hook (`:2160`).
    onBeforeRender(this: THREE.Object3D, _renderer, _scene, camera, _geometry, material) {
      if (effects.shadowsOnly) mute(material);
      else pose(this, material, camera, camera);
    },
    onAfterRender: closeDraw,
    // three sets `modelViewMatrix` once per object before its group loop
    // (`WebGLShadowMap.js:528`), so a moved pose recomputes it here. The main camera
    // stays the billboard's, as `MAIN_CAM_INV_VIEW_MATRIX` is on a shadow pass.
    onBeforeShadow(
      this: THREE.Object3D,
      renderer,
      object,
      camera,
      shadowCamera,
      geometry,
      depthMaterial,
      group
    ) {
      effects.onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
      const material = drawnMaterial(object, group);
      if (!material) return;
      if (isExcludedFromShadowPass(material)) {
        mute(depthMaterial);
        return;
      }
      if (pose(this, material, camera, shadowCamera)) {
        this.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, this.matrixWorld);
      }
    },
    onAfterShadow: closeDraw,
  } satisfies SurfaceDrawHooks);
}

/** One frozen set per `cast_shadow` value, so a mesh prop never churns. */
const HOOKS = new Map<ShadowCastingEffects, SurfaceDrawHooks>();

export function surfaceDrawHooks(effects: ShadowCastingEffects): SurfaceDrawHooks {
  let hooks = HOOKS.get(effects);
  if (!hooks) {
    hooks = hooksFor(effects);
    HOOKS.set(effects, hooks);
  }
  return hooks;
}
