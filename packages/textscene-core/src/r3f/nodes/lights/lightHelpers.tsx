/**
 * Editor-only gizmo helpers for the three light types. Each helper
 * attaches a `THREE.*LightHelper` to the underlying THREE light object so
 * users can see where lights are placed and how they're aimed even when
 * the scene contains nothing they'd directly illuminate.
 *
 * Pattern: the light component creates a ref, renders its `<*Light>`
 * with that ref, and additionally renders `<*LightGizmo lightRef={ref}>`.
 * The gizmo subscribes to the light object's transform via useFrame so
 * it stays in sync if the light moves.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HELPER_COLOR = 0xffff00;
const DIRECTIONAL_HELPER_SIZE = 1.0;
const POINT_HELPER_SIZE = 0.25;

interface DirectionalGizmoProps {
  lightRef: React.RefObject<THREE.DirectionalLight | null>;
}

export function DirectionalLightGizmo({ lightRef }: DirectionalGizmoProps) {
  const [helper, setHelper] = useState<THREE.DirectionalLightHelper | null>(null);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.DirectionalLightHelper(light, DIRECTIONAL_HELPER_SIZE, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef]);

  useFrame(() => {
    helper?.update();
  });

  if (!helper) return null;
  return <primitive object={helper} />;
}

interface PointGizmoProps {
  lightRef: React.RefObject<THREE.PointLight | null>;
}

export function PointLightGizmo({ lightRef }: PointGizmoProps) {
  const [helper, setHelper] = useState<THREE.PointLightHelper | null>(null);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.PointLightHelper(light, POINT_HELPER_SIZE, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef]);

  useFrame(() => {
    helper?.update();
  });

  if (!helper) return null;
  return <primitive object={helper} />;
}

interface SpotGizmoProps {
  lightRef: React.RefObject<THREE.SpotLight | null>;
}

export function SpotLightGizmo({ lightRef }: SpotGizmoProps) {
  const [helper, setHelper] = useState<THREE.SpotLightHelper | null>(null);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.SpotLightHelper(light, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef]);

  useFrame(() => {
    helper?.update();
  });

  if (!helper) return null;
  return <primitive object={helper} />;
}

// Re-use the unused-ref pattern to keep useRef out of the call site;
// caller defines its own ref and we attach the helper to it.
export function useLightRef<T extends THREE.Light>(): React.RefObject<T | null> {
  return useRef<T | null>(null);
}
