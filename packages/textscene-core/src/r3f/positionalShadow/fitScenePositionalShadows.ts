/**
 * One render's positional shadows: the lights of the scene ask the viewport's atlas for slots in
 * Godot's order, and each light's shadow takes the slot it holds.
 */

import * as THREE from 'three';
import { positionalLightBounds } from '../../godot/positionalShadow.js';
import type { PositionalShadowRequest } from '../../godot/positionalShadowAtlas.js';
import { isViewingCamera, type ViewingCamera } from '../directionalShadow/fitDirectionalShadowBox.js';
import { declaredLights, type DeclaredLight, type SceneLight } from '../directionalShadow/lightLists.js';
import { readPositionalShadowDeclaration, type PositionalShadowDeclaration } from './declaration.js';
import { adoptAtlasShadow } from './adoptAtlasShadow.js';
import { fitPositionalShadow } from './fitPositionalShadow.js';
import { omniShadowCoverage, spotShadowCoverage } from './shadowCoverage.js';
import type { PositionalLight, ViewportShadowAtlas } from './viewportShadowAtlas.js';

/** An omni or spot light that declared its shadow. */
type DeclaredPositionalLight = DeclaredLight<PositionalLight, PositionalShadowDeclaration>;

/**
 * The fit runs on every render, so it works in these. Each belongs to the one function that writes
 * it, and is valid until that function runs again.
 */
const declaredSet = new Set<PositionalLight>();
const scratchViewProjection = new THREE.Matrix4();
const scratchFrustum = new THREE.Frustum();
const scratchVolume = new THREE.Box3();
const scratchPosition = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();

/**
 * Allocates and fits every declared light among `lights`, the scene's lights, for the render
 * through `camera`. A camera without a depth range fits nothing. `tickMsec` is the render's clock.
 */
export function fitScenePositionalShadows(
  lights: readonly SceneLight[],
  camera: THREE.Camera,
  atlas: ViewportShadowAtlas,
  tickMsec: number
): void {
  if (!isViewingCamera(camera)) return;
  const declared = declaredLights(lights, isPositionalLight, readPositionalShadowDeclaration);
  retainDeclared(atlas, declared);
  atlas.allocate(slotRequests(declared, camera), tickMsec);
  for (const { light, declaration } of declared) {
    const atlasLight = adoptAtlasShadow(light);
    if (!isSpotLight(atlasLight)) atlas.bind(atlasLight.shadow);
    fitPositionalShadow(atlasLight, atlas.slot(light), declaration);
  }
}

/** Frees what the atlas holds for a light that left. The set empties again, so it keeps no light. */
function retainDeclared(atlas: ViewportShadowAtlas, declared: readonly DeclaredPositionalLight[]): void {
  for (const { light } of declared) declaredSet.add(light);
  atlas.retain(declaredSet);
  declaredSet.clear();
}

/**
 * The lights the cull hands the atlas: visible, casting, and with a volume inside the camera's
 * frustum (`renderer_scene_cull.cpp:2853-2860`, `:3401`). They ask last-created first. A scene's
 * instances enter the renderer's list at its head (`core/templates/self_list.h:45-60`,
 * `renderer_scene_cull.cpp:531`), so the cull meets them in reverse tree order.
 */
function slotRequests(
  declared: readonly DeclaredPositionalLight[],
  camera: ViewingCamera
): PositionalShadowRequest<PositionalLight>[] {
  const frustum = cameraFrustum(camera);
  const requests: PositionalShadowRequest<PositionalLight>[] = [];
  for (const { light, isVisible } of declared) {
    if (!isVisible || !light.castShadow || !frustum.intersectsBox(lightVolume(light))) continue;
    requests.push({
      owner: light,
      isOmni: !isSpotLight(light),
      coverage: lightCoverage(light, camera),
    });
  }
  return requests.reverse();
}

/** three updates the camera's matrices before `onBeforeRender` (r186 `WebGLRenderer.js:1663-1678`). */
function cameraFrustum(camera: ViewingCamera): THREE.Frustum {
  const viewProjection = scratchViewProjection.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  return scratchFrustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem);
}

/** The light's volume in world space: Godot's local box, transformed and boxed again. */
function lightVolume(light: PositionalLight): THREE.Box3 {
  const spotAngle = isSpotLight(light) ? THREE.MathUtils.radToDeg(light.angle) : null;
  const { min, max } = positionalLightBounds(light.distance, spotAngle);
  scratchVolume.min.set(min[0], min[1], min[2]);
  scratchVolume.max.set(max[0], max[1], max[2]);
  return scratchVolume.applyMatrix4(light.matrixWorld);
}

function lightCoverage(light: PositionalLight, camera: ViewingCamera): number {
  const position = light.getWorldPosition(scratchPosition);
  if (!isSpotLight(light)) return omniShadowCoverage(position, light.distance, camera);
  const direction = light.target.getWorldPosition(scratchDirection).sub(position).normalize();
  return spotShadowCoverage(position, direction, light.distance, light.angle, camera);
}

function isPositionalLight(light: THREE.Light): light is PositionalLight {
  return (light as THREE.PointLight).isPointLight === true || isSpotLight(light);
}

function isSpotLight(light: THREE.Light): light is THREE.SpotLight {
  return (light as THREE.SpotLight).isSpotLight === true;
}
