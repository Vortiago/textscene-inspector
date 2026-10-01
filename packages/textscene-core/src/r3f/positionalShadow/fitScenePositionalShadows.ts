/**
 * One render's positional shadows: the lights of the scene ask the viewport's atlas for slots in
 * Godot's order, and each light's shadow takes the slot it holds.
 */

import * as THREE from 'three';
import { positionalLightBounds } from '../../godot/positionalShadow.js';
import type { PositionalShadowRequest } from '../../godot/positionalShadowAtlas.js';
import { isViewingCamera, type ViewingCamera } from '../directionalShadow/fitDirectionalShadowBox.js';
import { sceneLights, type SceneLight } from '../directionalShadow/lightLists.js';
import { readPositionalShadowDeclaration, type PositionalShadowDeclaration } from './declaration.js';
import { fitPositionalShadow } from './fitPositionalShadow.js';
import { omniShadowCoverage, spotShadowCoverage } from './shadowCoverage.js';
import type { PositionalLight, ViewportShadowAtlas } from './viewportShadowAtlas.js';

/** An omni or spot light that declared its shadow. */
interface DeclaredLight extends SceneLight {
  light: PositionalLight;
  declaration: PositionalShadowDeclaration;
}

/**
 * Allocates and fits every declared light of `scene` for the render through `camera`. A camera
 * without a depth range fits nothing. `tickMsec` is the render's clock.
 */
export function fitScenePositionalShadows(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  atlas: ViewportShadowAtlas,
  tickMsec: number
): void {
  if (!isViewingCamera(camera)) return;
  const declared = declaredLights(sceneLights(scene));
  atlas.retain(new Set(declared.map(({ light }) => light)));
  atlas.allocate(slotRequests(declared, camera), tickMsec);
  for (const { light, declaration } of declared) {
    atlas.bind(light.shadow);
    fitPositionalShadow(light, atlas.slotSize(light), declaration);
  }
}

function declaredLights(lights: readonly SceneLight[]): DeclaredLight[] {
  const declared: DeclaredLight[] = [];
  for (const { light, isVisible } of lights) {
    if (!isPositionalLight(light)) continue;
    const declaration = readPositionalShadowDeclaration(light);
    if (declaration) declared.push({ light, declaration, isVisible });
  }
  return declared;
}

/**
 * The lights the cull hands the atlas: visible, casting, and with a volume inside the camera's
 * frustum (`renderer_scene_cull.cpp:2853-2860`, `:3401`). They ask last-created first. A scene's
 * instances enter the renderer's list at its head (`core/templates/self_list.h:45-60`,
 * `renderer_scene_cull.cpp:531`), so the cull meets them in reverse tree order.
 */
function slotRequests(
  declared: readonly DeclaredLight[],
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
  const viewProjection = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  return new THREE.Frustum().setFromProjectionMatrix(viewProjection, camera.coordinateSystem);
}

/** The light's volume in world space: Godot's local box, transformed and boxed again. */
function lightVolume(light: PositionalLight): THREE.Box3 {
  const spotAngle = isSpotLight(light) ? THREE.MathUtils.radToDeg(light.angle) : null;
  const { min, max } = positionalLightBounds(light.distance, spotAngle);
  return new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)).applyMatrix4(light.matrixWorld);
}

function lightCoverage(light: PositionalLight, camera: ViewingCamera): number {
  const position = light.getWorldPosition(new THREE.Vector3());
  if (!isSpotLight(light)) return omniShadowCoverage(position, light.distance, camera);
  const direction = light.target.getWorldPosition(new THREE.Vector3()).sub(position).normalize();
  return spotShadowCoverage(position, direction, light.distance, light.angle, camera);
}

function isPositionalLight(light: THREE.Light): light is PositionalLight {
  return (light as THREE.PointLight).isPointLight === true || isSpotLight(light);
}

function isSpotLight(light: THREE.Light): light is THREE.SpotLight {
  return (light as THREE.SpotLight).isSpotLight === true;
}
