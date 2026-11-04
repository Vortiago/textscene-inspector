/**
 * Draws an Environment's screen-space effects into its scene, for each render through whichever
 * camera renders it, while its Environment is on the scene (`sceneEnvironment.tsx`).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  projectAmbientOcclusionSettings,
  projectDrawsDepthPrepass,
  projectTracesHalfSizeReflections,
} from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { registerEnvironmentPart, useEnvironmentKey } from '../environment/sceneEnvironment.js';
import type {
  ScreenSpaceAmbientOcclusion,
  ScreenSpaceReflection,
} from '../../resources/environment/types.js';
import { SceneScreenSpaceEffects, type ScreenSpaceSettings } from './sceneScreenSpaceEffects.js';

interface ScreenSpaceEffectsLayerProps {
  ssr: ScreenSpaceReflection | null;
  ssao: ScreenSpaceAmbientOcclusion | null;
}

export function ScreenSpaceEffectsLayer({ ssr, ssao }: ScreenSpaceEffectsLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const environment = useEnvironmentKey();
  const { settings: projectSettings } = useProjectSettings();
  const isHalfSizeReflection = useMemo(
    () => projectTracesHalfSizeReflections(projectSettings),
    [projectSettings]
  );
  const ssaoProject = useMemo(() => projectAmbientOcclusionSettings(projectSettings), [projectSettings]);
  const drawsDepthPrepass = useMemo(() => projectDrawsDepthPrepass(projectSettings), [projectSettings]);
  // Read at each render, so a new setting reaches the next render with each buffer's history kept.
  const current: ScreenSpaceSettings = {
    reflection: ssr && { ssr, isHalfSize: isHalfSizeReflection },
    occlusion: ssao && { ssao, project: ssaoProject },
    drawsDepthPrepass,
  };
  const settings = useRef<ScreenSpaceSettings>(current);
  settings.current = current;

  useEffect(() => {
    const effects = new SceneScreenSpaceEffects(gl, () => settings.current, invalidate);
    const sentinels = [effects.firstSentinel, effects.lastSentinel];
    const showSentinels = (isShown: boolean) => sentinels.forEach((sentinel) => (sentinel.visible = isShown));
    // Shown, not added, by each pass: an add would tell every tracker of the scene that it changed.
    showSentinels(false);
    scene.add(...sentinels);
    const stopRegistering = registerEnvironmentPart(scene, environment, () => {
      showSentinels(true);
      const stopBeginning = observeSceneCamera(scene, effects.begin);
      const stopEnding = observeSceneRenderEnd(scene, effects.end);
      return () => {
        stopBeginning();
        stopEnding();
        showSentinels(false);
      };
    });
    return () => {
      stopRegistering();
      scene.remove(...sentinels);
      effects.dispose();
    };
  }, [gl, scene, environment, invalidate]);

  return null;
}
