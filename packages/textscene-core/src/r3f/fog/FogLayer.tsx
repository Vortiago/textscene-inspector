/**
 * Draws an Environment's depth fog and volumetric fog into its scene. The fog readies itself for
 * each render of the scene, through whichever camera renders it, so the main view, a SubViewport
 * pass and a screenshot each get their own.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { projectVolumetricFogSettings } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { readShadowMaps } from '../shadowPass.js';
import { TrackedObjects } from '../trackedObjects.js';
import { finishFog, prepareFog, type DepthFog, type FogSettings } from './fogFrame.js';
import { acquireFogPasses } from './fogPasses.js';
import { isFogVolume, type FogVolumeObject } from './fogVolumeObject.js';
import type { VolumetricFog } from './volumetricFogPass.js';

export interface FogLayerProps {
  depth: DepthFog | null;
  volumetric: VolumetricFog | null;
  skyEnergy: number;
}

function isLight(object: THREE.Object3D): object is THREE.Light {
  return (object as THREE.Light).isLight === true;
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

/** Depth fog reads no shadow and draws no FogVolume, so it leaves both untracked. */
const NO_CASTERS: readonly THREE.Mesh[] = [];
const NO_VOLUMES: readonly FogVolumeObject[] = [];

export function FogLayer({ depth, volumetric, skyEnergy }: FogLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const { settings: projectSettings } = useProjectSettings();
  const project = useMemo(() => projectVolumetricFogSettings(projectSettings), [projectSettings]);
  // Read at each render, so a new setting reaches the next render with the passes and the
  // volume's history kept.
  const current: FogSettings = { depth, volumetric, project, skyEnergy };
  const settings = useRef(current);
  settings.current = current;

  useEffect(() => {
    const previousFog = scene.fog;
    // three compiles its fog chunks only under a scene fog. Its own terms stay unread, since the
    // patched chunks draw Godot's fog from the shared fog uniforms.
    scene.fog = new THREE.FogExp2(0x000000, 0);
    return () => {
      scene.fog = previousFog;
    };
  }, [scene]);

  useEffect(() => {
    const { passes, release } = acquireFogPasses(gl);
    const lights = new TrackedObjects(scene, isLight);
    const casters = new TrackedObjects(scene, isMesh);
    const volumes = new TrackedObjects(scene, isFogVolume);
    // After the shadow pass, so the fog reads this render's shadow maps, and each light's distance
    // fade for this camera, which the scene's observers wrote before it.
    const stopPreparing = readShadowMaps(gl, (rendered, camera) => {
      if (rendered !== scene) return;
      const isVolumetric = settings.current.volumetric !== null;
      const objects = {
        lights: lights.current(),
        casters: isVolumetric ? casters.current() : NO_CASTERS,
        volumes: isVolumetric ? volumes.current() : NO_VOLUMES,
      };
      if (prepareFog(gl, scene, camera, settings.current, passes, objects)) invalidate();
    });
    const stopFinishing = observeSceneRenderEnd(scene, finishFog);
    return () => {
      stopPreparing();
      stopFinishing();
      lights.dispose();
      casters.dispose();
      volumes.dispose();
      passes.volume.forget(scene);
      release();
    };
  }, [gl, scene, invalidate]);

  return null;
}
