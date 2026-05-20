/**
 * Editor-only gizmo helpers for the three light types. Each helper
 * attaches a `THREE.*LightHelper` to the underlying THREE light object so
 * users can see where lights are placed and how they're aimed.
 *
 * Pattern: the light component creates a ref, renders its `<*Light>`
 * with that ref, and additionally renders `<*LightGizmo lightRef={ref}>`.
 * The gizmo subscribes to the light object's transform via useFrame so
 * it stays in sync if the light moves.
 *
 * WI-UX-14: gizmos are gated on the owning light's TSCN path matching
 * `SelectionContext.selectedNodePath`. Without this gate, a scene with
 * many lights (e.g. `example-hallway.tscn`'s 18 spotlights) rendered 18
 * overlapping yellow cones that obscured the actual scene meshes. Matches
 * main's `HelperManager.setHelper('highlight', ...)` behavior — only the
 * selected node carries a visible gizmo. Hover does NOT show the gizmo;
 * the orange `HoverHighlight` BoxHelper from WI-UX-10 is the hover
 * affordance.
 *
 * Outside a NodeDispatcher (standalone-test usage), `useNodePath()`
 * returns `null`; the gate then evaluates to `false` and the gizmo is
 * hidden. None of the existing light-property regression tests assert
 * gizmo presence, so this is harmless for the test suite.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNodePath } from '../../contexts/NodePathContext.js';
import { useOptionalSelection } from '../../contexts/SelectionContext.js';

const HELPER_COLOR = 0xffff00;
const DIRECTIONAL_HELPER_SIZE = 1.0;
const POINT_HELPER_SIZE = 0.25;

/**
 * Returns true when this light's owning TSCN node is the currently
 * selected node in the panel's SelectionContext. Used by every gizmo
 * variant below to suppress the helper unless the user has explicitly
 * picked this light.
 */
function useGizmoVisible(): boolean {
  const path = useNodePath();
  const selection = useOptionalSelection();
  if (path === null) return false;
  return selection?.selectedNodePath === path;
}

interface DirectionalGizmoProps {
  lightRef: React.RefObject<THREE.DirectionalLight | null>;
}

export function DirectionalLightGizmo({ lightRef }: DirectionalGizmoProps) {
  const visible = useGizmoVisible();
  const [helper, setHelper] = useState<THREE.DirectionalLightHelper | null>(null);

  useEffect(() => {
    if (!visible) {
      setHelper(null);
      return;
    }
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.DirectionalLightHelper(light, DIRECTIONAL_HELPER_SIZE, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef, visible]);

  useFrame(() => {
    helper?.update();
  });

  if (!visible || !helper) return null;
  return <primitive object={helper} />;
}

interface PointGizmoProps {
  lightRef: React.RefObject<THREE.PointLight | null>;
}

export function PointLightGizmo({ lightRef }: PointGizmoProps) {
  const visible = useGizmoVisible();
  const [helper, setHelper] = useState<THREE.PointLightHelper | null>(null);

  useEffect(() => {
    if (!visible) {
      setHelper(null);
      return;
    }
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.PointLightHelper(light, POINT_HELPER_SIZE, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef, visible]);

  useFrame(() => {
    helper?.update();
  });

  if (!visible || !helper) return null;
  return <primitive object={helper} />;
}

interface SpotGizmoProps {
  lightRef: React.RefObject<THREE.SpotLight | null>;
}

export function SpotLightGizmo({ lightRef }: SpotGizmoProps) {
  const visible = useGizmoVisible();
  const [helper, setHelper] = useState<THREE.SpotLightHelper | null>(null);

  useEffect(() => {
    if (!visible) {
      setHelper(null);
      return;
    }
    const light = lightRef.current;
    if (!light) return;
    const created = new THREE.SpotLightHelper(light, HELPER_COLOR);
    setHelper(created);
    return () => {
      created.dispose?.();
    };
  }, [lightRef, visible]);

  useFrame(() => {
    helper?.update();
  });

  if (!visible || !helper) return null;
  return <primitive object={helper} />;
}

// Re-use the unused-ref pattern to keep useRef out of the call site;
// caller defines its own ref and we attach the helper to it.
export function useLightRef<T extends THREE.Light>(): React.RefObject<T | null> {
  return useRef<T | null>(null);
}
