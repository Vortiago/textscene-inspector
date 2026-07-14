/**
 * Unified THREE helper lifecycle.
 *
 * Before this hook the codebase had **six** independent reimplementations
 * of the same lifecycle:
 *   - `SelectionHighlight.tsx`        BoxHelper, scene-attached, per-frame update
 *   - `HoverHighlight.tsx`            BoxHelper, scene-attached, per-frame update
 *   - `DirectionalLightGizmo`         DirectionalLightHelper, <primitive>, per-frame update
 *   - `PointLightGizmo`               PointLightHelper, <primitive>, per-frame update
 *   - `SpotLightGizmo`                SpotLightHelper, <primitive>, per-frame update
 *   - `CameraGizmo` (camera3d)        CameraHelper, <primitive>, per-frame update
 *
 * All six follow the same pattern: build a THREE helper bound to a target,
 * tear it down when the target / deps change or when the component
 * unmounts. The split was only in **how the helper attaches to the scene**:
 * the BoxHelpers `scene.add()` themselves (the active scene is dynamic at
 * selection-change time) while the gizmos render via `<primitive>` so R3F
 * parents them under the owning node group.
 *
 * Two thin hooks share a creation-and-dispose core:
 *   - `useSceneHelper(factory, deps)` — scene-attached helpers
 *     (BoxHelpers, where the consumer wants the helper visible in world
 *     space independent of any node group). Handles `scene.add()` /
 *     `scene.remove()` + dispose internally.
 *   - `usePrimitiveHelper(factory, deps, options?)` — `<primitive>`-mounted
 *     helpers (gizmos parented under their owning node's group). Returns
 *     the helper instance for the caller to render; handles dispose.
 *
 * Both opt into a per-frame `update()` call by default. `CameraGizmo` used
 * to opt out via `{ tickUpdate: false }` (the frustum geometry itself is
 * static unless the camera's own projection mutates), but `CameraHelper`
 * needs the SAME parent-group correction as the light helpers
 * (`correctHelperForParentGroup`, below) whose wrapped `update()` runs only
 * on the per-frame tick — so it now takes the default, paying one Matrix4
 * invert per frame while selected (negligible, and bounded to at most one
 * live gizmo by the selection gate).
 *
 * The `factory` callback is invoked inside `useEffect` to defer
 * construction past mount (so refs that resolve on the first render are
 * available). Returning `null` from `factory` signals "no helper this
 * cycle" — the hook treats that as "tear down whatever was there before
 * and stay empty". This is how the gizmos express their selection gate
 * without the hook needing to know about `useGizmoVisible`.
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnimationTransport } from '../contexts/AnimationTransportContext.js';

interface HelperLike extends THREE.Object3D {
  /** Optional — most THREE helpers (BoxHelper, *LightHelper) expose this. */
  update?: () => void;
  /** Optional — all THREE helpers expose this when they own GPU resources. */
  dispose?: () => void;
}

interface HelperHookOptions {
  /**
   * Whether to call `helper.update()` every render frame. Defaults to
   * true; only `THREE.CameraHelper` typically wants `false` (no per-tick
   * geometry refresh needed).
   */
  tickUpdate?: boolean;
}

/**
 * Internal: shared "build → render-then-update → dispose" effect logic
 * used by both `useSceneHelper` and `usePrimitiveHelper`.
 *
 * The `mount` callback receives the helper and returns an undo function
 * the hook will invoke during teardown. Two mounting strategies:
 *   - scene mode: `mount` calls `scene.add(helper)` and returns a closure
 *     that calls `scene.remove(helper)`. The helper is owned by the scene
 *     until disposal.
 *   - primitive mode: `mount` is a no-op (R3F mounts the returned helper
 *     via `<primitive object={helper}>`); the dispose path still runs.
 *
 * The factory is called inside `useEffect`, so target refs resolved on
 * first render are populated. Returning null from the factory tears down
 * the current helper without replacement — the selection gate uses this.
 */
