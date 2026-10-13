/**
 * Draws an Environment's volumetric fog into its scene: the renderer's fog pass prepares a volume
 * for each render of the scene, through whichever camera renders it, so the main view, a
 * SubViewport pass and a screenshot each get their own. A colour background gets the fog too.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Color } from '../../utils/colorParser.js';
import { projectVolumetricFogSettings } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { godotColorToLinear } from '../godotColor.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { createFogBackground, disposeFogBackground } from './fogBackground.js';
import { acquireFogVolumePass, type VolumetricFog } from './fogVolumePass.js';

export interface VolumetricFogLayerProps {
  fog: VolumetricFog;
  /** The sRGB colour Godot clears to under a colour background, already times its energy, else null. */
  backgroundColor: Color | null;
}

export function VolumetricFogLayer({ fog, backgroundColor }: VolumetricFogLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const { settings } = useProjectSettings();
  const project = useMemo(() => projectVolumetricFogSettings(settings), [settings]);

  useEffect(() => {
    const { pass, release } = acquireFogVolumePass(gl);
    const stopPreparing = observeSceneCamera(scene, (camera) =>
      pass.prepare(gl, scene, camera, { fog, project })
    );
    const stopFinishing = observeSceneRenderEnd(scene, () => pass.finish());
    return () => {
      stopPreparing();
      stopFinishing();
      release();
    };
  }, [gl, scene, fog, project]);

  useFogBackground(scene, backgroundColor);
  return null;
}

/** Adds the fogged colour background to `scene` while `color` is set. */
function useFogBackground(scene: THREE.Scene, color: Color | null): void {
  useEffect(() => {
    if (!color) return undefined;
    const background = createFogBackground(godotColorToLinear(color));
    scene.add(background);
    return () => {
      scene.remove(background);
      disposeFogBackground(background);
    };
  }, [scene, color]);
}
