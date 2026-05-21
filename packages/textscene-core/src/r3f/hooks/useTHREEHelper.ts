/**
 * WI-ARCH-3 — unified THREE helper lifecycle.
 *
 * Before this hook the codebase had **six** independent reimplementations
 * of the same lifecycle:
 *   - `SelectionHighlight.tsx`        BoxHelper, scene-attached, per-frame update
 *   - `HoverHighlight.tsx`            BoxHelper, scene-attached, per-frame update
 *   - `DirectionalLightGizmo`         DirectionalLightHelper, <primitive>, per-frame update
 *   - `PointLightGizmo`               PointLightHelper, <primitive>, per-frame update
 *   - `SpotLightGizmo`                SpotLightHelper, <primitive>, per-frame update
 *   - `CameraGizmo` (camera3d)        CameraHelper, <primitive>, NO per-frame update
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
 * Both opt into a per-frame `update()` call by default. The CameraHelper
 * doesn't need per-tick update (frustum is static unless the camera's own
 * projection mutates, which the dispatcher's transform handling already
 * triggers via deps); pass `{ tickUpdate: false }` to opt out.
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
import type * as THREE from 'three';

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
    if (tickUpdate) helperRef.current?.update?.();
  });

  return helper;
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