function useHelperLifecycle<H extends HelperLike>(
  factory: () => H | null,
  deps: ReadonlyArray<unknown>,
  mount: (helper: H) => (() => void) | undefined,
  tickUpdate: boolean
): H | null {
  const [helper, setHelper] = useState<H | null>(null);
  const helperRef = useRef<H | null>(null);

  // One GRACE frame after the tick gate closes: the React commit that flips
  // `tickUpdate` false (e.g. the transport's play → stopped edge) lands
  // BEFORE the frame in which the driver's 'stopped' branch restores the
  // authored pose — the drivers mount ahead of the helper consumers, so
  // their useFrame runs first within that frame. Without one more update the
  // helper would freeze at the mid-animation pose the instant the gate shut.
  const graceFramesRef = useRef(0);
  const prevTickUpdateRef = useRef(tickUpdate);
  if (prevTickUpdateRef.current && !tickUpdate) graceFramesRef.current = 1;
  prevTickUpdateRef.current = tickUpdate;

  useEffect(() => {
    const created = factory();
    if (!created) {
      setHelper(null);
      helperRef.current = null;
      return;
    }
    const unmount = mount(created);
    setHelper(created);
    helperRef.current = created;

    return () => {
      unmount?.();
      created.dispose?.();
      helperRef.current = null;
    };
    // The `factory` and `mount` callbacks intentionally capture current
    // render closure state (target refs, helper-type constructor args).
    // Only `deps` controls re-runs; we don't want a fresh function
    // identity to retrigger the lifecycle every render.
  }, deps);

  useFrame(() => {
    if (tickUpdate) {
      helperRef.current?.update?.();
    } else if (graceFramesRef.current > 0) {
      graceFramesRef.current -= 1;
      helperRef.current?.update?.();
    }
  });

  return helper;
}

/**
 * PERF: the `tickUpdate` value for helpers that track a scene
 * object (selection/hover boxes). A static scene never needs the helper
 * recomputed after its initial placement (the helper's constructor already
 * runs `update()` once); only an active playback driver can move the target
 * between renders. `paused` still counts — a scrub seeks the mixer without
 * flipping `playState` back to `'playing'`.
 */
export function useHelperTickUpdate(): boolean {
  const { playState } = useAnimationTransport();
  return playState !== 'stopped';
}

/**
 * Hook for THREE helpers that live in world space (attached to the
 * scene root). Returns the active helper instance, or null when the
 * factory returned null. Most callers can discard the return value —
 * the helper is already mounted in the scene; just call this hook and
 * the lifecycle is handled.
 *
 * Pass `tickUpdate: false` for helpers whose geometry doesn't drift
 * (rare for scene-attached helpers; included for symmetry with
 * `usePrimitiveHelper`).
 */
export function useSceneHelper<H extends HelperLike>(
  factory: () => H | null,
  deps: ReadonlyArray<unknown>,
  options: HelperHookOptions = {}
): H | null {
  const scene = useThree((s) => s.scene);
  return useHelperLifecycle<H>(
    factory,
    [scene, ...deps],
    (helper) => {
      scene.add(helper);
      return () => {
        scene.remove(helper);
      };
    },
    options.tickUpdate ?? true
  );
}

/**
 * Hook for THREE helpers that R3F mounts via `<primitive object={...}>`.
 * Caller renders the returned instance themselves; the hook handles
 * construction + dispose + per-frame update.
 *
 * Returns the active helper instance, or `null` when the factory said
 * "no helper this cycle" (e.g. selection gate hides the gizmo).
 */
export function usePrimitiveHelper<H extends HelperLike>(
  factory: () => H | null,
  deps: ReadonlyArray<unknown>,
  options: HelperHookOptions = {}
): H | null {
  return useHelperLifecycle<H>(
    factory,
    deps,
    () => undefined, // R3F handles the parenting when caller renders <primitive>
    options.tickUpdate ?? true
  );
}

