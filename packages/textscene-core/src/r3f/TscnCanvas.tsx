import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useSeatedRoots } from './useLiveSceneTree.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { EditedRootProvider } from './contexts/InstanceOwnersContext.js';
import { NodeDispatcher } from './NodeDispatcher.js';
import { SelectionHighlight } from './components/SelectionHighlight.js';
import { HoverHighlight } from './components/HoverHighlight.js';
import { PendingSuspense } from '../resources/PendingSuspense.js';
import { editorHelperUserData } from './editorHelpers.js';
import { FrameSelectedShortcut } from './FrameSelectedShortcut.js';
import { EditorControlsBridge } from './EditorControlsBridge.js';
import { GodotEditorControls } from './GodotEditorControls.js';
import { WorldEnvironmentScope } from './environment/WorldEnvironmentScope.js';
import { editorCameraPosition, editorCameraProjection } from './godotEditorCamera.js';
import { usePreviewFrameloop } from './contexts/PreviewVisibilityContext.js';
import { ControlRasterLayer } from '../nodes/viewport/subviewport/ControlRasterLayer.js';
import { SceneShadowFitter } from './SceneShadowFitter.js';
import { SceneDepthPrepass } from './depthPrepass/SceneDepthPrepass.js';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher.js';
import { CameraFit } from './CameraFit.js';
import { SceneCamerasProvider } from './sceneCameras.js';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from './canvasRenderer/canvasRendererProps.js';
import { CanvasRendererScope } from './canvasRenderer/CanvasRendererScope.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import { DEFAULT_ROOT_SCENE_PATH, type Scene } from '../scene/openScene.js';
import type { ViewportMode } from './contexts/ViewportModeContext.js';
import { rootClassName } from './stageClassName.js';

// Lazy, so the glyph engine and the parse of the prompt load only for an empty canvas.
const EmptyScenePrompt = lazy(() => import('./emptyScenePrompt.js'));

/**
 * The contents of the `<Canvas>`, exported so `@react-three/test-renderer`,
 * which cannot wrap a real `<Canvas>`, can mount it. With no `HierarchyContext`
 * provider it renders the empty default-lighting scene.
 */
export function TscnSceneContents() {
  const { rootScene, nodes } = useRootScene();
  // A grid and a prompt, since an empty black canvas looks like a renderer crash.
  const isEmpty = nodes === null || nodes.length === 0;

  return (
    <CanvasRendererScope>
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
            <EditedRootProvider editableInstances={rootScene.editableInstances}>
              <NodeDispatcher nodes={nodes} />
            </EditedRootProvider>
          </SceneResourcesProvider>
        )}
        <ControlRasterLayer
          nodes={nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
        />
        <SceneShadowFitter />
        <SceneDepthPrepass />
        <SelectionHighlight />
        <HoverHighlight />
      </WorldEnvironmentScope>
    </CanvasRendererScope>
  );
}

/** The root scene of the scene the view reads, and its seated roots: null before the scene loads. */
function useRootScene() {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  return { rootScene, nodes: useSeatedRoots() ?? null };
}

/**
 * The ground-plane grid shared by the empty-scene indicator and the content grid.
 * It carries the `tscnEmptyState` tag `frameSceneBounds` skips on itself:
 * `traverse()` visits every descendant whatever the tag of an ancestor, and the
 * 10-unit grid would otherwise frame a mesh-free scene, such as a lone Path3D.
 * It is editor chrome too, so a SubViewport pass draws none of it.
 */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={GROUND_GRID_USER_DATA} />;
}

/** One object, as R3F assigns a new `userData` object on each render. */
const GROUND_GRID_USER_DATA = { tscnEmptyState: true, ...editorHelperUserData() };

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
      <PendingSuspense>
        <EmptyScenePrompt />
      </PendingSuspense>
    </group>
  );
}

const GameView = lazy(() => import('./gameView/GameView.js').then((m) => ({ default: m.GameView })));
const Canvas2DStage = lazy(() =>
  import('./components/Canvas2DStage/Canvas2DStage.js').then((m) => ({ default: m.Canvas2DStage }))
);

/** `in-game` draws the game's start with no script run, `3D` and `2D` the editor's views. */
export type TscnCanvasMode = ViewportMode;

export interface TscnCanvasProps {
  /** The scene `openScene` gave. Without it, the view reads the `<TscnSceneProvider>` above it. */
  scene?: Scene;
  /** `3D` by default. A change replaces the stage, so one canvas is live. */
  mode?: TscnCanvasMode;
  /** The class of the element the view fills. */
  className?: string;
}

export function TscnCanvas({ scene, mode = '3D', className }: TscnCanvasProps) {
  const stage = stageOf(mode, className);
  return scene ? <TscnSceneProvider scene={scene}>{stage}</TscnSceneProvider> : stage;
}

function stageOf(mode: TscnCanvasMode, className: string | undefined) {
  if (mode === 'in-game') return <GameStage className={className} />;
  if (mode === '2D') return <Editor2DStage className={className} />;
  return <EditorCanvas className={className} />;
}

// The game and 2D stages load on demand, so a host that never shows one keeps it out of its first chunk.
function GameStage({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <GameView className={className} />
    </Suspense>
  );
}

/** The root scene as the editor's 2D view lays it out, over the scene the view reads. */
function Editor2DStage({ className }: { className?: string }) {
  const { rootScene, nodes } = useRootScene();
  const scenePath = useOptionalHierarchy()?.scene?.rootScenePath ?? DEFAULT_ROOT_SCENE_PATH;
  return (
    <div className={rootClassName(className)}>
      <Suspense fallback={null}>
        <Canvas2DStage
          nodes={nodes ?? rootScene?.nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
          editableInstances={rootScene?.editableInstances}
          scenePath={scenePath}
        />
      </Suspense>
    </div>
  );
}

function EditorCanvas({ className }: { className?: string }) {
  const frameloop = usePreviewFrameloop();
  return (
    <div className={rootClassName(className)}>
      {/* Godot's editor opens every scene at the same fixed orbit, 70-degree FOV and
          clip planes (godotEditorCamera.ts). Framing is F there and opt-in here. */}
      <Canvas
        {...CANVAS_RENDERER_PROPS}
        camera={{ position: editorCameraPosition(), ...editorCameraProjection() }}
        gl={CANVAS_RENDERER_GL}
        frameloop={frameloop}
      >
        <SceneCamerasProvider>
          <TscnSceneContents />
          <ActiveCameraSwitcher />
        </SceneCamerasProvider>
        <CameraFit />
        <FrameSelectedShortcut />
        <GodotEditorControls />
        <EditorControlsBridge />
      </Canvas>
    </div>
  );
}
