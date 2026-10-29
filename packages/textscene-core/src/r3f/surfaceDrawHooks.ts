/**
 * Godot surface state that three holds per object, applied per draw group: a billboard's
 * cameras, the node's pose a program reads, the layers a probe's mask meets, shadow-pass membership,
 * the shadow's alpha cut and SHADOWS_ONLY. three calls each before-hook and its
 * after-hook around one group's draw, with that group's material (`WebGLRenderer.js:2158-2183`,
 * `WebGLShadowMap.js:546-564`), so one mesh can mix surfaces the way Godot does.
 */

import * as THREE from 'three';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';
import { billboardOf, castsShadowOf } from '../resources/materials/standardmaterial3d/materialBag';
import { aimBillboards } from './surfaceBillboard';
import { restoreInstanceLayers, showInstanceLayers } from './instanceLayers/instanceLayers';
import { alignNodePose } from './materials/nodePose';
import { opaquePrepassOf } from './materials/opaquePrepass';
import { surfaceDepthMaterial, syncSurfaceDepth } from './materials/surfaceDepthMaterial';
import { addsDepthInjections } from './materials/depthInjections';
import { SHADOW_PASS_OPAQUE_THRESHOLD } from '../godot/rendering/opaquePrepass';

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

/** What the draw hooks read of the geometry instance a surface belongs to, at draw time. */
export interface DrawnInstance {
  /**
   * Whether the instance passes its visibility-range cull for the render in progress. The scene
   * cull writes it before each render.
   */
  readonly isVisible: boolean;
  /**
   * Writes the node's world transform as Godot holds it, which a billboard or `fixed_size` on the
   * node never moves. False where the object's own pose is the node's.
   */
  nodeMatrixWorld(target: THREE.Matrix4): boolean;
}

/** An instance with no visibility range, posed by its object alone. */
export const UNRANGED_INSTANCE: DrawnInstance = Object.freeze({
  isVisible: true,
  nodeMatrixWorld: () => false,
});

/**
 * three passes the object as the second `onBeforeShadow` argument
 * (`WebGLShadowMap.js:546,560`) and the geometry group as the last, but types
 * them `Scene` and `Group`. Narrow to what this file reads.
 */
type ShadowHookObject = { material?: THREE.Material | THREE.Material[] };
type ShadowHookGroup = { materialIndex?: number } | null;

/** The material three draws for `group` of `object`, from inside a shadow hook. */
function drawnMaterial(object: unknown, group: unknown): THREE.Material | undefined {
  const material = (object as ShadowHookObject | null)?.material;
  if (!Array.isArray(material)) return material;
  return material[(group as ShadowHookGroup)?.materialIndex ?? 0];
}

/**
 * What the open draw changed, for its after-hook to put back. Written only by a
 * before-hook and cleared by the after-hook three calls next: three draws one group at
 * a time, so no two draws are ever open together.
 */
let skipped: THREE.BufferGeometry | null = null;
let skippedCount = Infinity;

/** Scratch for the node's matrix, overwritten by every draw. */
const nodeMatrix = new THREE.Matrix4();

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
 * Aims this draw's billboard, which its program builds, at the cameras of this render: Godot's
 * shadow pass keeps the main camera as `MAIN_CAM_INV_VIEW_MATRIX` (`material.cpp:1263-1264`).
 */
function aimBillboard(material: THREE.Material, mainCamera: THREE.Camera, passCamera: THREE.Camera): void {
  if (billboardOf(material).mode === BillboardMode.BILLBOARD_DISABLED) return;
  aimBillboards(mainCamera, passCamera);
}

/** Gives this draw of `material` the node's pose, which Godot's MODEL_MATRIX holds (`nodePose.ts`). */
function alignPose(object: THREE.Object3D, material: THREE.Material, instance: DrawnInstance): void {
  if (!instance.nodeMatrixWorld(nodeMatrix)) nodeMatrix.copy(object.matrixWorld);
  alignNodePose(material, nodeMatrix, object.matrixWorld);
}

/**
 * The alpha below which a shadow draw of `material` writes nothing, or 0 for none: its scissor, and
 * the shadow pass's opaque-prepass threshold.
 */
function shadowAlphaCut(material: THREE.Material): number {
  const prepassCut = opaquePrepassOf(material).cutsDepth ? SHADOW_PASS_OPAQUE_THRESHOLD : 0;
  return Math.max(material.alphaTest, prepassCut);
}

/**
 * Draws a surface whose shadow needs its own depth material, and makes three's draw draw nothing.
 * three's would cut the texture alpha alone, and at the scissor only, and add none of the depth
 * injections the draw records (`depthInjections.ts`).
 */
