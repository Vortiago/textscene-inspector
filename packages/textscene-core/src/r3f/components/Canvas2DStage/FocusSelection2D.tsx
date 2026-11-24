import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode, type RefObject } from 'react';
import type { Rect2 } from '../../../godot/math/rect2.js';
import { useSelectedNodePathStore } from '../../contexts/SelectionContext.js';
import { useSharedLiveTree } from '../../useLiveSceneTree.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { livePlacements, node2dWorldTransform } from '../../node2dWorldTransform.js';
import { isViewKeyEvent } from '../../viewFocus.js';
import { isFocusSelectionKey, isFrameSelectionKey } from '../../editorKeyBindings.js';
import { useEditRects } from '../../editRect/editRects.js';
import { selectionRect } from '../../editRect/focusSelection2D.js';
import { useEditorCameras } from '../../editorCamera/EditorCamerasContext.js';
import { warnOfCameraFailure } from '../../editorCamera/editorCameras.js';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';

/** What the stage hands the keys inside its canvas, where the Live scene tree holds the solved Controls. */
export interface Stage2D {
  stage: HTMLElement | null;
  /** The 2D editor camera reads it to place a node. */
  rectOf: RefObject<(livePath: string) => Rect2 | null>;
}

const Stage2DContext = createContext<Stage2D | null>(null);
Stage2DContext.displayName = 'Stage2DContext';

export function Stage2DProvider({ stage, children }: { stage: Stage2D; children: ReactNode }) {
  return <Stage2DContext.Provider value={stage}>{children}</Stage2DContext.Provider>;
}

/** Godot's Center Selection (F) and Frame Selection (Shift+F) (canvas_item_editor_plugin.cpp:5941-5942). */
export function FocusSelection2D() {
  const stage2D = useContext(Stage2DContext);
  const rects = useEditRects();
  const selectedPath = useSelectedNodePathStore();
  const loader = useResourceLoader();
  const liveTree = useSharedLiveTree();
  const camera = useEditorCameras()?.slot('Camera2D').node ?? null;

  useLayoutEffect(() => {
    if (!stage2D) return;
    stage2D.rectOf.current = (path) => {
      if (!liveTree) return null;
      const { roots, ctx } = liveTree;
      const global = node2dWorldTransform(roots, ctx, path, livePlacements(liveTree, loader));
      return global && selectionRect(global, rects?.get(path) ?? null);
    };
  }, [stage2D, liveTree, loader, rects]);

  useEffect(() => {
    if (!stage2D?.stage || !camera) return undefined;
    const { stage } = stage2D;
    const node = camera;
    function onKeyDown(event: KeyboardEvent): void {
      if (!isViewKeyEvent(event, stage)) return;
      const isFrame = isFrameSelectionKey(event);
      if (!isFrame && !isFocusSelectionKey(event)) return;
      event.preventDefault();
      const path = selectedPath.get();
      node
        .call(isFrame ? 'focus' : 'center', ...(path ? [absolutePathOf(path)] : []))
        .catch(warnOfCameraFailure);
    }

    stage.addEventListener('keydown', onKeyDown);
    return () => stage.removeEventListener('keydown', onKeyDown);
  }, [stage2D, selectedPath, camera]);

  return null;
}
