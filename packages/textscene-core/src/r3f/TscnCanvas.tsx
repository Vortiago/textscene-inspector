import { Canvas } from '@react-three/fiber';
import {
  lazy,
  useCallback,
  Suspense,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useSeatedRoots } from './useLiveSceneTree.js';
import { useViewShow } from './viewShow/ViewShowContext.js';
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
import { PreviewVisibilityProvider, usePreviewFrameloop } from './contexts/PreviewVisibilityContext.js';
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
import { StageRoot } from './StageRoot.js';
import { ViewShowProvider } from './viewShow/ViewShowContext.js';
import type { ViewShow } from './viewShow/viewShow.js';
import { ViewportActionsProvider, useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { LookThroughProvider, ViewCamera } from './viewCamera.js';
import { EditorViewReport } from './viewStatus/EditorViewReport.js';
import { HostSelection, type HostSelectionProps } from './hostSelection/HostSelection.js';
import { useViewStatusStore, ViewStatusScope } from './viewStatus/ViewStatusContext.js';
import { viewAnswers, type ViewAnswers } from './viewStatus/viewAnswers.js';
import { StatusChangeReporter } from './viewStatus/StatusChangeReporter.js';
import type { ViewStatus } from './viewStatus/viewStatus.js';

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

/** The 10-unit grid frames no mesh-free scene, such as a lone Path3D, and a SubViewport draws none of it. */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={GROUND_GRID_USER_DATA} />;
}

/** One object, as R3F assigns a new `userData` object on each render. */
const GROUND_GRID_USER_DATA = { tscnEmptyState: true, ...editorHelperUserData() };

/** A child component, so a change of `show` re-renders this and not the node tree. */
function ContentGroundGrid() {
  const { grid } = useViewShow();
  return grid ? <GroundGrid /> : null;
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

export interface TscnCanvasProps extends Omit<HostSelectionProps, 'children'> {
  /** The scene `openScene` gave. The entry requires it. Without it, the shell's view reads its provider. */
  scene?: Scene;
  /** `3D` by default. A change replaces the stage, so one canvas is live. */
  mode?: TscnCanvasMode;
  /** `false` draws only the frames a load, a settle or a capture needs. Without it, the host decides. */
  visible?: boolean;
  /** As `mountScene`'s `camera`. Without it, the host decides. */
  camera?: string | null;
  /** The editor helpers the 3D and 2D modes draw. A key left out has its default. */
  show?: Partial<ViewShow>;
  /** The class of the element the view fills. */
  className?: string;
  /** As `mountScene`'s `onStatusChange`. */
  onStatusChange?: ((status: ViewStatus) => void) | null;
  /** The view's `settled`, `captureImage` and `status`, as `mountScene` gives them. Props change the view. */
  ref?: Ref<ViewAnswers>;
}

export function TscnCanvas({
  scene,
  mode = '3D',
  visible,
  camera,
  selected,
  onSelect,
  show,
  className,
  onStatusChange,
  ref,
}: TscnCanvasProps) {
  const stage = (
    // The In-game mode takes no pointer, and the 2D mode picks no node yet.
    <HostSelection selected={selected} onSelect={mode === '3D' ? onSelect : undefined}>
      <PreviewVisibilityProvider isVisible={visible}>
        <ViewShowProvider show={show}>
          <ViewStatusScope>
            <ViewportActionsScope>{stageOf({ mode, camera, className })}</ViewportActionsScope>
            {ref && <ViewRef viewRef={ref} mode={mode} camera={camera} />}
            {onStatusChange && <StatusChangeReporter onStatusChange={onStatusChange} />}
          </ViewStatusScope>
        </ViewShowProvider>
      </PreviewVisibilityProvider>
    </HostSelection>
  );
  return scene ? <TscnSceneProvider scene={scene}>{stage}</TscnSceneProvider> : stage;
}

/** Hands the ref the answers of the view below the same scene. They end when the view unmounts. */
function ViewRef({ viewRef, mode, camera }: { viewRef: Ref<ViewAnswers> } & ViewRefLook) {
  const scene = useOptionalHierarchy()?.scene;
  const store = useViewStatusStore();
  const ending = useRef<AbortController | null>(null);
  const lookedThrough = useLookedThrough({ mode, camera });
  // A layout effect before the handle, so each mount's controller exists when the handle is built.
  useLayoutEffect(() => {
    const controller = new AbortController();
    ending.current = controller;
    return () => controller.abort(new Error('expected the view to settle before its unmount'));
  }, []);
  useImperativeHandle(viewRef, () => {
    if (!scene || !store) throw new Error('expected a TscnCanvas with a scene, got none');
    if (!ending.current) throw new Error('expected the view to mount before its ref, got no mount');
    return viewAnswers({ scene, store, ending: ending.current.signal, lookedThrough });
  }, [scene, store, lookedThrough]);
  return null;
}

type ViewRefLook = Required<Pick<TscnCanvasProps, 'mode'>> & Pick<TscnCanvasProps, 'camera'>;

/** An undefined `camera` keeps the look, as `update` does, so `settled` still checks that Camera3D. */
function useLookedThrough({ mode, camera }: ViewRefLook): () => string | null {
  const keptCamera = useRef<string | null>(null);
  const isLooking3D = useRef(false);
  useLayoutEffect(() => {
    if (camera !== undefined) keptCamera.current = camera;
    isLooking3D.current = mode === '3D';
  }, [mode, camera]);
  return useCallback(() => (isLooking3D.current ? keptCamera.current : null), []);
}

/** A host's own provider wins, so its panels and the `camera` prop move the same preview. */
function ViewportActionsScope({ children }: { children: ReactNode }) {
  if (useOptionalViewportActions()) return children;
  return <ViewportActionsProvider>{children}</ViewportActionsProvider>;
}

function stageOf({ mode, camera, className }: Pick<TscnCanvasProps, 'mode' | 'camera' | 'className'>) {
  if (mode === 'in-game') return <GameStage className={className} />;
  if (mode === '2D') return <Editor2DStage className={className} />;
  return <EditorCanvas className={className} camera={camera} />;
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
    <StageRoot className={className}>
      <Suspense fallback={null}>
        <Canvas2DStage
          nodes={nodes ?? rootScene?.nodes ?? []}
          internalResources={rootScene?.internalResources ?? []}
          externalResources={rootScene?.externalResources ?? []}
          editableInstances={rootScene?.editableInstances}
          scenePath={scenePath}
        />
      </Suspense>
    </StageRoot>
  );
}

function EditorCanvas({ className, camera }: Pick<TscnCanvasProps, 'camera' | 'className'>) {
  const frameloop = usePreviewFrameloop();
  return (
    <StageRoot className={className}>
      {/* Godot's editor opens every scene at the same fixed orbit, 70-degree FOV and
          clip planes (godotEditorCamera.ts). Framing is F there and opt-in here. */}
      <Canvas
        {...CANVAS_RENDERER_PROPS}
        camera={{ position: editorCameraPosition(), ...editorCameraProjection() }}
        gl={CANVAS_RENDERER_GL}
        frameloop={frameloop}
      >
        <LookThroughProvider>
          <SceneCamerasProvider>
            <TscnSceneContents />
            <ActiveCameraSwitcher />
            {camera !== undefined && <ViewCamera camera={camera} />}
          </SceneCamerasProvider>
          <CameraFit />
          <FrameSelectedShortcut />
          <GodotEditorControls />
          <EditorControlsBridge />
          <EditorViewReport />
        </LookThroughProvider>
      </Canvas>
    </StageRoot>
  );
}
