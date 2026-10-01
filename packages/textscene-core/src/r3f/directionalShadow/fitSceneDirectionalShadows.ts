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
  directionalShadowFade,
  directionalShadowLightRect,
  directionalShadowSplitTextureSize,
  type DirectionalShadowAtlasRect,
  type DirectionalShadowFade,
} from '../../godot/directionalShadow.js';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';
import {
  fitDirectionalShadowBox,
  viewSlice,
  type DirectionalShadowBox,
  type ViewingCamera,
} from './fitDirectionalShadowBox.js';
import { fitDirectionalShadowSplits, type DirectionalShadowSplits } from './fitDirectionalShadowSplits.js';
import { writeDirectionalShadowFades, type ShadowFades } from './shadowFade.js';
import {
  attachSplitSun,
  followDeclaredLight,
  releaseSplitSun,
  splitSunOf,
  type SplitSunLight,
} from './splitSun.js';
import { SPLIT_CAMERA_UP } from './splitShadow.js';

/** A light in the scene, and whether three's render reaches it: it and every ancestor are visible. */
export interface SceneLight {
  light: THREE.Light;
  isVisible: boolean;
}

/** A directional light that declared its shadow. */
export interface DeclaredLight extends SceneLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
}

/** A declared light and its share of Godot's directional shadow atlas for this render. */
interface SharingLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
  lightRect: DirectionalShadowAtlasRect;
}

/** Each light's share of the atlas, for the lights in Godot's list of shadowed lights. */
type AtlasShares = Map<THREE.DirectionalLight, DirectionalShadowAtlasRect>;

/**
 * A light outside Godot's list draws no shadow in Godot (`renderer_scene_cull.cpp:3271`). Here it
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
  const lights = sceneLights(scene);
  const declared = declaredLights(lights);
  // Every render shares the fade buffer, so a scene with nothing to fade still clears it.
  if (declared.length === 0) {
    writeDirectionalShadowFades(NO_FADES);
    return;
  }
  const fades: CasterFades = new Map();
  const shares = directionalShadowAtlasShares(declared, camera);
  let sunsChanged = false;
  for (const { light, declaration } of declared) {
    const hadSun = splitSunOf(light) !== null;
    fitDeclaredLight({ light, declaration, lightRect: shares.get(light) ?? WHOLE_ATLAS }, camera, fades);
    if ((splitSunOf(light) !== null) !== hadSun) sunsChanged = true;
  }
  // A sun that attaches or releases changes which of the two lights casts, so the walk runs again.
  const casters = directionalShadowCasters(sunsChanged ? sceneLights(scene) : lights, camera);
  writeDirectionalShadowFades({
    directional: casters.directional.map((light) => fades.get(light) ?? null),
    sun: casters.sun.map((light) => fades.get(light) ?? null),
  });
}

/** Hands every declared light back its own shading, for a fitter that stops fitting the scene. */
export function releaseSceneSplitSuns(scene: THREE.Object3D): void {
  for (const { light } of declaredLights(sceneLights(scene))) releaseSplitSun(light);
}

/**
 * Every light in the scene, in the pre-order three's `projectObject` visits them (r186
 * `WebGLRenderer.js:1860-1888`), each marked by whether the render reaches it.
 */
export function sceneLights(scene: THREE.Object3D): SceneLight[] {
  const lights: SceneLight[] = [];
  collectLights(scene, true, lights);
  return lights;
}

function collectLights(object: THREE.Object3D, isParentVisible: boolean, lights: SceneLight[]): void {
  const isVisible = isParentVisible && object.visible;
  if ((object as THREE.Light).isLight) lights.push({ light: object as THREE.Light, isVisible });
  for (const child of object.children) collectLights(child, isVisible, lights);
}

/** The declared directional lights among `lights`, hidden ones included. */
export function declaredLights(lights: readonly SceneLight[]): DeclaredLight[] {
  const declared: DeclaredLight[] = [];
  for (const { light, isVisible } of lights) {
    const directional = light as THREE.DirectionalLight;
    if (!directional.isDirectionalLight) continue;
    const declaration = readDirectionalShadowDeclaration(directional);
    if (declaration) declared.push({ light: directional, declaration, isVisible });
  }
  return declared;
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
 * Each declared light's share of Godot's directional shadow atlas for this render. Godot's list
 * holds the visible lights on a visible layer whose shadow shares the atlas, and gives each a share
 * in list order (`renderer_scene_cull.cpp:3257-3282`, `light_storage.cpp:2577-2597`). Here the
 * lights count in visible pre-order where the camera's layers include them, as three indexes them.
 */
export function directionalShadowAtlasShares(
  declared: readonly DeclaredLight[],
  camera: THREE.Camera
): AtlasShares {
  const visible = declared.filter(
    ({ light, isVisible }) => isVisible && ownLayers(light).test(camera.layers)
  );
  const shadowed = directionalLightsWithShadow(visible, ({ declaration }) => declaration.sharesAtlas);
  const shares: AtlasShares = new Map();
  shadowed.forEach(({ light }, index) => {
    shares.set(light, directionalShadowLightRect(DIRECTIONAL_SHADOW_SIZE_DEFAULT, shadowed.length, index));
  });
  return shares;
}

/** A light that shades through its split sun keeps its own layers on the sun. */
function ownLayers(light: THREE.DirectionalLight): THREE.Layers {
  return splitSunOf(light)?.layers ?? light.layers;
}

/**
 * A casting light with splits shades through its split sun, which copies the light's filter radius.
 * Any other declared light shades itself.
 */
function fitDeclaredLight(sharing: SharingLight, camera: ViewingCamera, fades: CasterFades): void {
  const { light, declaration } = sharing;
  // Godot's PCF kernel spans `soft_shadow_scale` atlas texels (`scene_forward_clustered.glsl:2443`).
  light.shadow.radius = declaration.filterRadius;
  if (light.castShadow && declaration.splitCount > 1) {
    fitSplitLight(sharing, camera, fades);
    return;
  }
  releaseSplitSun(light);
  if (light.castShadow) fitOrthogonalLight(sharing, camera, fades);
}

function placementOf(light: THREE.DirectionalLight): LightPlacement {
  return {
    lightPosition: light.getWorldPosition(new THREE.Vector3()),
    targetPosition: light.target.getWorldPosition(new THREE.Vector3()),
  };
}

/**
 * The light's map is its share of the atlas, which may not be square. Its fit counts texels against
 * the larger side (`light_storage.cpp:2603-2623`), and its fade ends at the slice's far end
 * (`light_storage.cpp:752-754`). A light whose fit gives no box keeps its last box and casts unfaded.
 */
function fitOrthogonalLight(
  { light, declaration, lightRect }: SharingLight,
  camera: ViewingCamera,
  fades: CasterFades
): void {
  light.shadow.mapSize.set(lightRect.width, lightRect.height);
  const slice = viewSlice({ camera, declaration });
  const box = fitDirectionalShadowBox(
    {
      camera,
      ...placementOf(light),
      up: light.shadow.camera.up,
      declaration,
      shadowMapSize: directionalShadowSplitTextureSize(declaration.splitCount, lightRect),
    },
    slice
  );
  if (!box) return;
  applyShadowBox(light, box);
  fades.set(light, directionalShadowFade(slice.far, declaration.fadeStart));
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
