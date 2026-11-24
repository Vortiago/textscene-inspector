import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalSelection } from './contexts/SelectionContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { EditorControlsHandle, isDrawingPreview } from './EditorControlsHandle.js';
import { editorCamera3D } from './editorCamera/editorCamera3D.js';
import { useEditorCameras } from './editorCamera/EditorCamerasContext.js';
import { useViewStatusStore } from './viewStatus/ViewStatusContext.js';
import type { FreelookControl } from './freelook.js';
import { exitPointerLock } from './pointerLock.js';
import { freelookControlOf } from './useFreelook.js';

export function EditorControlsBridge() {
  const get = useThree((s) => s.get);
  const published = useThree((s) => s.controls);
  const controls = published instanceof EditorControlsHandle ? published : null;
  const freelook = useMemo(() => controls && freelookControlOf(controls, get), [controls, get]);
  return (
    <>
      {freelook && <FreelookReport freelook={freelook} />}
      {controls && freelook && <CameraNode controls={controls} freelook={freelook} />}
      <SceneChangeEndsFreelook />
    </>
  );
}

function CameraNode({ controls, freelook }: { controls: EditorControlsHandle; freelook: FreelookControl }) {
  const slot = useEditorCameras()?.slot('Camera3D');
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  // Refs: both change with each scene build, and only a call or a remount reads them.
  const latestNodeObjects = useOptionalSelection()?.nodeObjectMap ?? null;
  const nodeObjects = useRef(latestNodeObjects);
  const latestRootScene = useOptionalHierarchy()?.sceneGraph?.rootScene ?? '';
  const rootScene = useRef(latestRootScene);
  useLayoutEffect(() => {
    nodeObjects.current = latestNodeObjects;
    rootScene.current = latestRootScene;
  }, [latestNodeObjects, latestRootScene]);
  useEffect(() => {
    if (!slot) return undefined;
    return slot.bind(
      editorCamera3D({
        handle: controls,
        freelook,
        scene: () => get().scene,
        nodeObjects: () => nodeObjects.current,
        rootScene: () => rootScene.current,
        isPreviewing: () => isDrawingPreview(get()),
        invalidate,
      })
    );
  }, [slot, controls, freelook, get, invalidate]);
  return null;
}

/** The view's status and the speed readout hear the freelook of this canvas. */
function FreelookReport({ freelook }: { freelook: FreelookControl }) {
  const registerFreelook = useOptionalViewportActions()?.registerFreelook;
  useEffect(() => registerFreelook?.(freelook), [registerFreelook, freelook]);

  const store = useViewStatusStore();
  const state = useSyncExternalStore(freelook.subscribe, freelook.getState);
  useEffect(() => {
    store?.freelookChanged({ isToggled: state.isToggled, isAvailable: state.isAvailable });
  }, [store, state.isToggled, state.isAvailable]);
  useEffect(() => () => store?.freelookChanged(null), [store]);
  return null;
}

// A flight would fight a host's frame of a new scene. A reload keeps the root path, so keeps the toggle.
function SceneChangeEndsFreelook() {
  const get = useThree((s) => s.get);
  const rootScene = useOptionalHierarchy()?.sceneGraph?.rootScene;
  useEffect(() => () => exitPointerLock(get().gl.domElement), [rootScene, get]);
  return null;
}
