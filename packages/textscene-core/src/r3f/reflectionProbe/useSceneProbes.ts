/**
 * Holds its scene's probes while a ReflectionProbe component is mounted, and drives them once a
 * frame. The first holder drives, so a scene with several probes updates them once.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useResourceLoader } from '../../resources/useResource.js';
import { textureWork } from '../../resources/textures/textureWork.js';
import { fontWork } from '../controls/native/text/settledChannel.js';
import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { useProjectClearColor } from '../useProjectClearColor.js';
import { SceneProbes, type ProbeFrame } from './sceneProbes.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { projectFastFilterQuality } from '../../parser/projectSettingsParser.js';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext.js';

const probesOfScenes = new SceneHolding((scene, renderer) => new SceneProbes(renderer, scene));

export function useSceneProbes(): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useResourceLoader();
  const frame = useRef<ProbeFrame>(null!);
  frame.current = {
    clearColor: useProjectClearColor(),
    viewport: useViewportDescription(),
    fastFilterQuality: projectFastFilterQuality(useProjectSettings().settings),
  };
  const holder = useSceneHolder(probesOfScenes);

  useFrame(() => {
    const probes = probesOfScenes.drivenBy(scene, holder);
    if (!probes) return;
    const pending = (loader?.pendingResourceCount ?? 0) + textureWork.pending() + fontWork.pending();
    if (probes.update(pending, frame.current)) invalidate();
  });
}
