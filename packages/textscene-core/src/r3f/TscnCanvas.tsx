/**
 * `<TscnCanvas>` — the top-level React component for rendering a parsed
 * TSCN scene under react-three-fiber.
 *
 * Renders an empty canvas with default lighting when no scene is loaded.
 * Otherwise consumes `HierarchyContext.sceneGraph` and the
 * `<NodeDispatcher>` to render the scene tree; provides
 * `<SceneResourcesProvider>` so MeshInstance3D / WorldEnvironment can
 * synchronously read internal/external resources; switches the active
 * camera based on `CameraControlContext` when the user clicks "Use
 * This Camera" on a Camera3D node.
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
import styles from './TscnCanvas.module.css';

/**
 * The contents of the R3F scene (everything that would normally live
 * inside `<Canvas>`). Exported separately so `@react-three/test-renderer`
 * can mount it directly — the test renderer is the canvas substitute and
 * cannot wrap a real `<Canvas>` host.
 *
 * Reads its sceneGraph from `HierarchyContext`. Falls back to the empty
 * default-lighting scene when no provider is mounted (matches the
 * empty-canvas baseline test).
 */
export function TscnSceneContents() {
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const nodes = rootScene?.nodes ?? null;
  // Gap 8: show a grid + prompt when nothing has loaded.
  // Without this the canvas is a black void and indistinguishable from
  // a renderer crash. The grid also gives the orbit controls a tangible
  // surface so the initial-camera framing feels intentional.
  const isEmpty = nodes === null || nodes.length === 0;

  return (
    <>
      {/* Godot's editor preview sun and preview environment, each mounted only
          while the scene supplies no DirectionalLight3D / WorldEnvironment of
          its own (ADR-0025). At runtime Godot adds neither — an editor's job is
          to show you your scene, so this previewer takes the editor's rule. */}
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
      <SelectionHighlight />
      <HoverHighlight />
    </>
  );
}

/**
 * The one ground-plane grid styling, shared by the empty-scene indicator
 * and the opt-in content grid so the two can never drift apart.
 *
 * Self-tagged `tscnEmptyState` — the SAME sentinel `frameSceneBounds` already
 * skips — directly on the `<gridHelper>` rather than relying on a wrapping
 * `<group>`'s tag: `THREE.Object3D.traverse()` always recurses into every
 * descendant regardless of what the visitor callback does with an ancestor,
 * so a tag on a wrapping group does NOT exclude the group's children from
 * `frameSceneBounds`'s traversal. Tagging the grid itself instead is correct
 * for both call sites and needs no ancestor walk: without it, the fixed
 * 10-unit grid — reachable via `ContentGroundGrid` in any non-empty,
 * mesh-free scene (e.g. a lone Path3D) with the Grid toggle on — would
 * dominate `frameSceneBounds`'s gizmo-fallback bounding box and zoom the
 * camera out to frame the grid instead of the actual (possibly tiny) content.
 */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={{ tscnEmptyState: true }} />;
}

/**
 * An OPT-IN ground-plane grid for a non-empty scene, off by default
 * (see ViewportModeContext's doc comment for why). The empty-scene indicator
 * already draws its own grid unconditionally, so this one only adds a SECOND
 * grid when there's actual content to reference it against. A child
 * component (not a read in `TscnSceneContents`) so a toolbar toggle of ANY
 * viewport flag re-renders just this, never the whole dispatched node tree.
 */
function ContentGroundGrid() {
  const { showGrid } = useViewportMode();
  return showGrid ? <GroundGrid /> : null;
}

