/**
 * Holds its scene's probes while a ReflectionProbe component is mounted, and drives them once a
 * frame. The first holder drives, so a scene with several probes updates them once.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { useResourceLoader } from '../../resources/useResource.js';
import { pendingTextureWork } from '../../resources/textures/textureWork.js';
import { useProjectClearColor } from '../useProjectClearColor.js';
import { SceneProbes } from './sceneProbes.js';
import { beginStep, endStep } from '../frameProfile/frameProfile.js';

interface Held {
  probes: SceneProbes;
  /** In mount order, so the first is the one that drives. */
  holders: Set<symbol>;
}

/** Written only by `useSceneProbes`. A scene's entry leaves with its last holder. */
const heldByScene = new WeakMap<THREE.Scene, Held>();

export function useSceneProbes(): void {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useResourceLoader();
  const clearColor = useRef<THREE.Color>(null!);
  clearColor.current = useProjectClearColor();
  const [holder] = useState(() => Symbol('reflection probe'));

  useEffect(() => {
    const held = heldByScene.get(scene) ?? { probes: new SceneProbes(gl, scene), holders: new Set() };
    heldByScene.set(scene, held);
    held.holders.add(holder);
    return () => {
      held.holders.delete(holder);
      if (held.holders.size > 0) return;
      held.probes.dispose();
      heldByScene.delete(scene);
    };
  }, [gl, scene, holder]);

  useFrame(() => {
    const held = heldByScene.get(scene);
    if (!held || held.holders.values().next().value !== holder) return;
    const pending = (loader?.pendingResourceCount ?? 0) + pendingTextureWork();
    beginStep(gl, 'Reflection probes');
    const hasDrawn = held.probes.update(pending, clearColor.current);
    endStep(gl, 'Reflection probes');
    if (hasDrawn) invalidate();
  });
}
