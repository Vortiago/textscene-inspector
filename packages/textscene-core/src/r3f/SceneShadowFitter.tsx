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
import {
  fitSceneDirectionalShadows,
  releaseSceneLights,
} from './directionalShadow/fitSceneDirectionalShadows.js';
import { sceneLights } from './directionalShadow/lightLists.js';
import { fitScenePositionalShadows } from './positionalShadow/fitScenePositionalShadows.js';
import { ViewportShadowAtlas } from './positionalShadow/viewportShadowAtlas.js';
import type { PositionalShadowAtlasSettings } from '../godot/rendering/lights/positionalShadowAtlas.js';
import { renderUnderWay } from './viewportRender/worldRender.js';
import { observeSceneCamera } from './sceneRenderCamera.js';
import { useByValue } from './hooks/useByValue.js';
import { sameData } from '../utils/sameData.js';
import { useRootViewportDescription } from './viewportRender/useRootViewportDescription.js';
import { writeAreaLightUniforms } from './areaLight/areaLightFalloff.js';
import { updateAreaLightAtlas } from './areaLight/areaLightAtlas.js';
import { areAtlasesUpdatedPerFrame } from './textureAtlas/updateTextureAtlases.js';
import { writeLightSpecularUniforms } from './lightSpecular/lightSpecular.js';
import { writeLightBakeModeUniforms } from './lightBakeMode/lightBakeMode.js';
import { writeLightSizeUniforms } from './lightSize/lightSize.js';
import { slottedLights } from './lightSlots.js';
import { defineSoftShadowSearch, releaseSoftShadowSearch } from './shadowFilter/softShadowSearch.js';
import { searchesPositionalBlockers } from './positionalShadow/softShadowRadius.js';
import {
  drawsDirectionalSoftShadows,
  searchesDirectionalBlockers,
  setSunSoftShadowAngles,
} from './directionalShadow/sunSoftShadow.js';

/**
 * One render's light pass, the directional fit first. It changes no omni, spot or area light, so
 * those read the first walk, and it swaps each declared directional light for a sun, so the writers
 * after it read a second walk. The area atlas is current before the area lights write their rects:
 * the frame loop rebuilt it, or this pass does.
 */
function prepareSceneLights(
  scene: THREE.Scene,
  camera: THREE.Camera,
  positionalAtlas: ViewportShadowAtlas,
  tickMsec: number,
  maxTextureSize: number
): void {
  const lights = sceneLights(scene);
  fitSceneDirectionalShadows(scene, camera, lights);
  fitScenePositionalShadows(lights, camera, positionalAtlas, tickMsec);
  if (!areAtlasesUpdatedPerFrame()) updateAreaLightAtlas(maxTextureSize);
  writeAreaLightUniforms(lights, camera);
  const shadedLights = sceneLights(scene);
  const drawsSoftShadows = drawsDirectionalSoftShadows(shadedLights, camera);
  setSunSoftShadowAngles(shadedLights, drawsSoftShadows);
  const slotted = slottedLights(shadedLights, camera);
  writeLightSpecularUniforms(slotted);
  writeLightBakeModeUniforms(slotted);
  writeLightSizeUniforms(slotted, drawsSoftShadows);
  defineSoftShadowSearch(scene, {
    positional: searchesPositionalBlockers(lights),
    directional: searchesDirectionalBlockers(lights),
  });
}

/** The light pass before each render of `scene`, in `atlas` outside a viewport pass. Null runs nothing. */
export function useSceneShadowFit(scene: THREE.Scene | null, atlas: PositionalShadowAtlasSettings): void {
  const getState = useThree((state) => state.get);
  const settings = useByValue(atlas, sameData);
  useEffect(() => {
    if (!scene) return undefined;
    const ownAtlas = new ViewportShadowAtlas(settings);
    const stopObserving = observeSceneCamera(scene, (camera) =>
      prepareSceneLights(
        scene,
        camera,
        renderUnderWay()?.shadowAtlas ?? ownAtlas,
        performance.now(),
        getState().gl.capabilities.maxTextureSize
      )
    );
    return () => {
      stopObserving();
      releaseSceneLights(scene);
      releaseSoftShadowSearch(scene);
      ownAtlas.dispose();
    };
  }, [scene, settings, getState]);
}

/** Mounted once per 3D canvas, for the canvas's own scene. */
export function SceneShadowFitter() {
  useSceneShadowFit(
    useThree((state) => state.scene),
    useRootViewportDescription().positionalShadowAtlas
  );
  return null;
}
