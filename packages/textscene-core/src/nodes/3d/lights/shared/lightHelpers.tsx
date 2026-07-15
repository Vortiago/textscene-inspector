/**
 * Editor-only gizmo helpers for the three light types. Each gizmo
 * attaches a `THREE.*LightHelper` to the underlying THREE light object
 * so users can see where lights are placed and how they're aimed.
 *
 * Pattern: the light component creates a ref, renders its `<*Light>`
 * with that ref, and additionally renders `<*LightGizmo lightRef={ref}>`.
 *
 * Gizmos are gated on the owning light's TSCN path matching
 * `SelectionContext.selectedNodePath`. Without this gate, a scene with
 * many lights (e.g. `example-hallway.tscn`'s 18 spotlights) rendered 18
 * overlapping yellow cones that obscured the actual scene meshes. Matches
 * main's `HelperManager.setHelper('highlight', ...)` behavior — only the
 * selected node carries a visible gizmo. Hover does NOT show the gizmo;
 * the orange `HoverHighlight` BoxHelper is the hover affordance.
 *
 * Lifecycle (build/dispose/tick-update) delegated to
 * `usePrimitiveHelper`. The selection gate is expressed as
 * "factory returns null when not visible" — see `lightHelperFactory`.
 *
 * Outside a NodeDispatcher (standalone-test usage), `useNodePath()`
 * returns `null`; the gate then evaluates to `false` and the gizmo is
 * hidden. None of the existing light-property regression tests assert
 * gizmo presence, so this is harmless for the test suite.
 */

import type { RefObject } from 'react';
import * as THREE from 'three';
import { usePrimitiveHelper, correctHelperForParentGroup } from '../../../../r3f/hooks/useTHREEHelper';

// `useGizmoVisible` was promoted to a shared hook (r3f/hooks) so 2D
// marker/path slices can reuse the selection gate without importing from a
// lights slice. Imported for local use by the light gizmos below and
// re-exported for the existing light/camera/audio importers.
import { useGizmoVisible } from '../../../../r3f/hooks/useGizmoVisible';

export { useGizmoVisible };

const HELPER_COLOR = 0xffff00;
const DIRECTIONAL_HELPER_SIZE = 1.0;
const POINT_HELPER_SIZE = 0.25;

/**
 * Generic `<primitive>`-renderer for any THREE light helper. The
 * `make` callback constructs the right `*LightHelper` once the light's
 * ref resolves; the hook handles construction, per-frame update, and
 * dispose. Returning null from `make` (no light ref yet, or selection
 * gate closed) tears down whatever was previously mounted.
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
        // THREE.PointLightHelper shares DirectionalLightHelper's
        // `matrix = light.matrixWorld` + `matrixAutoUpdate = false`
        // constructor pattern — same fix (see `correctHelperForParentGroup`'s
        // doc comment in `r3f/hooks/useTHREEHelper.ts`).
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
