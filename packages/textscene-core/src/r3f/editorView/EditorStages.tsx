import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { usePreviewFrameloop } from '../contexts/PreviewVisibilityContext.js';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from '../canvasRenderer/canvasRendererProps.js';
import { DEFAULT_ROOT_SCENE_PATH } from '../../scene/openScene.js';
import { StageRoot } from '../StageRoot.js';
import { SceneCamerasProvider } from '../sceneCameras.js';
import { LookThroughProvider, ViewCamera } from '../viewCamera.js';
import { CanvasViewReport } from '../viewStatus/CanvasViewReport.js';
import { TscnSceneContents } from '../SceneContents.js';
import { useRootScene } from '../hooks/useRootScene.js';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher.js';
import { EditorControlsBridge } from './EditorControlsBridge.js';
import { EditorGround } from './EditorGround.js';
import { FocusShortcuts } from './FocusShortcuts.js';
import { FreelookProvider } from './FreelookContext.js';
import { FreelookSpeedReadout } from './FreelookSpeedReadout/FreelookSpeedReadout.js';
import { GodotEditorControls } from './GodotEditorControls.js';
import { editorCameraPosition, editorCameraProjection } from './godotEditorCamera.js';

// The 2D stage loads on demand, so a host that never shows it keeps it out of its first chunk.
const Canvas2DStage = lazy(() =>
  import('./Canvas2DStage/Canvas2DStage.js').then((m) => ({ default: m.Canvas2DStage }))
);

// One array for every render: a new one each render would re-render the memoised world canvas.
const NO_ENTRIES: readonly never[] = [];

/** The root scene as the editor's 2D view lays it out, over the scene the view reads. */
export function Editor2DStage({ className }: { className?: string }) {
  const { rootScene, nodes } = useRootScene();
  const scenePath = useOptionalHierarchy()?.scene?.rootScenePath ?? DEFAULT_ROOT_SCENE_PATH;
  return (
    <StageRoot className={className}>
      <Suspense fallback={null}>
        <Canvas2DStage
          nodes={nodes ?? rootScene?.nodes ?? NO_ENTRIES}
          internalResources={rootScene?.internalResources ?? NO_ENTRIES}
          externalResources={rootScene?.externalResources ?? NO_ENTRIES}
          editableInstances={rootScene?.editableInstances}
          scenePath={scenePath}
        />
      </Suspense>
    </StageRoot>
  );
}

/** The 3D mode's stage: the scene through the editor camera, with Godot's navigation and keys. */
export function EditorCanvas({ className, camera }: { className?: string; camera?: string | null }) {
  const frameloop = usePreviewFrameloop();
  return (
    <StageRoot className={className}>
      <FreelookProvider>
        {/* Godot's fixed opening orbit, FOV and clip planes. Framing is F there, and a host's call here. */}
        <Canvas
          {...CANVAS_RENDERER_PROPS}
          camera={{ position: editorCameraPosition(), ...editorCameraProjection() }}
          gl={CANVAS_RENDERER_GL}
          frameloop={frameloop}
        >
          <LookThroughProvider>
            <SceneCamerasProvider>
              <TscnSceneContents>
                <EditorGround />
              </TscnSceneContents>
              <ActiveCameraSwitcher />
              {camera !== undefined && <ViewCamera camera={camera} />}
            </SceneCamerasProvider>
            <FocusShortcuts />
            <GodotEditorControls />
            <EditorControlsBridge />
            <CanvasViewReport />
          </LookThroughProvider>
        </Canvas>
        <FreelookSpeedReadout />
      </FreelookProvider>
    </StageRoot>
  );
}
