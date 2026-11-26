/**
 * Holds its scene's probes while a ReflectionProbe component is mounted, and drives them once a
 * frame. The first holder drives, so a scene with several probes updates them once.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { ViewportDescription } from '../viewportRender/viewportDescription.js';
import { usePendingLoads } from '../../resources/ResourceLoaderContext.js';
import { pendingSceneWork, totalPendingWork } from '../sceneWork.js';
import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { useProjectClearColor } from '../useProjectClearColor.js';
import { SceneProbes } from './sceneProbes.js';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext.js';

const probesOfScenes = new SceneHolding((scene, renderer) => new SceneProbes(renderer, scene));

export function useSceneProbes(): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const loads = usePendingLoads();
  const clearColor = useRef<THREE.Color>(null!);
  clearColor.current = useProjectClearColor();
  const viewport = useRef<ViewportDescription>(null!);
  viewport.current = useViewportDescription();
  const holder = useSceneHolder(probesOfScenes);

  useFrame(() => {
    const probes = probesOfScenes.drivenBy(scene, holder);
    if (!probes) return;
    const pending = totalPendingWork(pendingSceneWork(loads));
    if (probes.update(pending, clearColor.current, viewport.current)) invalidate();
  });
}
