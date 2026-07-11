/**
 * `<TscnCanvas>` — the top-level React component for rendering a parsed
 * TSCN scene under react-three-fiber.
 *
 * WI-R3F-1: empty canvas with default lighting.
 * WI-R3F-5 (this file): consumes `HierarchyContext.sceneGraph` and the
 * `<NodeDispatcher>` to render the scene tree; provides
 * `<SceneResourcesProvider>` so MeshInstance3D / WorldEnvironment can
 * synchronously read internal/external resources; switches the active
 * camera based on `CameraControlContext` when the user clicks "Use
 * This Camera" on a Camera3D node.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalCameraControl } from './contexts/CameraControlContext.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { HoverHighlight } from './components/HoverHighlight.js';
import { computeWorldBoundingBox } from './bounds.js';
import { InternalTextLabel } from './internalTextLabel.js';
import styles from './TscnCanvas.module.css';

/**
 * The contents of the R3F scene (everything that would normally live
 * inside `<Canvas>`). Exported separately so `@react-three/test-renderer`
 * can mount it directly — the test renderer is the canvas substitute and
 * cannot wrap a real `<Canvas>` host.
 *
 * Reads its sceneGraph from `HierarchyContext`. Falls back to the empty
 * default-lighting scene when no provider is mounted (matches the
 * WI-R3F-1 baseline test).
 */
export function TscnSceneContents() {
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const nodes = rootScene?.nodes ?? null;
  // Gap 8 (WI-UX-4): show a grid + prompt when nothing has loaded.
  // Without this the canvas is a black void and indistinguishable from
  // a renderer crash. The grid also gives the orbit controls a tangible
  // surface so the initial-camera framing feels intentional.
  const isEmpty = nodes === null || nodes.length === 0;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      {isEmpty && <EmptySceneIndicator />}
      {nodes && rootScene && (
        <SceneResourcesProvider
          internalResources={rootScene.internalResources}
          externalResources={rootScene.externalResources}
        >
          <NodeDispatcher nodes={nodes} />
        </SceneResourcesProvider>
      )}
      <SelectionHighlight />
      <HoverHighlight />
    </>
  );
}

function EmptySceneIndicator() {
  return (
    <group userData={{ tscnEmptyState: true }}>
      <gridHelper args={[10, 10, 0x444444, 0x222222]} />
      <InternalTextLabel
        text="Load a scene to begin"
        position={[0, 0.4, 0]}
        fontSize={0.35}
        color="#888888"
      />
    </group>
  );
}

/**
 * Switches the canvas's active camera based on `CameraControlContext`.
 * Mounted inside the `<Canvas>` so it has access to `useThree`. When the
 * user picks a Camera3D node and clicks "Use This Camera", we find a
 * THREE.Camera in the scene at that node path and call `state.set` to
 * make it the active render camera; "Reset" returns to the default
 * orbit camera.
 */
function ActiveCameraSwitcher() {
  const control = useOptionalCameraControl();
  const activeCameraPath = control?.activeCameraPath ?? null;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);

  useEffect(() => {
    if (!activeCameraPath) {
      // Free-orbit: restore the default perspective camera. R3F sets one
      // up automatically; we just need to ensure it's the active one.
      // The default camera is preserved in `state.previousCamera` after
      // we swap, but R3F doesn't expose that cleanly — instead we look
      // for any THREE.PerspectiveCamera the user didn't add via a node.
      return;
    }

    // Find a camera whose userData carries our node-path tag (set by
    // Camera3D below when ActiveCameraSwitcher is active). If we don't
    // find one, fall back to the first camera with the matching name.
    let target: THREE.Camera | null = null;
    scene.traverse((object) => {
      if (target) return;
      if (
        object instanceof THREE.PerspectiveCamera ||
        object instanceof THREE.OrthographicCamera
      ) {
        const tag = (object.userData as { tscnPath?: string }).tscnPath;
        if (tag === activeCameraPath) target = object;
      }
    });

    if (target && target !== camera) {
      set({ camera: target });
    }
  }, [activeCameraPath, scene, camera, set]);

  return null;
}

/** Minimal shape we touch on the OrbitControls instance for framing. */
interface OrbitLike {
  target?: THREE.Vector3;
  update?: () => void;
}

/**
 * Frame the camera so the whole scene fits the viewport. Unions the bounding
 * boxes of every rendered Mesh (skipping the empty-state grid), then pulls the
 * camera back along an isometric-ish direction far enough that the largest
 * dimension fits the vertical FOV, and re-points OrbitControls at the centre.
 * No-op for empty scenes or non-finite bounds.
 */
