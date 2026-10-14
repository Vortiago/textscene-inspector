/**
 * The scene-level light pass before each render of a scene: it fits every declared shadow and writes
 * the area lights' uniforms, the sun shadows' soft shadow angles, every light's specular amount and
 * size, and the blocker searches every lit material compiles. Godot fits a directional shadow to
 * whichever camera renders, and gives an omni or spot light its slot in the atlas of the viewport
 * that renders it. So the pass rides `scene.onBeforeRender`: the main view, a SubViewport pass and a
 * screenshot each get their own, whatever order they render in.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../godot/positionalShadowAtlas.js';
import {
  fitSceneDirectionalShadows,
  releaseSceneLights,
} from './directionalShadow/fitSceneDirectionalShadows.js';
import { sceneLights } from './directionalShadow/lightLists.js';
import { fitScenePositionalShadows } from './positionalShadow/fitScenePositionalShadows.js';
import { installShadowPass } from './shadowPass.js';
import { activeShadowAtlas, ViewportShadowAtlas } from './positionalShadow/viewportShadowAtlas.js';
import { observeSceneCamera } from './sceneRenderCamera.js';
import { writeAreaLightUniforms } from './areaLight/areaLightFalloff.js';
import { updateAreaLightAtlas } from './areaLight/areaLightAtlas.js';
import { writeLightSpecularUniforms } from './lightSpecular/lightSpecular.js';
import { writeLightSizeUniforms } from './lightSize/lightSize.js';
import { defineSoftShadowSearch, releaseSoftShadowSearch } from './shadowFilter/softShadowSearch.js';
import { searchesPositionalBlockers } from './positionalShadow/softShadowRadius.js';
import {
  drawsDirectionalSoftShadows,
  searchesDirectionalBlockers,
  setSunSoftShadowAngles,
} from './directionalShadow/sunSoftShadow.js';

/**
 * One render's light pass, the directional fit first. The area light atlas rebuilds before the area
 * lights write where their textures lie. The directional fit changes no omni, spot or
 * area light, so their part of the pass reads the same walk. It hangs a sun under a declared
 * directional light and hides that light, so the soft shadow angles, the specular amounts and the light
 * sizes read a second walk.
 */
function prepareSceneLights(
  scene: THREE.Scene,
  camera: THREE.Camera,
  positionalAtlas: ViewportShadowAtlas,
  tickMsec: number
): void {
  const lights = sceneLights(scene);
  fitSceneDirectionalShadows(scene, camera, lights);
  fitScenePositionalShadows(lights, camera, positionalAtlas, tickMsec);
  updateAreaLightAtlas();
  writeAreaLightUniforms(lights, camera);
  const shadedLights = sceneLights(scene);
  const drawsSoftShadows = drawsDirectionalSoftShadows(shadedLights, camera);
  setSunSoftShadowAngles(shadedLights, drawsSoftShadows);
  writeLightSpecularUniforms(shadedLights, camera);
  writeLightSizeUniforms(shadedLights, camera, drawsSoftShadows);
  defineSoftShadowSearch(scene, {
    positional: searchesPositionalBlockers(lights),
    directional: searchesDirectionalBlockers(lights),
  });
}

/**
 * Runs the light pass before every render of `scene`, until unmount. A render outside any
 * SubViewport pass is the main view's, which takes the root viewport's atlas. Unmount hands each
 * declared directional light its own shading and layers back. Null runs nothing.
 */
export function useSceneShadowFit(scene: THREE.Scene | null): void {
  useEffect(() => {
    if (!scene) return undefined;
    const rootAtlas = new ViewportShadowAtlas(ROOT_POSITIONAL_SHADOW_ATLAS);
    const stopObserving = observeSceneCamera(scene, (camera) =>
      prepareSceneLights(scene, camera, activeShadowAtlas() ?? rootAtlas, performance.now())
    );
    return () => {
      stopObserving();
      releaseSceneLights(scene);
      releaseSoftShadowSearch(scene);
      rootAtlas.dispose();
    };
  }, [scene]);
}

/**
 * Mounted once per canvas, for the canvas's own scene. Its renderer's shadow pass copies each omni
 * light's cube into the atlas, for every scene the renderer draws.
 */
export function SceneShadowFitter() {
  const renderer = useThree((state) => state.gl);
  useEffect(() => installShadowPass(renderer), [renderer]);
  useSceneShadowFit(useThree((state) => state.scene));
  return null;
}
