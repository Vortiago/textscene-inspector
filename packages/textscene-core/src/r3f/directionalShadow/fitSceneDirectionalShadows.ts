/**
 * Fits every declared, casting directional light in a scene to the camera about to render it, in
 * its share of Godot's directional shadow atlas, and writes each shadow's fade for that render.
 * three r186 updates the world matrices before it calls `scene.onBeforeRender`, where this runs
 * (`WebGLRenderer.js:1663-1678`).
 */

import * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  directionalLightsWithShadow,
  directionalShadowLightRect,
  directionalShadowSplitTextureSize,
  type DirectionalShadowAtlasRect,
  type DirectionalShadowFade,
} from '../../godot/directionalShadow.js';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';
import {
  fitDirectionalShadowBox,
  orthogonalShadowFade,
  type DirectionalShadowBox,
  type ViewingCamera,
} from './fitDirectionalShadowBox.js';
import { fitDirectionalShadowSplits, type DirectionalShadowSplits } from './fitDirectionalShadowSplits.js';
import { sizeShadowMap } from './shadowMapAllocation.js';
import { writeDirectionalShadowFades, type ShadowFades } from './shadowFade.js';
import {
  attachSplitSun,
  followDeclaredLight,
  releaseSplitSun,
  splitSunOf,
  type SplitSunLight,
} from './splitSun.js';
import { SPLIT_CAMERA_UP } from './splitShadow.js';

interface DeclaredLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
}

/** A declared light and its share of Godot's directional shadow atlas for this render. */
interface SharingLight extends DeclaredLight {
  lightRect: DirectionalShadowAtlasRect;
}

/** Each light's share of the atlas, for the lights in Godot's list of shadowed lights. */
type AtlasShares = Map<THREE.DirectionalLight, DirectionalShadowAtlasRect>;

/**
 * A light outside Godot's list draws no shadow in Godot (`renderer_scene_cull.cpp:3268`). Here it
 * keeps a whole atlas of its own.
 */
const WHOLE_ATLAS = directionalShadowLightRect(DIRECTIONAL_SHADOW_SIZE_DEFAULT, 1, 0);

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
 * without a declaration keeps its shadow camera untouched and casts unfaded. A declared light
 * that casts no shadow, or draws no split atlas, shades itself.
 */
export function fitSceneDirectionalShadows(scene: THREE.Object3D, camera: THREE.Camera): void {
  if (!isViewingCamera(camera)) {
    writeDirectionalShadowFades(NO_FADES);
    return;
  }
  const fades: CasterFades = new Map();
  const shares = directionalShadowAtlasShares(scene, camera);
  for (const { light, declaration } of declaredLights(scene)) {
    const sharing = { light, declaration, lightRect: shares.get(light) ?? WHOLE_ATLAS };
    if (light.castShadow && declaration.splitCount > 1) {
      fitSplitLight(sharing, camera, fades);
      continue;
    }
    releaseSplitSun(light);
    if (light.castShadow) fitOrthogonalLight(sharing, camera, fades);
  }
  // After the fits: a light that attaches or releases its sun changes which of the two casts.
  const casters = directionalShadowCasters(scene, camera);
  writeDirectionalShadowFades({
    directional: casters.directional.map((light) => fades.get(light) ?? null),
    sun: casters.sun.map((light) => fades.get(light) ?? null),
  });
}

