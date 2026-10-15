/**
 * `<TscnCanvas>` renders the parsed scene in `HierarchyContext` under
 * react-three-fiber, with its resources in scope and the camera the user picks.
 * With no scene loaded, it renders an empty canvas with default lighting.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { HoverHighlight } from './components/HoverHighlight.js';
import { InternalTextLabel } from './internalTextLabel.js';
import { FrameSelectedShortcut } from './FrameSelectedShortcut.js';
import { EditorControlsHandle, GodotEditorControls } from './GodotEditorControls.js';
import { WorldEnvironmentScope } from './environment/WorldEnvironmentScope.js';
import { EDITOR_CAMERA_FOV, editorCameraPosition } from './godotEditorCamera.js';
import { ViewportPassOrchestrator } from './contexts/ViewportPassRegistryContext.js';
import { ControlRasterLayer } from '../nodes/viewport/subviewport/ControlRasterLayer.js';
import { installShaderPatches } from './shaderPatch/installShaderPatches.js';
import { SceneShadowFitter } from './SceneShadowFitter.js';
import { SceneDepthPrepass } from './depthPrepass/SceneDepthPrepass.js';
import { ScreenshotBridge } from './ScreenshotBridge.js';
import { TiledUploadDriver } from './tiledUpload/TiledUploadDriver.js';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher.js';
import { CameraFit } from './CameraFit.js';
import { SharedTextureRelease } from './sharedTextures.js';
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
    <TiledUploadDriver>
      {/* The root world's Environment, and Godot's editor preview sun and environment, each
          preview mounted only while the scene has no DirectionalLight3D or WorldEnvironment of
          its own (ADR-0025). Godot adds neither at runtime. This previewer takes the editor's rule. */}
      <WorldEnvironmentScope world="root">
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
        <SceneShadowFitter />
        <SceneDepthPrepass />
        <SelectionHighlight />
        <HoverHighlight />
        <ScreenshotBridge />
      </WorldEnvironmentScope>
    </TiledUploadDriver>
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

/** Reads everything from context. A test mounts `<TscnSceneContents>` instead. */
export function TscnCanvas() {
  return (
    <div className={styles.root}>
      {/* Without `shadows`, a `shadow_enabled = true` light casts nothing. `percentage`
          selects `THREE.PCFShadowMap`, the soft-shadow type three 0.186 draws. `soft`
          selects the removed `PCFSoftShadowMap`, which three falls back from with a warning. */}
      {/* Godot's editor opens every scene at the same fixed orbit and 70-degree
          FOV (godotEditorCamera.ts). Framing is F there and opt-in here. */}
      {/* Without `localClippingEnabled`, three ignores a `clippingPlanes` array.
          A Control-only SubViewport sampled by a 3D scene draws through this
          renderer, so its ScrollContainer clips only because the flag is set here
          as well as on the 2D world canvas. */}
      {/* `antialias: false`: Godot's `msaa_3d` defaults to Disabled (`rendering_server.cpp:3774`).
          A project that turns it on gets the compositor's multisampled buffer, which resolves
          before the tone curve as Godot's does. `flat`: a root with no Environment tonemaps LINEAR
          (`tone_mapper.h:177`), where R3F would apply ACES. */}
      <Canvas
        camera={{ position: editorCameraPosition(), fov: EDITOR_CAMERA_FOV }}
        shadows="percentage"
        gl={{ localClippingEnabled: true, antialias: false }}
        flat
        onCreated={installShaderPatches}
      >
        <SharedTextureRelease />
        <TscnSceneContents />
        <ActiveCameraSwitcher />
        <CameraFit />
        <FrameSelectedShortcut />
        <GodotEditorControls />
        <EditorControlsResetBridge />
      </Canvas>
    </div>
  );
}

/**
 * Hands the navigation handle to `ViewportActionsContext`, so the toolbar can call
 * `reset()` from outside the `<Canvas>`. `<GodotEditorControls>` publishes it
 * as R3F's `state.controls`.
 */
function EditorControlsResetBridge() {
  const control = useOptionalViewportActions();
  const registerResetHandler = control?.registerResetHandler;
  const published = useThree((s) => s.controls);
  const controls = published instanceof EditorControlsHandle ? published : null;

  useEffect(() => {
    if (!registerResetHandler || !controls) return undefined;
    return registerResetHandler(() => controls.reset());
  }, [registerResetHandler, controls]);

  return null;
}
