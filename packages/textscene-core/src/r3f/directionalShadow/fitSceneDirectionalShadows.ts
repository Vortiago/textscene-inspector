/**
 * Fits every declared light in Godot's list of shadowed directional lights to the camera about to
 * render the scene, in its share of Godot's directional shadow atlas.
 * three r186 updates the world matrices before it calls `scene.onBeforeRender`, where this runs
 * (`WebGLRenderer.js:1663-1678`).
 */

import * as THREE from 'three';
import type { DirectionalShadowAtlasRect } from '../../godot/rendering/lights/directionalShadow.js';
import type { DirectionalShadowDeclaration } from './declaration.js';
import { dropLight, isDropped, restoreDroppedLight } from './droppedLight.js';
import { isViewingCamera, type DirectionalShadowBox, type ViewingCamera } from './fitDirectionalShadowBox.js';
import { fitDirectionalShadowSplits, type DirectionalShadowSplits } from './fitDirectionalShadowSplits.js';
import {
  declaredDirectionalLights,
  directionalLightLists,
  sceneLights,
  type DeclaredDirectionalLight,
  type DirectionalLightLists,
  type SceneLight,
} from './lightLists.js';
import {
  attachSplitSun,
  followDeclaredLight,
  releaseSplitSun,
  splitSunOf,
  type SplitSunLight,
} from './splitSun.js';
import { NO_SHADOW_FADE, SPLIT_CAMERA_UP } from './splitShadow.js';

/** A declared light and its share of Godot's directional shadow atlas for this render. */
interface SharingLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
  lightRect: DirectionalShadowAtlasRect;
}

