/**
 * Editor-only gizmo helpers for the three light types. Each gizmo
 * attaches a `THREE.*LightHelper` to the underlying THREE light object
 * so users can see where lights are placed and how they're aimed.
 *
 * Pattern: the light component creates a ref, renders its `<*Light>`
 * with that ref, and additionally renders `<*LightGizmo lightRef={ref}>`.
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
 * WI-ARCH-3: lifecycle (build/dispose/tick-update) delegated to
 * `usePrimitiveHelper`. The selection gate is expressed as
 * "factory returns null when not visible" — see `lightHelperFactory`.
 *
 * Outside a NodeDispatcher (standalone-test usage), `useNodePath()`
 * returns `null`; the gate then evaluates to `false` and the gizmo is
 * hidden. None of the existing light-property regression tests assert
 * gizmo presence, so this is harmless for the test suite.
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../../r3f/contexts/SelectionContext';
import { usePrimitiveHelper } from '../../../../r3f/hooks/useTHREEHelper';

const HELPER_COLOR = 0xffff00;
const DIRECTIONAL_HELPER_SIZE = 1.0;
const POINT_HELPER_SIZE = 0.25;

/**
 * Returns true when this gizmo's owning TSCN node is the currently
 * selected node in the panel's SelectionContext. Used by every gizmo
 * variant below — and by Camera3D / AudioStreamPlayer3D — to suppress
 * editor decorations unless the user has explicitly picked this node.
 *
 * Outside a NodeDispatcher (standalone-test usage where the component
 * mounts without a NodePathProvider), this returns false so gizmos
 * stay hidden.
 */
export function useGizmoVisible(): boolean {
  const path = useNodePath();
  const selection = useOptionalSelection();
  if (path === null) return false;
  return selection?.selectedNodePath === path;
}

/**
 * Generic `<primitive>`-renderer for any THREE light helper. The
 * `make` callback constructs the right `*LightHelper` once the light's
 * ref resolves; the hook handles construction, per-frame update, and
 * dispose. Returning null from `make` (no light ref yet, or selection
 * gate closed) tears down whatever was previously mounted.
 */
function LightGizmoCommon<L extends THREE.Light, H extends THREE.Object3D & { update?: () => void; dispose?: () => void }>(
  props: { lightRef: React.RefObject<L | null>; make: (light: L) => H }
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
  lightRef: React.RefObject<THREE.DirectionalLight | null>;
}

export function DirectionalLightGizmo({ lightRef }: DirectionalGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) =>
        new THREE.DirectionalLightHelper(light, DIRECTIONAL_HELPER_SIZE, HELPER_COLOR)
      }
    />
  );
}

interface PointGizmoProps {
  lightRef: React.RefObject<THREE.PointLight | null>;
}

export function PointLightGizmo({ lightRef }: PointGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) => new THREE.PointLightHelper(light, POINT_HELPER_SIZE, HELPER_COLOR)}
    />
  );
}

interface SpotGizmoProps {
  lightRef: React.RefObject<THREE.SpotLight | null>;
}

export function SpotLightGizmo({ lightRef }: SpotGizmoProps) {
  return (
    <LightGizmoCommon
      lightRef={lightRef}
      make={(light) => new THREE.SpotLightHelper(light, HELPER_COLOR)}
    />
  );
}

// Re-use the unused-ref pattern to keep useRef out of the call site;
// caller defines its own ref and we attach the helper to it.
export function useLightRef<T extends THREE.Light>(): React.RefObject<T | null> {
  return useRef<T | null>(null);
}