/** Hands every declared light back its own shading, for a fitter that stops fitting the scene. */
export function releaseSceneSplitSuns(scene: THREE.Object3D): void {
  for (const { light } of declaredLights(scene)) releaseSplitSun(light);
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
 * declared light that draws splits fails the layer test, so only its split sun counts.
 */
export function directionalShadowCasters(
  scene: THREE.Object3D,
  camera: THREE.Camera
): DirectionalShadowCasters {
  const casters: DirectionalShadowCasters = { directional: [], sun: [] };
  scene.traverseVisible((object) => {
    const light = object as THREE.Light & { isSunLight?: boolean; isDirectionalLight?: boolean };
    if (!light.isLight || !light.castShadow || !light.layers.test(camera.layers)) return;
    if (light.isSunLight) casters.sun.push(light);
    else if (light.isDirectionalLight) casters.directional.push(light as THREE.DirectionalLight);
  });
  return casters;
}

/**
 * Each declared light's share of Godot's directional shadow atlas for this render. Godot's list
 * holds the visible lights on a visible layer whose shadow shares the atlas, and gives each a share
 * in list order (`renderer_scene_cull.cpp:3257-3282`, `light_storage.cpp:2577-2597`). Here the
 * lights count in visible pre-order where the camera's layers include them, as three indexes them.
 */
export function directionalShadowAtlasShares(scene: THREE.Object3D, camera: THREE.Camera): AtlasShares {
  const visible: DeclaredLight[] = [];
  scene.traverseVisible((object) => {
    const light = object as THREE.DirectionalLight;
    if (!light.isDirectionalLight || !ownLayers(light).test(camera.layers)) return;
    const declaration = readDirectionalShadowDeclaration(light);
    if (declaration) visible.push({ light, declaration });
  });
  const shadowed = directionalLightsWithShadow(visible, ({ declaration }) => declaration.sharesAtlas);
  const shares: AtlasShares = new Map();
  shadowed.forEach(({ light }, index) => {
    shares.set(light, directionalShadowLightRect(DIRECTIONAL_SHADOW_SIZE_DEFAULT, shadowed.length, index));
  });
  return shares;
}

/** A light that shades through its split sun keeps its own layers on the sun. */
function ownLayers(light: THREE.DirectionalLight): THREE.Layers {
  return splitSunOf(light)?.sourceLayers ?? light.layers;
}

function declaredLights(scene: THREE.Object3D): DeclaredLight[] {
  const lights: DeclaredLight[] = [];
  scene.traverse((object) => {
    const light = object as THREE.DirectionalLight;
    if (!light.isDirectionalLight) return;
    const declaration = readDirectionalShadowDeclaration(light);
    if (declaration) lights.push({ light, declaration });
  });
  return lights;
}

function placementOf(light: THREE.DirectionalLight): LightPlacement {
  return {
    lightPosition: light.getWorldPosition(new THREE.Vector3()),
    targetPosition: light.target.getWorldPosition(new THREE.Vector3()),
  };
}

/**
 * The light's map is its share of the atlas, which may not be square. Its fit counts texels against
 * the larger side (`light_storage.cpp:2603-2623`). A light whose fit gives no box keeps its last box
 * and casts unfaded.
 */
function fitOrthogonalLight(
  { light, declaration, lightRect }: SharingLight,
  camera: ViewingCamera,
  fades: CasterFades
): void {
  sizeShadowMap(light.shadow, lightRect.width, lightRect.height);
  const box = fitDirectionalShadowBox({
    camera,
    ...placementOf(light),
    up: light.shadow.camera.up,
    declaration,
    shadowMapSize: directionalShadowSplitTextureSize(declaration.splitCount, lightRect),
  });
  if (!box) return;
  applyShadowBox(light, box);
  fades.set(light, orthogonalShadowFade({ camera, declaration }));
}

/**
 * The sun's atlas is the light's share of Godot's atlas, and each split takes its own part of that
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

function applyShadowBox(light: THREE.DirectionalLight, box: DirectionalShadowBox): void {
  applyShadowCameraBox(light.shadow.camera, box);
  light.shadow.bias = box.bias;
  light.shadow.normalBias = box.normalBias;
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

function isViewingCamera(camera: THREE.Camera): camera is ViewingCamera {
  const candidate = camera as Partial<ViewingCamera>;
  return typeof candidate.near === 'number' && typeof candidate.far === 'number';
}
