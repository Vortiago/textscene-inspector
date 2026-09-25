/**
 * Editor gizmos for the three light types: `<*LightGizmo lightRef={ref}>` attaches
 * a `THREE.*LightHelper` to the light. Only the selected light shows one, since
 * many lights would bury the scene in cones. Hover shows `HoverHighlight` instead.
 * Outside a NodeDispatcher, `useNodePath()` is `null` and the gizmo stays hidden.
 */

import type { RefObject } from 'react';
import * as THREE from 'three';
import { usePrimitiveHelper, correctHelperForParentGroup } from '../../../../r3f/hooks/useTHREEHelper';

// Re-exported for the camera and audio gizmos.
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';

export { useGizmoVisible };

const HELPER_COLOR = 0xffff00;
const DIRECTIONAL_HELPER_SIZE = 1.0;
const POINT_HELPER_SIZE = 0.25;

/**
 * Renders any THREE light helper as a `<primitive>`. `make` builds the helper
 * once the light's ref resolves, and `usePrimitiveHelper` updates and disposes
 * it. No ref or a closed gate tears down whatever was mounted.
 */
function LightGizmoCommon<L extends THREE.Light, H extends THREE.Object3D & { update?: () => void; dispose?: () => void }>(
  props: { lightRef: RefObject<L | null>; make: (light: L) => H }
) {
  const visible = useGizmoVisible();
  const helper = usePrimitiveHelper<H>(
    () => {
      if (!visible) return null;
      const light = props.lightRef.current;
      return light ? props.make(light) : null;
    },
    [props.lightRef, visible]
  );
  return helper ? <primitive object={helper} /> : null;
}

interface DirectionalGizmoProps {
  lightRef: RefObject<THREE.DirectionalLight | null>;
}

export function DirectionalLightGizmo({ lightRef }: DirectionalGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) => {
        const helper = new THREE.DirectionalLightHelper(light, DIRECTIONAL_HELPER_SIZE, HELPER_COLOR);
        return correctHelperForParentGroup(helper, light);
      }}
    />
  );
}

interface PointGizmoProps {
  lightRef: RefObject<THREE.PointLight | null>;
}

export function PointLightGizmo({ lightRef }: PointGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) => {
        // THREE.PointLightHelper has DirectionalLightHelper's `matrix =
        // light.matrixWorld` aliasing, so it takes the same correction
        // (`r3f/hooks/useTHREEHelper.ts`).
        const helper = new THREE.PointLightHelper(light, POINT_HELPER_SIZE, HELPER_COLOR);
        return correctHelperForParentGroup(helper, light);
      }}
    />
  );
}

interface SpotGizmoProps {
  lightRef: RefObject<THREE.SpotLight | null>;
}

export function SpotLightGizmo({ lightRef }: SpotGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) => new THREE.SpotLightHelper(light, HELPER_COLOR)}
    />
  );
}