/** Where the light stands and what it looks at, in world space. */
interface LightPlacement {
  lightPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

/**
 * The split suns each scene's last fit placed. Written only by `fitSceneDirectionalShadows`, on
 * every render of the scene, so it holds the suns of the render in progress.
 */
// eslint-disable-next-line no-restricted-syntax -- each render replaces the scene's suns, so it holds state, not a build cache
const fittedSuns = new WeakMap<THREE.Object3D, readonly SplitSunLight[]>();
const NO_SUNS: readonly SplitSunLight[] = [];

/**
 * Whether a directional shadow split of this render of `scene` holds `box`: Godot culls a
 * geometry instance for each directional split as well as for the camera
 * (`renderer_scene_cull.cpp:3140`).
 */
export function sceneSplitsHold(scene: THREE.Object3D, box: THREE.Box3): boolean {
  for (const sun of fittedSuns.get(scene) ?? NO_SUNS) {
    if (sun.shadow.holdsBox(box)) return true;
  }
  return false;
}

/**
 * A camera without a depth range (a bare `THREE.Camera`) fits nothing. A light without a declaration
 * keeps its shadow camera untouched and casts unfaded. A declared light casts only from Godot's list
 * of shadowed lights, and a light past Godot's eighth leaves the render. `lights` is
 * `sceneLights(scene)`.
 */
export function fitSceneDirectionalShadows(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  lights: readonly SceneLight[]
): void {
  fittedSuns.set(scene, NO_SUNS);
  if (!isViewingCamera(camera)) return;
  const declared = declaredDirectionalLights(lights);
  if (declared.length === 0) return;
  const lists = directionalLightLists(declared);
  for (const declaredLight of declared) fitDeclaredLight(declaredLight, lists, camera);
  fittedSuns.set(scene, sunsOf(declared));
}

function sunsOf(declared: readonly DeclaredDirectionalLight[]): SplitSunLight[] {
  const suns: SplitSunLight[] = [];
  for (const { light } of declared) {
    const sun = isDropped(light) ? null : splitSunOf(light);
    if (sun) suns.push(sun);
  }
  return suns;
}

/** Hands every declared light back its own shading and layers, for a fitter that stops fitting. */
export function releaseSceneLights(scene: THREE.Object3D): void {
  for (const { light } of declaredDirectionalLights(sceneLights(scene))) {
    releaseSplitSun(light);
    restoreDroppedLight(light);
  }
}

/**
 * A visible light past Godot's eighth leaves the render. A light in Godot's list of shadowed lights
 * casts in its share of the atlas through its split sun, in one, two or four splits. Any other
 * declared light gets no fit and no split sun, and its declaration leaves its `castShadow` off.
 */
function fitDeclaredLight(
  { light, declaration, isVisible }: DeclaredDirectionalLight,
  lists: DirectionalLightLists,
  camera: ViewingCamera
): void {
  if (isVisible && !lists.drawn.has(light)) {
    dropLight(light);
    return;
  }
  restoreDroppedLight(light);
  const lightRect = lists.shares.get(light);
  if (!lightRect || !light.castShadow) {
    releaseSplitSun(light);
    return;
  }
  // Godot's PCF kernel spans `soft_shadow_scale` atlas texels (`scene_forward_clustered.glsl:2443`).
  light.shadow.radius = declaration.filterRadius;
  fitSplitLight({ light, declaration, lightRect }, camera);
  const sun = splitSunOf(light);
  if (sun) sun.shadow.isDrawnFirst = lists.first === light;
}

/**
 * The placement of the light in its fit. Written only by `placementOf`, and valid until the next
 * light's fit, so no fit keeps it: this runs on every render.
 */
const scratchPlacement: LightPlacement = {
  lightPosition: new THREE.Vector3(),
  targetPosition: new THREE.Vector3(),
};

function placementOf(light: THREE.DirectionalLight): LightPlacement {
  light.getWorldPosition(scratchPlacement.lightPosition);
  light.target.getWorldPosition(scratchPlacement.targetPosition);
  return scratchPlacement;
}

/**
 * The sun draws into the light's share of Godot's atlas, and each split takes its own part of that
 * share (`render_forward_clustered.cpp:2610-2630`). The sun attaches with its first fit, so it
 * never shades with slots no fit has written. The sun casts in the declared light's place, so the
 * fade goes to the sun.
 */
function fitSplitLight({ light, declaration, lightRect }: SharingLight, camera: ViewingCamera): void {
  const placement = placementOf(light);
  const splits = fitDirectionalShadowSplits({
    camera,
    ...placement,
    up: SPLIT_CAMERA_UP,
    declaration,
    lightRect,
  });
  if (!splits) {
    // A sun from an earlier fit keeps its splits, unfaded.
    const sun = splitSunOf(light);
    if (sun) sun.shadow.fade = NO_SHADOW_FADE;
    return;
  }
  const sun = attachSplitSun(light);
  followDeclaredLight(sun, light, placement.lightPosition, placement.targetPosition);
  sun.shadow.setSplits(declaration.splitCount, lightRect);
  applySplits(sun, placement, splits);
}

function applySplits(sun: SplitSunLight, placement: LightPlacement, splits: DirectionalShadowSplits): void {
  splits.boxes.forEach((box, split) => {
    const splitCamera = sun.shadow.getCamera(split);
    splitCamera.position.copy(placement.lightPosition);
    splitCamera.lookAt(placement.targetPosition);
    applyShadowCameraBox(splitCamera, box);
    splitCamera.updateMatrixWorld();
  });
  splits.slots.forEach((slot, index) => sun.shadow._cascadeData[index]!.fromArray(slot));
  sun.shadow.rangeBegins.fromArray(splits.rangeBegins);
  sun.shadow.fade = splits.fade;
  sun.shadow.placeSplitFrusta();
}

function applyShadowCameraBox(shadowCamera: THREE.OrthographicCamera, box: DirectionalShadowBox): void {
  shadowCamera.left = box.left;
  shadowCamera.right = box.right;
  shadowCamera.top = box.top;
  shadowCamera.bottom = box.bottom;
  shadowCamera.near = box.near;
  shadowCamera.far = box.far;
  shadowCamera.updateProjectionMatrix();
}
