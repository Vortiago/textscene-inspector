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

import * as THREE from 'three';
import { usePrimitiveHelper } from '../../../../r3f/hooks/useTHREEHelper';

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
 * Makes a `THREE.DirectionalLightHelper` / `THREE.PointLightHelper` behave
 * correctly when mounted as a `<primitive>` SIBLING of its light inside the
 * node's own transform group (WI-ARCH-3's shared pattern), instead of
 * `scene.add(helper)`'d directly at the root the way both classes'
 * doc-comment examples assume.
 *
 * Both constructors hardcode `this.matrix = light.matrixWorld` (an ALIAS —
 * the same Matrix4 object, not a copy) plus `matrixAutoUpdate = false`. That
 * is fine at the scene root (parent.matrixWorld is identity, so
 * `helper.matrixWorld === light.matrixWorld` automatically) but breaks two
 * ways once nested under a non-identity parent group, both found by
 * comparing this bucket's new selection-gated light baselines against
 * their unselected counterparts:
 *
 * 1. Double-transform: `helper.matrixWorld = parent.matrixWorld *
 *    helper.matrix`, and `helper.matrix` already IS a world matrix
 *    (`light.matrixWorld`) — the parent group's transform applies a SECOND
 *    time on top, squaring it. The helper renders far from the light.
 * 2. Shared-object corruption: naively re-enabling `matrixAutoUpdate` so
 *    the parent chain composes the helper's OWN (identity) local
 *    position/quaternion/scale instead is not a fix — three.js's generic
 *    per-frame `updateMatrix()` does `this.matrix.compose(...)`, which
 *    mutates whatever object `this.matrix` currently IS. Since that object
 *    is still `light.matrixWorld` (the alias was never broken), this
 *    silently clobbers the light's own world matrix to identity right
 *    before the renderer reads it for shading — corrupting the light's
 *    actual illumination the instant its gizmo is selected.
 *
 * The fix mirrors `THREE.SpotLightHelper`'s own `update()` method (already
 * correct, unmodified, proven by this same nested-parent scheme's
 * `spot-light-3d-selected` baseline): break the alias with a fresh, private
 * Matrix4, then every frame recompute the helper's LOCAL matrix as
 * `parent.matrixWorld⁻¹ · light.matrixWorld` so the normal parent-chain
 * multiply reproduces `light.matrixWorld` exactly, and copy
 * `light.matrixWorld` into the helper's `matrixWorld` directly so it's
 * correct even before that next traversal runs. `matrixAutoUpdate` stays at
 * its native `false` — the generic compose()-based recompute must never
 * touch this helper.
 *
 * Deliberately does NOT run the wrapped `update()` eagerly here: this
 * factory executes inside `usePrimitiveHelper`'s mount effect, before
 * React has committed the `<primitive object={helper}>` that actually
 * parents it under the node's group — `helper.parent` is always `null` at
 * this point, so any correction computed now would be wrong the instant a
 * parent exists. `usePrimitiveHelper`'s per-frame `update()` call (via
 * `useFrame`) is what actually applies the correction, and — same as
 * every other gizmo sharing that hook — always runs at least once before
 * the FIRST real `gl.render()` reaches the screen, since R3F never renders
 * synchronously mid-commit.
 */
function correctForParentGroup<H extends THREE.Object3D & { update: () => void }>(
  helper: H,
  light: THREE.Light
): H {
  helper.matrix = new THREE.Matrix4();
  const nativeUpdate = helper.update.bind(helper);
  helper.update = () => {
    nativeUpdate();
    const parent = helper.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      helper.matrix.copy(parent.matrixWorld).invert().multiply(light.matrixWorld);
      helper.matrixWorld.copy(light.matrixWorld);
    }
  };
  return helper;
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
      make={(light) => {
        const helper = new THREE.DirectionalLightHelper(light, DIRECTIONAL_HELPER_SIZE, HELPER_COLOR);
        return correctForParentGroup(helper, light);
      }}
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
      make={(light) => {
        // THREE.PointLightHelper shares DirectionalLightHelper's
        // `matrix = light.matrixWorld` + `matrixAutoUpdate = false`
        // constructor pattern — same fix (see `correctForParentGroup`'s doc
        // comment above).
        const helper = new THREE.PointLightHelper(light, POINT_HELPER_SIZE, HELPER_COLOR);
        return correctForParentGroup(helper, light);
      }}
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