function castOwnShadow(
  renderer: THREE.WebGLRenderer,
  object: THREE.Object3D,
  shadowCamera: THREE.Camera,
  geometry: THREE.BufferGeometry,
  depthMaterial: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial,
  material: THREE.Material,
  group: THREE.GeometryGroup,
  instance: DrawnInstance
): void {
  const own = surfaceDepthMaterial(material, depthMaterial);
  syncSurfaceDepth(own, material, shadowAlphaCut(material));
  own.side = depthMaterial.side;
  // three hands a distance material its light inside `getDepthMaterial` (`WebGLShadowMap.js:487-492`).
  if ((depthMaterial as THREE.MeshDistanceMaterial).isMeshDistanceMaterial) {
    lightState(renderer, own).light = lightState(renderer, depthMaterial).light;
  }
  alignPose(object, own, instance);
  // The scene three's own shadow draw passes: none (`WebGLShadowMap.js:550`), typed as one.
  renderer.renderBufferDirect(shadowCamera, null as unknown as THREE.Scene, geometry, own, object, group);
  skip(geometry);
}

/** The renderer's state for a distance material, which three types as unknown. */
function lightState(renderer: THREE.WebGLRenderer, material: THREE.Material): { light?: THREE.Light } {
  return renderer.properties.get(material) as { light?: THREE.Light };
}

/** Whether a shadow draw of `material` cuts its alpha anywhere. */
function cutsShadow(material: THREE.Material): boolean {
  return material.alphaHash || shadowAlphaCut(material) > 0;
}

/**
 * Whether three's depth material cannot draw `material`'s shadow: it cuts alpha, or its draw adds
 * to the depth program, as a points size, a billboard or a particle colour does.
 */
function needsOwnDepth(material: THREE.Material): boolean {
  return cutsShadow(material) || addsDepthInjections(material.userData);
}

function closeDraw(): void {
  restoreInstanceLayers();
  if (skipped) {
    skipped.drawRange.count = skippedCount;
    skipped = null;
  }
}

/** A drawing colour pass: the surface billboards if its material says so. */
export const poseColourDraw: CastRule['colourDraw'] = (_object, _geometry, material, camera) => {
  aimBillboard(material, camera, camera);
};

/** SHADOWS_ONLY's colour pass: the surface draws nothing, and still casts. */
export const skipColourDraw: CastRule['colourDraw'] = (_object, geometry) => {
  skip(geometry);
};

/**
 * The hooks for one `cast_shadow` rule of one instance. A culled instance draws no colour and
 * casts into no directional shadow (`renderer_scene_cull.cpp:2852,3140`). It still casts into an
 * omni or spot shadow, whose cull reads no range (`:2415`).
 */
export function surfaceDrawHooks(rule: CastRule, instance: DrawnInstance): SurfaceDrawHooks {
  return {
    // three recomputes `modelViewMatrix` from `matrixWorld` after this hook (`:2160`).
    onBeforeRender(this: THREE.Object3D, renderer, _scene, camera, geometry, material) {
      if (!instance.isVisible) {
        skip(geometry);
        return;
      }
      rule.colourDraw(this, geometry, material, camera);
      alignPose(this, material, instance);
      showInstanceLayers(renderer, this);
    },
    onAfterRender: closeDraw,
    onBeforeShadow(renderer, object, camera, shadowCamera, geometry, depthMaterial, group) {
      const material = drawnMaterial(object, group);
      if (!material) return;
      rule.shadowSide(depthMaterial, material);
      // three gives only a DirectionalLight's shadow an orthographic camera.
      if (!instance.isVisible && (shadowCamera as THREE.OrthographicCamera).isOrthographicCamera) {
        skip(geometry);
        return;
      }
      // Godot's render list leaves such a surface out (`render_forward_clustered.cpp:4078-4088`).
      if (!castsShadowOf(material)) {
        skip(geometry);
        return;
      }
      // three passes the object itself here, typed as the scene.
      const drawn = object as unknown as THREE.Object3D;
      aimBillboard(material, camera, shadowCamera);
      if (!needsOwnDepth(material)) return;
      const shadowDepth = depthMaterial as THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial;
      // three passes the geometry group, or null for one material, typed as a `Group`.
      const drawnGroup = group as unknown as THREE.GeometryGroup;
      castOwnShadow(renderer, drawn, shadowCamera, geometry, shadowDepth, material, drawnGroup, instance);
    },
    onAfterShadow: closeDraw,
  };
}
