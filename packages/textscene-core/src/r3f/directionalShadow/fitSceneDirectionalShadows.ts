/**
 * Fits every declared light in Godot's list of shadowed directional lights to the camera about to
 * render the scene, in its share of Godot's directional shadow atlas, and writes each shadow's fade
 * for that render.
 * three r186 updates the world matrices before it calls `scene.onBeforeRender`, where this runs
 * (`WebGLRenderer.js:1663-1678`).
 */

import * as THREE from 'three';
import type { DirectionalShadowAtlasRect, DirectionalShadowFade } from '../../godot/directionalShadow.js';
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
import { writeDirectionalShadowFades, type ShadowFades } from './shadowFade.js';
import {
  attachSplitSun,
  followDeclaredLight,
  releaseSplitSun,
  splitSunOf,
  type SplitSunLight,
} from './splitSun.js';
import { SPLIT_CAMERA_UP } from './splitShadow.js';

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

/** The fade of each light that casts for a declared light: the declared light or its split sun. */
type CasterFades = Map<THREE.Light, DirectionalShadowFade>;

const NO_FADES: ShadowFades = { directional: [], sun: [] };

/**
 * A camera without a depth range (a bare `THREE.Camera`) fits nothing and fades nothing. A light
 * without a declaration keeps its shadow camera untouched and casts unfaded. A declared light casts
 * only from Godot's list of shadowed lights, and a light past Godot's eighth leaves the render.
 * `lights` is `sceneLights(scene)` from before the fit.
 */
export function fitSceneDirectionalShadows(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  lights: readonly SceneLight[]
): void {
  if (!isViewingCamera(camera)) {
    writeDirectionalShadowFades(NO_FADES);
    return;
  }
  const declared = declaredDirectionalLights(lights);
  // Every render shares the fade buffer, so a scene with nothing to fade still clears it.
  if (declared.length === 0) {
    writeDirectionalShadowFades(NO_FADES);
    return;
  }
  const fades: CasterFades = new Map();
  const lists = directionalLightLists(declared);
  let renderedChanged = false;
  for (const declaredLight of declared) {
    const before = renderedFor(declaredLight.light);
    fitDeclaredLight(declaredLight, lists, camera, fades);
    if (renderedFor(declaredLight.light) !== before) renderedChanged = true;
  }
  // The walk lists what three renders for each light, so a change in that walks the scene again.
  const casters = directionalShadowCasters(renderedChanged ? sceneLights(scene) : lights, camera);
  writeDirectionalShadowFades({
    directional: casters.directional.map((light) => fades.get(light) ?? null),
    sun: casters.sun.map((light) => fades.get(light) ?? null),
  });
}

/** Hands every declared light back its own shading and layers, for a fitter that stops fitting. */
export function releaseSceneLights(scene: THREE.Object3D): void {
  for (const { light } of declaredDirectionalLights(sceneLights(scene))) {
    releaseSplitSun(light);
    restoreDroppedLight(light);
  }
}

/** What three renders for a declared light: its split sun, the light itself, or nothing once dropped. */
function renderedFor(light: THREE.DirectionalLight): THREE.Light | null {
  if (isDropped(light)) return null;
  return splitSunOf(light) ?? light;
}

/** The lights three draws a directional or a sun shadow for, each list in three's index order. */
export interface DirectionalShadowCasters {
  directional: THREE.DirectionalLight[];
  sun: THREE.Light[];
}

/**
 * The casting directional and sun lights this render draws, in three's shadow uniform order:
 * visible pre-order where the camera's layers include the light (r186 `WebGLRenderer.js:1860-1888`),
 * casters first (`WebGLLights.js:245`, a stable sort), sun and directional apart (`:289-356`). A
 * declared light that draws splits or that the fitter dropped fails the layer test, so only a split
 * sun counts for it.
 */
export function directionalShadowCasters(
  lights: readonly SceneLight[],
  camera: THREE.Camera
): DirectionalShadowCasters {
  const casters: DirectionalShadowCasters = { directional: [], sun: [] };
  for (const { light: object, isVisible } of lights) {
    const light = object as THREE.Light & { isSunLight?: boolean; isDirectionalLight?: boolean };
    if (!isVisible || !light.castShadow || !light.layers.test(camera.layers)) continue;
    if (light.isSunLight) casters.sun.push(light);
    else if (light.isDirectionalLight) casters.directional.push(light as THREE.DirectionalLight);
  }
  return casters;
}

/**
 * A visible light past Godot's eighth leaves the render. A light in Godot's list of shadowed lights
 * casts in its share of the atlas through its split sun, in one, two or four splits. Any other
 * declared light gets no fit and no split sun, and its declaration leaves its `castShadow` off.
 */
function fitDeclaredLight(
  { light, declaration, isVisible }: DeclaredDirectionalLight,
  lists: DirectionalLightLists,
  camera: ViewingCamera,
  fades: CasterFades
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
  fitSplitLight({ light, declaration, lightRect }, camera, fades);
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
function fitSplitLight(
  { light, declaration, lightRect }: SharingLight,
  camera: ViewingCamera,
  fades: CasterFades
): void {
  const placement = placementOf(light);
  const splits = fitDirectionalShadowSplits({
    camera,
    ...placement,
    up: SPLIT_CAMERA_UP,
    declaration,
    lightRect,
  });
  if (!splits) return;
  const sun = attachSplitSun(light);
  followDeclaredLight(sun, light, placement.lightPosition, placement.targetPosition);
  sun.shadow.setSplits(declaration.splitCount, lightRect);
  applySplits(sun, placement, splits);
  fades.set(sun, splits.fade);
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
