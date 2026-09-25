/**
 * The THREE helper lifecycle: build a helper bound to a target, update it per frame, and dispose
 * it when the deps change or the component unmounts. A factory that returns null tears the helper
 * down, which is how a gizmo applies its selection gate.
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnimationTransport } from '../contexts/AnimationTransportContext.js';

interface HelperLike extends THREE.Object3D {
  /** Most THREE helpers (BoxHelper, *LightHelper) expose this. */
  update?: () => void;
}

interface HelperHookOptions {
  /** Whether to call `helper.update()` every frame. Defaults to true. */
  tickUpdate?: boolean;
}

/**
 * The build, update and dispose effect behind both hooks. `mount` attaches the helper and returns
 * its undo. The factory runs inside `useEffect`, so target refs from the first render are set.
 */
function useHelperLifecycle<H extends HelperLike>(
  factory: () => H | null,
  deps: ReadonlyArray<unknown>,
  mount: (helper: H) => (() => void) | undefined,
  tickUpdate: boolean
): H | null {
  const [helper, setHelper] = useState<H | null>(null);
  const helperRef = useRef<H | null>(null);

  // One grace frame after the tick gate closes: the commit that turns `tickUpdate` false lands
  // before the frame in which the driver's 'stopped' branch restores the authored pose, since
  // drivers mount first. Without it, the helper freezes at the mid-animation pose.
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
      created.dispose();
      helperRef.current = null;
    };
    // `factory` and `mount` are new arrow functions on each render, so listing them re-runs the
    // lifecycle every render. The caller's `deps` is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
 * `tickUpdate` for a helper that tracks a scene object. The constructor runs `update()` once, and
 * only a playback driver moves the target later. `paused` counts, since a scrub seeks the mixer
 * without setting `playState` to `'playing'`.
 */
export function useHelperTickUpdate(): boolean {
  const { playState } = useAnimationTransport();
  return playState !== 'stopped';
}

/** A helper attached to the scene root. Returns it, or null when the factory returned null. */
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
 * A helper the caller renders with `<primitive object={...}>`. Returns it, or null when the
 * factory returned null.
 */
export function usePrimitiveHelper<H extends HelperLike>(
  factory: () => H | null,
  deps: ReadonlyArray<unknown>,
  options: HelperHookOptions = {}
): H | null {
  return useHelperLifecycle<H>(
    factory,
    deps,
    () => undefined, // R3F parents the <primitive> the caller renders
    options.tickUpdate ?? true
  );
}

/**
 * For a helper whose constructor aliases `this.matrix = target.matrixWorld` with
 * `matrixAutoUpdate = false`: DirectionalLightHelper, PointLightHelper and CameraHelper. Mounted
 * under a non-identity parent, that alias applies the parent twice. SpotLightHelper is already
 * parent-aware. The correction runs in the per-frame `update()`, so keep `tickUpdate: true`.
 */
export function correctHelperForParentGroup<H extends THREE.Object3D & { update: () => void }>(
  helper: H,
  target: THREE.Object3D
): H {
  // Break the alias. Re-enabling `matrixAutoUpdate` instead lets `compose()` write the helper's
  // identity into the target's own world matrix.
  helper.matrix = new THREE.Matrix4();
  const nativeUpdate = helper.update.bind(helper);
  helper.update = () => {
    nativeUpdate();
    // Null inside a `usePrimitiveHelper` factory, before React commits the `<primitive>`.
    const parent = helper.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      // `CameraHelper.update()` leaves the camera's world matrix stale.
      target.updateWorldMatrix(true, false);
      // Local = parent⁻¹ · target, so the parent chain reproduces the target's world matrix.
      // matrixWorld is copied too, so it is right before that traversal runs.
      helper.matrix.copy(parent.matrixWorld).invert().multiply(target.matrixWorld);
      helper.matrixWorld.copy(target.matrixWorld);
    }
  };
  return helper;
}
