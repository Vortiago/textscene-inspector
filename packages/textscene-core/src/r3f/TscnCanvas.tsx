import {
  lazy,
  useCallback,
  Suspense,
  useImperativeHandle,
  useLayoutEffect,
  memo,
  useRef,
  type Ref,
} from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { PreviewVisibilityProvider } from './contexts/PreviewVisibilityContext.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import type { Scene } from '../scene/openScene.js';
import type { ViewportMode } from './contexts/ViewportModeContext.js';
import { ViewShowProvider } from './viewShow/ViewShowContext.js';
import type { ViewShow } from './viewShow/viewShow.js';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext.js';
import { HostSelection, type HostSelectionProps } from './hostSelection/HostSelection.js';
import { useViewStatusStore, ViewStatusScope } from './viewStatus/ViewStatusContext.js';
import { viewAnswers, type ViewAnswers } from './viewStatus/viewAnswers.js';
import { StatusChangeReporter } from './viewStatus/StatusChangeReporter.js';
import type { ViewStatus } from './viewStatus/viewStatus.js';
import { withEditorCamera, type EditorViewAnswers } from './editorView/editorCamera/editorCameras.js';
import { EditorCamerasScope, useEditorCameras } from './editorView/editorCamera/EditorCamerasContext.js';
import { Editor2DStage, EditorCanvas } from './editorView/EditorStages.js';

/** What a `TscnCanvas` ref gives: the answers of `mountScene`'s view but `update` and `dispose`. */
export type CanvasView = ViewAnswers & EditorViewAnswers;

const GameView = lazy(() => import('./gameView/GameView.js').then((m) => ({ default: m.GameView })));

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
  /** The view's answers, as `mountScene` gives them. Props change the view. */
  ref?: Ref<CanvasView>;
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
  const view = (
    <View
      visible={visible}
      show={show}
      mode={mode}
      camera={camera}
      className={className}
      viewRef={ref}
      onStatusChange={onStatusChange}
    />
  );
  const stage = (
    // The In-game mode takes no pointer, and the 2D mode picks no node yet.
    <HostSelection selected={selected} onSelect={mode === '3D' ? onSelect : undefined}>
      {view}
    </HostSelection>
  );
  return scene ? <TscnSceneProvider scene={scene}>{stage}</TscnSceneProvider> : stage;
}

type ViewProps = Pick<
  TscnCanvasProps,
  'visible' | 'show' | 'mode' | 'camera' | 'className' | 'onStatusChange'
> & {
  viewRef?: Ref<CanvasView>;
};

// A memo: the previewer gives a new `selected` per hovered row, which renders the selection alone.
const View = memo(function View({
  visible,
  show,
  mode = '3D',
  camera,
  className,
  viewRef,
  onStatusChange,
}: ViewProps) {
  return (
    <PreviewVisibilityProvider isVisible={visible}>
      <ViewShowProvider show={show}>
        <ViewStatusScope>
          <EditorCamerasScope>
            <ViewportActionsProvider>{stageOf({ mode, camera, className })}</ViewportActionsProvider>
            {viewRef && <ViewRef viewRef={viewRef} mode={mode} camera={camera} />}
            {onStatusChange && <StatusChangeReporter onStatusChange={onStatusChange} />}
          </EditorCamerasScope>
        </ViewStatusScope>
      </ViewShowProvider>
    </PreviewVisibilityProvider>
  );
});

/** Hands the ref the answers of the view below the same scene. They end when the view unmounts. */
function ViewRef({ viewRef, mode, camera }: { viewRef: Ref<CanvasView> } & ViewRefLook) {
  const scene = useOptionalHierarchy()?.scene;
  const store = useViewStatusStore();
  const cameras = useEditorCameras();
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
    if (!cameras) throw new Error('expected a TscnCanvas with editor cameras, got none');
    if (!ending.current) throw new Error('expected the view to mount before its ref, got no mount');
    // A new handle per mode, so a holder renders again with the camera the mode draws through.
    const drawn = () => mode;
    return withEditorCamera(
      viewAnswers({ scene, store, ending: ending.current.signal, lookedThrough }),
      cameras,
      drawn
    );
  }, [scene, store, cameras, lookedThrough, mode]);
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

function stageOf({ mode, camera, className }: Pick<TscnCanvasProps, 'mode' | 'camera' | 'className'>) {
  if (mode === 'in-game') return <GameStage className={className} />;
  if (mode === '2D') return <Editor2DStage className={className} />;
  return <EditorCanvas className={className} camera={camera} />;
}

// The game stage loads on demand, so a host that never shows it keeps it out of its first chunk.
function GameStage({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <GameView className={className} />
    </Suspense>
  );
}
