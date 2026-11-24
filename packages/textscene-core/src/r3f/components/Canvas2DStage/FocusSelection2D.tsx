import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { ZERO_RECT } from '../../../godot/math/rect2.js';
import { useSelectedNodePathStore } from '../../contexts/SelectionContext.js';
import { useSharedLiveTree } from '../../useLiveSceneTree.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { livePlacements, node2dWorldTransform } from '../../node2dWorldTransform.js';
import { isViewKeyEvent } from '../../viewFocus.js';
import { isFocusSelectionKey, isFrameSelectionKey } from '../../editorKeyBindings.js';
import { useEditRects } from '../../editRect/editRects.js';
import {
  centerSelection,
  frameSelection,
  selectionRect,
  type StageView,
} from '../../editRect/focusSelection2D.js';

/** What the stage hands the keys inside its canvas, where the Live scene tree holds the solved Controls. */
export interface Stage2D {
  stage: HTMLElement | null;
  /** The view as of now, written ahead of the re-render. */
  view: RefObject<StageView>;
  moveView: (next: StageView) => void;
  clampZoom: (zoom: number) => number;
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
  // A ref, not a dependency: the tree changes on every solve, and only a key press reads it.
  const latestLiveTree = useSharedLiveTree();
  const liveTree = useRef(latestLiveTree);
  useLayoutEffect(() => {
    liveTree.current = latestLiveTree;
  }, [latestLiveTree]);

  useEffect(() => {
    if (!stage2D?.stage) return undefined;
    const { stage, view, moveView, clampZoom } = stage2D;
    function selectedRect() {
      const path = selectedPath.get();
      if (!path || !liveTree.current) return null;
      const { roots, ctx } = liveTree.current;
      const global = node2dWorldTransform(roots, ctx, path, livePlacements(liveTree.current, loader));
      return global && selectionRect(global, rects?.get(path) ?? null);
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (!isViewKeyEvent(event, stage)) return;
      const isFrame = isFrameSelectionKey(event);
      if (!isFrame && !isFocusSelectionKey(event)) return;
      event.preventDefault();
      // Godot centres on the origin with nothing selected: its merged rect stays empty (:5165-5167).
      const target = selectedRect() ?? ZERO_RECT;
      const size = stage.getBoundingClientRect();
      moveView(
        isFrame
          ? frameSelection(view.current, target, size, clampZoom)
          : centerSelection(view.current, target, size)
      );
    }

    stage.addEventListener('keydown', onKeyDown);
    return () => stage.removeEventListener('keydown', onKeyDown);
  }, [stage2D, rects, selectedPath, loader]);

  return null;
}
