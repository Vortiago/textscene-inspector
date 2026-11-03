/**
 * Draws an Environment's screen-space reflection into its scene, for each render through whichever
 * camera renders it, while its Environment is on the scene (`sceneEnvironment.tsx`).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { projectTracesHalfSizeReflections } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { registerEnvironmentPart, useEnvironmentKey } from '../environment/sceneEnvironment.js';
import type { ScreenSpaceReflection } from '../../resources/environment/types.js';
import { SceneReflections, type ReflectionSettings } from './sceneReflections.js';

export function ScreenSpaceReflectionLayer({ ssr }: { ssr: ScreenSpaceReflection }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const environment = useEnvironmentKey();
  const { settings: projectSettings } = useProjectSettings();
  const isHalfSize = useMemo(() => projectTracesHalfSizeReflections(projectSettings), [projectSettings]);
  // Read at each trace, so a new setting reaches the next render with each buffer's history kept.
  const settings = useRef<ReflectionSettings>({ ssr, isHalfSize });
  settings.current = { ssr, isHalfSize };

  useEffect(() => {
    const reflections = new SceneReflections(gl, () => settings.current, invalidate);
    const sentinels = [reflections.firstSentinel, reflections.lastSentinel];
    const showSentinels = (isShown: boolean) => sentinels.forEach((sentinel) => (sentinel.visible = isShown));
    // Shown, not added, by each pass: an add would tell every tracker of the scene that it changed.
    showSentinels(false);
    scene.add(...sentinels);
    const stopRegistering = registerEnvironmentPart(scene, environment, () => {
      showSentinels(true);
      const stopBeginning = observeSceneCamera(scene, reflections.begin);
      const stopEnding = observeSceneRenderEnd(scene, reflections.end);
      return () => {
        stopBeginning();
        stopEnding();
        showSentinels(false);
      };
    });
    return () => {
      stopRegistering();
      scene.remove(...sentinels);
      reflections.dispose();
    };
  }, [gl, scene, environment, invalidate]);

  return null;
}
