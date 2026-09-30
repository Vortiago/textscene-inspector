/**
 * Fits every declared, casting directional light in a scene to the camera about to render it,
 * and writes each shadow's fade for that render. It reads the current world matrices:
 * `WebGLRenderer.render` updates them before it calls `scene.onBeforeRender` (three r186
 * `WebGLRenderer.js:1663-1678`), where this runs.
 */

import * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
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
import { writeDirectionalShadowFades, type ShadowFades } from './shadowFade.js';
import {
  attachSplitSun,
  followDeclaredLight,
  releaseSplitSun,
  type SplitSunLight,
} from './splitSun.js';
import { SPLIT_CAMERA_UP } from './splitShadow.js';

interface DeclaredLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
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
 * without a declaration keeps its shadow camera untouched and casts unfaded. A declared light
 * that casts no shadow, or draws no split atlas, shades itself.
 */
export function fitSceneDirectionalShadows(scene: THREE.Object3D, camera: THREE.Camera): void {
  if (!isViewingCamera(camera)) {
    writeDirectionalShadowFades(NO_FADES);
    return;
  }
  const fades: CasterFades = new Map();
  for (const { light, declaration } of declaredLights(scene)) {
    if (light.castShadow && declaration.splitCount > 1) {
      fitSplitLight(light, declaration, camera, fades);
      continue;
    }
    releaseSplitSun(light);
    if (light.castShadow) fitOrthogonalLight(light, declaration, camera, fades);
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
 * The casting directional and sun lights this render draws, in the order three indexes their
 * shadow uniforms. three pushes each light in visible pre-order when the camera's layers include
 * it (three r186 `WebGLRenderer.js:1860-1888`), sorts casters first with a stable sort
 * (`WebGLLights.js:245`), and counts sun and directional shadows apart (`:289-356`). A declared
 * light that draws splits fails the layer test, so only its split sun counts.
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

/** A light whose fit gives no box keeps its last box and casts unfaded. */
function fitOrthogonalLight(
  light: THREE.DirectionalLight,
  declaration: DirectionalShadowDeclaration,
  camera: ViewingCamera,
  fades: CasterFades
): void {
  const box = fitDirectionalShadowBox({
    camera,
    ...placementOf(light),
    up: light.shadow.camera.up,
    declaration,
    shadowMapSize: light.shadow.mapSize.width,
  });
  if (!box) return;
  applyShadowBox(light, box);
  fades.set(light, orthogonalShadowFade({ camera, declaration }));
}

/**
 * The atlas takes Godot's directional shadow size, whatever `mapSize` the declared light carries:
 * a split's share of it is Godot's own (`light_storage.cpp:2603-2623`). The sun attaches with its
 * first fit, so it never shades with slots no fit has written. The sun casts in the declared
 * light's place, so the fade goes to the sun.
 */
function fitSplitLight(
  light: THREE.DirectionalLight,
  declaration: DirectionalShadowDeclaration,
  camera: ViewingCamera,
  fades: CasterFades
): void {
  const placement = placementOf(light);
  const splits = fitDirectionalShadowSplits({
    camera,
    ...placement,
    up: SPLIT_CAMERA_UP,
    declaration,
    atlasSize: DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  });
  if (!splits) return;
  const sun = attachSplitSun(light);
  followDeclaredLight(sun, light, placement.lightPosition, placement.targetPosition);
  sun.shadow.setSplits(declaration.splitCount, DIRECTIONAL_SHADOW_SIZE_DEFAULT);
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
