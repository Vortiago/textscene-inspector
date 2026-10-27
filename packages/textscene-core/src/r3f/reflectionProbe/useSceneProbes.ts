/**
 * Holds its scene's probes while a ReflectionProbe component is mounted, and drives them once a
 * frame. The first holder drives, so a scene with several probes updates them once.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { useResourceLoader } from '../../resources/useResource.js';
import { textureWork } from '../../resources/textures/textureWork.js';
import { fontWork } from '../controls/native/text/sceneFontLoader.js';
import { SceneHolding } from '../sceneHolding.js';
import { useSceneHolder } from '../useSceneHolder.js';
import { useProjectClearColor } from '../useProjectClearColor.js';
import { SceneProbes } from './sceneProbes.js';

const probesOfScenes = new SceneHolding((scene, renderer) => new SceneProbes(renderer, scene));

export function useSceneProbes(): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useResourceLoader();
  const clearColor = useRef<THREE.Color>(null!);
  clearColor.current = useProjectClearColor();
  const holder = useSceneHolder(probesOfScenes);

  useFrame(() => {
    if (!probesOfScenes.isDriver(scene, holder)) return;
    const pending = (loader?.pendingResourceCount ?? 0) + textureWork.pending() + fontWork.pending();
    if (probesOfScenes.of(scene)!.update(pending, clearColor.current)) invalidate();
  });
}
