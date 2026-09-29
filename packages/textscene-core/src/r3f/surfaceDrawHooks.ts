/**
 * Godot surface state that three holds per object, applied per draw group instead: a
 * billboarding material's pose, the shadow pass's surface list, and SHADOWS_ONLY's hidden
 * colour draw. three calls a before-hook and its after-hook around each group's draw
 * (`WebGLRenderer.js:2158-2183`, `WebGLShadowMap.js:540-548`), with that group's
 * material, so one mesh can mix surfaces the way Godot does.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/billboard';
import {
  billboardModeOf,
  castsShadowOf,
} from '../resources/materials/standardmaterial3d/materialBag';
import { billboardWorldMatrix } from './surfaceBillboard';

/**
 * The four `Object3D` hooks, mounted on a `<mesh>` one prop each: the material factory
 * guard rejects a spread on a mesh, since a spread names nothing it carries.
 */
export interface SurfaceDrawHooks {
  onBeforeRender: THREE.Object3D['onBeforeRender'];
  onAfterRender: THREE.Object3D['onAfterRender'];
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
  onAfterShadow: THREE.Object3D['onAfterShadow'];
}

/** What one `cast_shadow` value changes in a draw (`shadowCasting.ts` holds the four). */
export interface CastRule {
  /** SHADOWS_ONLY: the colour pass draws nothing. */
  shadowsOnly: boolean;
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
let muted: THREE.Material | null = null;
let mutedColorWrite = true;
let mutedDepthWrite = true;

/** Scratch for the billboarded matrix, overwritten by every draw. */
const billboarded = new THREE.Matrix4();

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

export function surfaceDrawHooks(rule: CastRule): SurfaceDrawHooks {
  return Object.freeze({
    // three recomputes `modelViewMatrix` from `matrixWorld` after this hook (`:2160`).
    onBeforeRender(this: THREE.Object3D, _renderer, _scene, camera, _geometry, material) {
      if (rule.shadowsOnly) mute(material);
      else pose(this, material, camera, camera);
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
      _geometry,
      depthMaterial,
      group
    ) {
      const material = drawnMaterial(object, group);
      if (!material) return;
      rule.shadowSide(depthMaterial, material);
      // Godot's render list leaves such a surface out (`render_forward_clustered.cpp:4078-4088`).
      // three's cannot, so its draw writes nothing.
      if (!castsShadowOf(material)) {
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