export function frameSceneBounds(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  controls: OrbitLike | null
): void {
  // Prefer real geometry (meshes); fall back to gizmo lines/points so
  // light- or camera-only scenes (no mesh to frame) still get framed instead
  // of leaving the default camera pointed at an empty void.
  const meshBox = new THREE.Box3();
  const gizmoBox = new THREE.Box3();
  let hasMesh = false;
  let hasGizmo = false;
  scene.traverse((obj) => {
    if (obj.userData?.tscnEmptyState) return;
    const o = obj as THREE.Mesh & { isLine?: boolean; isLineSegments?: boolean; isPoints?: boolean };
    if (!o.isMesh && !o.isLine && !o.isLineSegments && !o.isPoints) return;
    const objBox = computeWorldBoundingBox(obj, new THREE.Box3());
    if (objBox.isEmpty() || !Number.isFinite(objBox.min.x)) return;
    if (o.isMesh) {
      meshBox.union(objBox);
      hasMesh = true;
    } else {
      gizmoBox.union(objBox);
      hasGizmo = true;
    }
  });
  const box = hasMesh ? meshBox : hasGizmo ? gizmoBox : null;
  if (!box) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;

  // 2D-canvas scenes sit on ~one plane (z spread is only z_index draw steps);
  // view them straight-on (down -Z, +Y up) instead of the 3D isometric angle,
  // so sprites read flat and upright rather than tilted in perspective.
  const maxXY = Math.max(size.x, size.y);
  const isFlat = size.z <= Math.max(maxXY, 1) * 0.02;

  const persp = camera as THREE.PerspectiveCamera;
  const fov = ((persp.isPerspectiveCamera ? persp.fov : 50) * Math.PI) / 180;
  const fitDim = isFlat ? Math.max(maxXY, 0.001) : maxDim;
  const distance = ((fitDim / 2 / Math.tan(fov / 2)) || fitDim) * (isFlat ? 1.15 : 1.6);

  const dir = isFlat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0.7, 1).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(distance)));
  if (persp.isPerspectiveCamera) {
    // Keep the near plane below the framing distance so microscopic scenes
    // (e.g. a Decal authored at size 0.001) aren't clipped entirely: the 0.01
    // floor must never exceed `distance`, or the content sits inside the near
    // plane and the viewport renders black.
    persp.near = Math.min(Math.max(0.01, distance / 200), distance / 10);
    persp.far = distance * 200;
    persp.updateProjectionMatrix();
  }
  camera.lookAt(center);
  if (controls?.target) {
    controls.target.copy(center);
    controls.update?.();
  }
}

/**
 * Auto-frames the scene to the viewport on load / scene change, but ONLY in
 * free-orbit mode (never when a Camera3D is the active camera) and only during
 * a short settle window so async-loaded content (GLB, instanced scenes) is
 * captured without fighting the user's subsequent orbit.
 */
function CameraFit() {
  const hierarchy = useOptionalHierarchy();
  const control = useOptionalCameraControl();
  const get = useThree((s) => s.get);
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const hasScene = !!hierarchy?.sceneGraph;
  const activeCameraPath = control?.activeCameraPath ?? null;

  useEffect(() => {
    if (!hasScene || activeCameraPath) return undefined;
    const timers = [150, 500, 1100].map((delay) =>
      setTimeout(() => {
        const state = get();
        frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [rootKey, hasScene, activeCameraPath, get]);

  return null;
}

/** Structural shape we need from the OrbitControls instance — just `.reset()`. */
interface ResettableControls {
  reset: () => void;
}

/**
 * Takes no props — the canvas reads its sceneGraph from `HierarchyContext`
 * (the normal flow). Test code mounts `<TscnSceneContents>` directly under
 * a `HierarchyContext` provider instead.
 */
export function TscnCanvas() {
  // WI-UX-7: capture the OrbitControls instance via a callback ref so
  // the toolbar's "Reset Camera" button can call its `.reset()`. Drei's
  // `<OrbitControls>` accepts a ref typed to the upstream three-stdlib
  // type which isn't exported from this package's deps — a callback ref
  // sidesteps the type incompatibility cleanly and lets us narrow to
  // the structural `ResettableControls` shape inside the effect.
  const [controls, setControls] = useState<ResettableControls | null>(null);
  const onControlsRef = useCallback((instance: ResettableControls | null) => {
    setControls(instance);
  }, []);

  return (
    <div className={styles.root}>
      <Canvas camera={{ position: [3, 3, 3] }}>
        <TscnSceneContents />
        <ActiveCameraSwitcher />
        <CameraFit />
        <OrbitControls ref={onControlsRef} makeDefault />
        <OrbitControlsResetBridge controls={controls} />
      </Canvas>
    </div>
  );
}

/**
 * Bridges the `<OrbitControls>` instance into `CameraControlContext` so
 * the toolbar can drive `reset()` from outside the `<Canvas>`. The
 * controls instance arrives via state set by a callback ref, so this
 * component re-renders once with a non-null `controls` and its effect
 * wires up the reset handler.
 */
function OrbitControlsResetBridge({
  controls,
}: {
  controls: ResettableControls | null;
}) {
  const control = useOptionalCameraControl();
  const registerResetHandler = control?.registerResetHandler;

  useEffect(() => {
    if (!registerResetHandler || !controls) return undefined;
    return registerResetHandler(() => controls.reset());
  }, [registerResetHandler, controls]);

  return null;
}
