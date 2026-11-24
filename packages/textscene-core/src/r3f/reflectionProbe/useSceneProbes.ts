/**
 * Holds its scene's probes while a ReflectionProbe component is mounted, and drives them once a
 * frame. The first holder drives, so a scene with several probes updates them once.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { memoisedImport } from '../../resources/memoisedImport.js';
import { useLazyModuleState } from '../../resources/useLazyModule.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler.js';
import { pendingSceneWork, totalPendingWork } from '../sceneWork.js';
import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { warnOnce } from '../../utils/warnOnce.js';
import { useProjectClearColor } from '../useProjectClearColor.js';
import { SceneProbes, type ProbeFrame } from './sceneProbes.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { projectFastFilterQuality } from '../../parser/projectSettingsParser.js';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext.js';

const probesOfScenes = new SceneHolding((scene, renderer) => new SceneProbes(renderer, scene));

/** Imported by the first probe only: its bake draws Godot's compute stages, which hold three's TSL. */
const loadProbeBake = memoisedImport(() => import('../../resources/sky/skyLayers.js'));

export const PROBE_BAKE_LOAD_FAILURE =
  '[ReflectionProbe] The previewer could not load its probe bake, so no probe captures. Reload to try again.';

export function useSceneProbes(): void {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useResourceLoader();
  const loaded = useLazyModuleState(loadProbeBake, true);
  const nodesHandler = useNodesHandler(gl);
  const bake = typeof loaded === 'object' && loaded !== null ? loaded.module : null;
  const isBakeReady = nodesHandler === 'ready' && bake !== null;
  const isLoadFailed = loaded === 'failed' || nodesHandler === 'failed';
  useEffect(() => {
    if (isBakeReady) invalidate();
    else if (isLoadFailed) warnOnce(loadProbeBake, 'failed', PROBE_BAKE_LOAD_FAILURE);
  }, [isBakeReady, isLoadFailed, invalidate]);
  const frame = useRef<ProbeFrame>(null!);
  frame.current = {
    clearColor: useProjectClearColor(),
    viewport: useViewportDescription(),
    fastFilterQuality: projectFastFilterQuality(useProjectSettings().settings),
    bakeAtlasLayers: isBakeReady ? bake.bakeAtlasLayers : null,
  };
  const holder = useSceneHolder(probesOfScenes);

  useFrame(() => {
    const probes = probesOfScenes.drivenBy(scene, holder);
    if (!probes) return;
    const pending = totalPendingWork(pendingSceneWork(loader));
    if (probes.update(pending, frame.current)) invalidate();
  });
}
