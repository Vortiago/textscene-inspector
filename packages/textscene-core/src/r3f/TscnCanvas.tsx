/**
 * `<TscnCanvas>` renders the parsed scene in `HierarchyContext` under
 * react-three-fiber, with its resources in scope and the camera the user picks.
 * With no scene loaded, it renders an empty canvas with default lighting.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useContext, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { ResourceLoaderContext } from '../resources/ResourceLoaderContext.js';
import { useOptionalCameraControl } from './contexts/CameraControlContext.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { HoverHighlight } from './components/HoverHighlight.js';
import { InternalTextLabel } from './internalTextLabel.js';
import { FrameSelectedShortcut } from './FrameSelectedShortcut.js';
import { EditorControlsHandle, GodotEditorControls } from './GodotEditorControls.js';
import { PreviewLighting } from './preview/PreviewLighting.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';
import { EDITOR_CAMERA_FOV, editorCameraPosition } from './godotEditorCamera.js';
import { ViewportPassOrchestrator } from './contexts/ViewportPassRegistryContext.js';
import { ControlRasterLayer } from '../nodes/viewport/subviewport/ControlRasterLayer.js';
import styles from './TscnCanvas.module.css';

/**
 * The contents of the `<Canvas>`, exported so `@react-three/test-renderer`,
 * which cannot wrap a real `<Canvas>`, can mount it. With no `HierarchyContext`
 * provider it renders the empty default-lighting scene.
 */
export function TscnSceneContents() {
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const nodes = rootScene?.nodes ?? null;
  // A grid and a prompt, since an empty black canvas looks like a renderer crash.
  const isEmpty = nodes === null || nodes.length === 0;

  return (
    <>
      {/* Godot's editor preview sun and environment, each mounted only while the
          scene has no DirectionalLight3D or WorldEnvironment of its own (ADR-0025).
          Godot adds neither at runtime. This previewer takes the editor's rule. */}
      <PreviewLighting />
      {isEmpty && <EmptySceneIndicator />}
      {!isEmpty && <ContentGroundGrid />}
      {nodes && rootScene && (
        <SceneResourcesProvider
          internalResources={rootScene.internalResources}
          externalResources={rootScene.externalResources}
        >
          <NodeDispatcher nodes={nodes} />
        </SceneResourcesProvider>
      )}
      <ControlRasterLayer
        nodes={nodes ?? []}
        internalResources={rootScene?.internalResources ?? []}
        externalResources={rootScene?.externalResources ?? []}
      />
      <ViewportPassOrchestrator />
      <SelectionHighlight />
      <HoverHighlight />
    </>
  );
}

/**
 * The ground-plane grid shared by the empty-scene indicator and the content grid.
 * It carries the `tscnEmptyState` tag `frameSceneBounds` skips on itself:
 * `traverse()` visits every descendant whatever the tag of an ancestor, and the
 * 10-unit grid would otherwise frame a mesh-free scene, such as a lone Path3D.
 */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={{ tscnEmptyState: true }} />;
}

/**
 * The opt-in grid for a non-empty scene, off by default (see ViewportModeContext).
 * A child component, so a toolbar toggle re-renders this and not the node tree.
 */
function ContentGroundGrid() {
  const { showGrid } = useViewportMode();
  return showGrid ? <GroundGrid /> : null;
}

