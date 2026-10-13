/**
 * Draws an Environment's depth fog and volumetric fog into its scene. The fog readies itself for
 * each render of the scene, through whichever camera renders it, so the main view, a SubViewport
 * pass and a screenshot each get their own.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { projectVolumetricFogSettings } from '../../parser/projectSettingsParser.js';
import type { Vector3 } from '../../parser/vectors.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { observeSceneCull, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { worldToSky } from '../sky/skyRotation.js';
import { TrackedObjects } from '../trackedObjects.js';
import { finishFog, prepareFog, type DepthFog, type FogSettings } from './fogFrame.js';
import { acquireFogPasses } from './fogPasses.js';
import type { VolumetricFog } from './fogVolumePass.js';

export interface FogLayerProps {
  depth: DepthFog | null;
  volumetric: VolumetricFog | null;
  skyRotation: Vector3;
  skyEnergy: number;
}

function isLight(object: THREE.Object3D): object is THREE.Light {
  return (object as THREE.Light).isLight === true;
}

export function FogLayer({ depth, volumetric, skyRotation, skyEnergy }: FogLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const { settings: projectSettings } = useProjectSettings();
  const project = useMemo(() => projectVolumetricFogSettings(projectSettings), [projectSettings]);
  const toSky = useMemo(() => worldToSky(skyRotation), [skyRotation]);
  // Read at each render, so a new setting reaches the next render with the passes and the
  // volume's history kept.
  const settings = useRef<FogSettings>({ depth, volumetric, project, worldToSky: toSky, skyEnergy });
  settings.current = { depth, volumetric, project, worldToSky: toSky, skyEnergy };

  useEffect(() => {
    const { passes, release } = acquireFogPasses(gl);
    const lights = new TrackedObjects(scene, isLight);
    // After every other observer, so the fog reads each light's distance fade for this camera.
    const stopPreparing = observeSceneCull(scene, (camera) => {
      if (prepareFog(gl, scene, camera, settings.current, passes, lights.current())) invalidate();
    });
    const stopFinishing = observeSceneRenderEnd(scene, finishFog);
    return () => {
      stopPreparing();
      stopFinishing();
      lights.dispose();
      passes.volume.forget(scene);
      release();
    };
  }, [gl, scene, invalidate]);

  return null;
}