/**
 * Makes a THREE helper whose constructor aliases `this.matrix = target.matrixWorld`
 * (`matrixAutoUpdate = false`) behave correctly when mounted as a `<primitive>`
 * SIBLING of its target inside the target's own transform group — the pattern
 * every `usePrimitiveHelper` consumer in this codebase uses — instead of
 * `scene.add(helper)`'d directly at the root the way the affected THREE
 * helpers' own doc-comment examples assume. `DirectionalLightHelper`,
 * `PointLightHelper`, and `CameraHelper` all share this constructor pattern
 * (`SpotLightHelper` does not — its own `update()` is already parent-aware).
 *
 * Both hardcode `this.matrix = target.matrixWorld` (an ALIAS — the same
 * Matrix4 object, not a copy) plus `matrixAutoUpdate = false`. That is fine
 * at the scene root (parent.matrixWorld is identity, so
 * `helper.matrixWorld === target.matrixWorld` automatically) but breaks two
 * ways once nested under a non-identity parent group:
 *
 * 1. Double-transform: `helper.matrixWorld = parent.matrixWorld *
 *    helper.matrix`, and `helper.matrix` already IS a world matrix
 *    (`target.matrixWorld`) — the parent group's transform applies a SECOND
 *    time on top, squaring it. The helper renders far from its target.
 * 2. Shared-object corruption: naively re-enabling `matrixAutoUpdate` so the
 *    parent chain composes the helper's OWN (identity) local
 *    position/quaternion/scale instead is not a fix — three.js's generic
 *    per-frame `updateMatrix()` does `this.matrix.compose(...)`, which
 *    mutates whatever object `this.matrix` currently IS. Since that object
 *    is still `target.matrixWorld` (the alias was never broken), this
 *    silently clobbers the target's own world matrix to identity right
 *    before the renderer reads it — corrupting the target's actual
 *    behavior (light shading, camera projection) the instant its gizmo
 *    mounts.
 *
 * The fix mirrors `THREE.SpotLightHelper`'s own `update()` method (already
 * correct, unmodified): break the alias with a fresh, private Matrix4, then
 * every frame recompute the helper's LOCAL matrix as `parent.matrixWorld⁻¹ ·
 * target.matrixWorld` so the normal parent-chain multiply reproduces
 * `target.matrixWorld` exactly, and copy `target.matrixWorld` into the
 * helper's `matrixWorld` directly so it's correct even before that next
 * traversal runs. `matrixAutoUpdate` stays at its native `false` — the
 * generic compose()-based recompute must never touch this helper.
 *
 * Also explicitly refreshes `target.updateWorldMatrix(true, false)` before
 * reading it: `DirectionalLightHelper`/`PointLightHelper`'s own `update()`
 * (called first, via `nativeUpdate`) happens to do this internally for
 * their light, but `CameraHelper.update()` does NOT touch the camera's
 * matrixWorld at all — relying on that as a side effect left the camera
 * case reading a stale (pre-render) `target.matrixWorld` and computing a
 * wrong correction. Refreshing `target` here directly makes this function
 * correct for any target, independent of what the wrapped helper's own
 * `update()` happens to do.
 *
 * Deliberately does NOT run the wrapped `update()` eagerly here: this is
 * typically called inside a `usePrimitiveHelper` factory, which executes
 * inside its mount effect, before React has committed the `<primitive
 * object={helper}>` that actually parents it under the node's group —
 * `helper.parent` is always `null` at this point, so any correction
 * computed now would be wrong the instant a parent exists. The consuming
 * hook's per-frame `update()` call (via `useFrame`) is what actually
 * applies the correction — callers MUST pass `{ tickUpdate: true }` (the
 * default) to `usePrimitiveHelper`/`useSceneHelper`, or this correction
 * never runs.
 */
export function correctHelperForParentGroup<H extends THREE.Object3D & { update: () => void }>(
  helper: H,
  target: THREE.Object3D
): H {
  helper.matrix = new THREE.Matrix4();
  const nativeUpdate = helper.update.bind(helper);
  helper.update = () => {
    nativeUpdate();
    const parent = helper.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      target.updateWorldMatrix(true, false);
      helper.matrix.copy(parent.matrixWorld).invert().multiply(target.matrixWorld);
      helper.matrixWorld.copy(target.matrixWorld);
    }
  };
  return helper;
}