function EmptySceneIndicator() {
  // paint-order-safe: the empty-scene indicator, mounted where no scene and
  // so no canvas item exists.
  return (
    <group userData={{ tscnEmptyState: true }}>
      <GroundGrid />
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
 * A three camera identified by its own flags, not `instanceof`, so detection
 * survives a second copy of three, such as the test renderer's.
 */
type CameraLike = THREE.Camera & {
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
  aspect?: number;
  updateProjectionMatrix?: () => void;
};

/**
 * Makes the Camera3D the user picks with "Use This Camera" the active render
 * camera. "Reset" returns to the default orbit camera.
 */
export function ActiveCameraSwitcher() {
  const control = useOptionalCameraControl();
  const activeCameraPath = control?.activeCameraPath ?? null;
  const hierarchy = useOptionalHierarchy();
  // Re-run when the scene loads: a deep-linked (`?camera=`) path is set before
  // any Camera3D has mounted and tagged itself, so the first pass finds nothing.
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  // Tells an intentional activation from an incidental effect re-run.
  const prevPathRef = useRef<string | null>(activeCameraPath);
  const seedConsumedRef = useRef(false);

  useEffect(() => {
    const pathChanged = prevPathRef.current !== activeCameraPath;
    prevPathRef.current = activeCameraPath;
    if (!activeCameraPath) {
      return;
    }

    // Camera3D tags its camera's userData with its node path.
    const cameras: (THREE.PerspectiveCamera | THREE.OrthographicCamera)[] = [];
    scene.traverse((object) => {
      const cam = object as CameraLike;
      if (cam.isPerspectiveCamera || cam.isOrthographicCamera) {
        cameras.push(object as THREE.PerspectiveCamera | THREE.OrthographicCamera);
      }
    });
    const target =
      cameras.find(
        (c) => (c.userData as { tscnPath?: string }).tscnPath === activeCameraPath
      ) ?? null;
    if (!target) return;
    // Matched to the live canvas: a node camera mounts with a placeholder 16/9
    // aspect, and R3F re-syncs it only on a resize, which a fixed-size headless
    // canvas never fires. It runs on every re-render, outside the activation gate.
    const persp = target as THREE.PerspectiveCamera | null;
    if (persp?.isPerspectiveCamera && size.height > 0) {
      const aspect = size.width / size.height;
      if (persp.aspect !== aspect) {
        persp.aspect = aspect;
        persp.updateProjectionMatrix();
      }
    }

    // Swap only on a pick or the one-shot deep-link seed. A scene switch re-runs
    // this with a stale path that may name a camera in the new scene, before
    // SceneChangeResetter clears it. The gate also keeps a `camera` re-run from
    // undoing a Reset Camera.
    const shouldActivate = pathChanged || !seedConsumedRef.current;
    seedConsumedRef.current = true;
    if (shouldActivate && target !== camera) {
      set({ camera: target });
    }
  }, [activeCameraPath, rootKey, scene, camera, set, size]);

  return null;
}

/**
 * Frames the scene on load when `frameOnOpen` is on, in free orbit only. It is
 * off by default, since Godot's editor opens at a fixed orbit and leaves framing
 * to F. A short settle window catches async content without fighting the orbit.
 * A selection never moves the camera: FrameSelectedShortcut re-frames on request.
 */
export function CameraFit() {
  const hierarchy = useOptionalHierarchy();
  const control = useOptionalCameraControl();
  const { frameOnOpen } = useViewportMode();
  const get = useThree((s) => s.get);
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const hasScene = !!hierarchy?.sceneGraph;
  const activeCameraPath = control?.activeCameraPath ?? null;

  const loader = useContext(ResourceLoaderContext);

  useEffect(() => {
    if (!frameOnOpen || !hasScene || activeCameraPath) return undefined;

    // The settle-fit stands down when the camera has left this position, so
    // the user's own orbit wins.
    let lastSet: THREE.Vector3 | null = null;
    const fit = () => {
      const state = get();
      frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      lastSet = state.camera.position.clone();
    };

    // The visual harness clicks for a `-selected` capture only after the last timer.
    const timers = [150, 500, 1100].map((delay) => setTimeout(fit, delay));

    // The timers guess when async content has arrived. The loader knows, so
    // one more fit when nothing is pending frames large external meshes whole.
    let settled = false;
    const unsubscribe = loader?.subscribePending(() => {
      if (settled || loader.pendingResourceCount > 0) return;
      settled = true;
      if (lastSet && !get().camera.position.equals(lastSet)) return;
      fit();
    });

    return () => {
      timers.forEach(clearTimeout);
      unsubscribe?.();
    };
  }, [rootKey, hasScene, activeCameraPath, frameOnOpen, get, loader]);

  return null;
}

/** Reads everything from context. A test mounts `<TscnSceneContents>` instead. */
export function TscnCanvas() {
  return (
    <div className={styles.root}>
      {/* Without `shadows`, a `shadow_enabled = true` light casts nothing. PCFSoft
          is the closest cheap match to Godot's soft shadows. */}
      {/* Godot's editor opens every scene at the same fixed orbit and 70-degree
          FOV (godotEditorCamera.ts). Framing is F there and opt-in here. */}
      {/* Without `localClippingEnabled`, three ignores a `clippingPlanes` array.
          A Control-only SubViewport sampled by a 3D scene draws through this
          renderer, so its ScrollContainer clips only because the flag is set here
          as well as on the 2D world canvas. */}
      <Canvas
        camera={{ position: editorCameraPosition(), fov: EDITOR_CAMERA_FOV }}
        shadows="soft"
        gl={{ localClippingEnabled: true }}
      >
        <TscnSceneContents />
        <ActiveCameraSwitcher />
        <CameraFit />
        <FrameSelectedShortcut />
        <GodotEditorControls />
        <EditorControlsResetBridge />
        <ScreenshotBridge />
      </Canvas>
    </div>
  );
}

/**
 * Hands the navigation handle to `CameraControlContext`, so the toolbar can call
 * `reset()` from outside the `<Canvas>`. `<GodotEditorControls>` publishes it
 * as R3F's `state.controls`.
 */
function EditorControlsResetBridge() {
  const control = useOptionalCameraControl();
  const registerResetHandler = control?.registerResetHandler;
  const published = useThree((s) => s.controls);
  const controls = published instanceof EditorControlsHandle ? published : null;

  useEffect(() => {
    if (!registerResetHandler || !controls) return undefined;
    return registerResetHandler(() => controls.reset());
  }, [registerResetHandler, controls]);

  return null;
}

/**
 * Hands the renderer to `CameraControlContext` for the toolbar's screenshot.
 * It renders and reads back in the same task: WebGL clears the buffer only when
 * the browser composites. `preserveDrawingBuffer` would copy the buffer every frame.
 */
function ScreenshotBridge() {
  const control = useOptionalCameraControl();
  const registerScreenshotHandler = control?.registerScreenshotHandler;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!registerScreenshotHandler) return undefined;
    return registerScreenshotHandler(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
  }, [registerScreenshotHandler, gl, scene, camera]);

  return null;
}