function EmptySceneIndicator() {
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
 * Switches the canvas's active camera based on `CameraControlContext`.
 * Mounted inside the `<Canvas>` so it has access to `useThree`. When the
 * user picks a Camera3D node and clicks "Use This Camera", we find a
 * THREE.Camera in the scene at that node path and call `state.set` to
 * make it the active render camera; "Reset" returns to the default
 * orbit camera.
 */
/**
 * A three camera identified by its own runtime flags rather than `instanceof`,
 * so detection survives a second copy of three being loaded (e.g. the test
 * renderer). `aspect`/`updateProjectionMatrix` exist only on the perspective
 * camera; both are optional here.
 */
type CameraLike = THREE.Camera & {
  isPerspectiveCamera?: boolean;
  isOrthographicCamera?: boolean;
  aspect?: number;
  updateProjectionMatrix?: () => void;
};

export function ActiveCameraSwitcher() {
  const control = useOptionalCameraControl();
  const activeCameraPath = control?.activeCameraPath ?? null;
  const hierarchy = useOptionalHierarchy();
  // Re-run when the scene loads: a deep-linked (`?camera=`) path is set on the
  // provider BEFORE any Camera3D has mounted, so the first pass finds nothing;
  // the newly loaded scene's Camera3D only becomes discoverable once its own
  // effect has tagged it, which this dependency waits for.
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  // Distinguish an INTENTIONAL activation from an incidental effect re-run.
  const prevPathRef = useRef<string | null>(activeCameraPath);
  const seedConsumedRef = useRef(false);

  useEffect(() => {
    const pathChanged = prevPathRef.current !== activeCameraPath;
    prevPathRef.current = activeCameraPath;
    if (!activeCameraPath) {
      // Free-orbit: restore the default perspective camera. R3F sets one
      // up automatically; we just need to ensure it's the active one.
      // The default camera is preserved in `state.previousCamera` after
      // we swap, but R3F doesn't expose that cleanly — instead we look
      // for any THREE.PerspectiveCamera the user didn't add via a node.
      return;
    }

    // Find a camera whose userData carries our node-path tag (set by
    // Camera3D below when ActiveCameraSwitcher is active). Match on three's own
    // `.isPerspectiveCamera`/`.isOrthographicCamera` flags rather than
    // `instanceof` (the pattern frameSceneBounds already uses): the flags are
    // set on the prototype, so they hold even when a second copy of three is
    // loaded — e.g. under the test renderer — where `instanceof` would miss.
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
    // A node camera is authored with a fixed placeholder aspect (16/9) because
    // at mount it cannot know the canvas size. R3F only re-syncs a camera's
    // aspect on a resize event, so an activated scene camera would render
    // horizontally stretched on a fixed-size (headless) canvas that never
    // resizes. Match it to the live canvas here, as R3F does for the default
    // camera — otherwise it distorts. Safe to run on every re-render (resize
    // included), so it stays outside the activation gate below.
    const persp = target as THREE.PerspectiveCamera | null;
    if (persp?.isPerspectiveCamera && size.height > 0) {
      const aspect = size.width / size.height;
      if (persp.aspect !== aspect) {
        persp.aspect = aspect;
        persp.updateProjectionMatrix();
      }
    }

    // Only SWAP the render camera on an intentional activation: an explicit pick
    // (activeCameraPath just changed) or the one-shot deep-link seed taking effect
    // on its initial scene. A later scene-switch re-runs this effect via `rootKey`
    // with a possibly-stale, identically-named path (e.g. two scenes each with a
    // root `Camera3D`) before SceneChangeResetter clears it — swapping then would
    // hijack the new scene instead of letting it open in free orbit. The same gate
    // stops a `camera`-dep re-run from undoing a Reset-Camera that swapped away.
    const shouldActivate = pathChanged || !seedConsumedRef.current;
    seedConsumedRef.current = true;
    if (shouldActivate && target !== camera) {
      set({ camera: target });
    }
  }, [activeCameraPath, rootKey, scene, camera, set, size]);

  return null;
}

/**
 * Frames the scene to the viewport on load / scene change — but only when the
 * user has asked for it (`frameOnOpen`, off by default: Godot's editor opens at
 * a fixed orbit and leaves framing to F). Free-orbit mode only, never when a
 * Camera3D is the active camera, and only during a short settle window so
 * async-loaded content (GLB, instanced scenes) is captured without fighting the
 * user's subsequent orbit.
 *
 * Selection changes NEVER move the camera: framing is deliberately not keyed
 * on selection state (design decision: an unrequested camera move on click is
 * worse than a selection-gated gizmo extending past the current frame; the
 * user re-frames explicitly via FrameSelectedShortcut). The visual-regression
 * harness gets deterministic `-selected` captures by clicking only after these
 * load-time timers have all fired (scripts/visual/run.mjs).
 *
 * Exported for unit testing — it is an internal canvas component that must
 * remain mounted inside `<Canvas>` (needs `useThree`).
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

    // The camera position this component last set. A settle-fit compares
    // against it and stands down when it does not match, which is how the
    // user's own orbit wins without an interaction signal to subscribe to.
    let lastSet: THREE.Vector3 | null = null;
    const fit = () => {
      const state = get();
      frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      lastSet = state.camera.position.clone();
    };

    const timers = [150, 500, 1100].map((delay) => setTimeout(fit, delay));

    // Those timers only GUESS when async content has arrived; the loader
    // knows. Fitting once more the moment nothing is pending is what lets a
    // scene of large external `.tres` meshes frame its whole geometry rather
    // than whatever happened to be decoded at 1.1s.
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

/**
 * `<TscnCanvas>` takes no props — it reads everything it needs from context
 * (`HierarchyContext`, `CameraControlContext`, `ViewportModeContext`). Test
 * code that wants to pass nodes directly mounts `<TscnSceneContents>`
 * directly under a `HierarchyContext` provider instead.
 */
export function TscnCanvas() {
  return (
    <div className={styles.root}>
      {/* `shadows` turns three.js's shadow map on for the whole scene. Without
          it every light slice's `castShadow` / `shadow-bias` / `shadow-camera-*`
          wiring is inert and a `shadow_enabled = true` light casts nothing —
          which is what Godot's own light fixtures exist to show. PCFSoft is the
          closest cheap match to Godot's soft shadows. */}
      {/* Godot's editor opens every scene at the same fixed orbit and the same
          70-degree FOV, whatever is in it (godotEditorCamera.ts). Framing is a
          deliberate act there — F — and an opt-in setting here. */}
      <Canvas
        camera={{ position: editorCameraPosition(), fov: EDITOR_CAMERA_FOV }}
        shadows="soft"
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
 * Bridges the navigation handle into `CameraControlContext` so the toolbar can
 * drive `reset()` from outside the `<Canvas>`. `<GodotEditorControls>`
 * publishes the handle as R3F's `state.controls` (the same slot
 * `frameSceneBounds` reads), so this reads it back from there rather than
 * threading a ref through the tree.
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
 * Bridges the WebGLRenderer into `CameraControlContext` so the toolbar's
 * screenshot button can capture a frame from outside the `<Canvas>`.
 * Forces an explicit render right before reading the buffer back: WebGL only
 * clears the drawing buffer when the browser COMPOSITES (i.e. after the
 * current task returns to the event loop), so a same-task render + toDataURL
 * reliably reads the fresh frame — without needing `preserveDrawingBuffer`,
 * which would tax every rendered frame with a buffer copy just to serve this
 * occasional button. The render also guarantees the buffer reflects the
 * CURRENT camera/scene state rather than whatever the last scheduled frame
 * happened to be.
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
