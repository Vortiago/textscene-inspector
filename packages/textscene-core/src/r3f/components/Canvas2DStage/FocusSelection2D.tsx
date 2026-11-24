import { createContext, useContext, useEffect, type ReactNode, type RefObject } from 'react';
import { useSelectedNodePathStore } from '../../contexts/SelectionContext.js';
import { useSharedLiveTree } from '../../useLiveSceneTree.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { solvedNodePatchesOf } from '../../liveNodePatches.js';
import { liveTreeOf } from '../../liveSceneTree.js';
import { liveFilesOf } from '../../liveFiles.js';
import { node2dWorldTransform } from '../../node2dWorldTransform.js';
import { isViewKeyEvent } from '../../viewFocus.js';
import type { EditRects } from '../../editRect/editRects.js';
import {
  centerSelection,
  frameSelection,
  selectionRect,
  type StageView,
} from '../../editRect/focusSelection2D.js';

/** What the stage hands the keys inside its canvas, where the Live scene tree holds the solved Controls. */
export interface Stage2D {
  stage: HTMLElement | null;
  rects: EditRects;
  /** The view as of now, written ahead of the re-render. */
  view: RefObject<StageView>;
  moveView: (next: StageView) => void;
  zoomRange: { min: number; max: number };
}

const Stage2DContext = createContext<Stage2D | null>(null);
Stage2DContext.displayName = 'Stage2DContext';

export function Stage2DProvider({ stage, children }: { stage: Stage2D; children: ReactNode }) {
  return <Stage2DContext.Provider value={stage}>{children}</Stage2DContext.Provider>;
}

const hasModifier = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey;

/** Godot's Center Selection (F) and Frame Selection (Shift+F) (canvas_item_editor_plugin.cpp:5941-5942). */
export function FocusSelection2D() {
  const stage2D = useContext(Stage2DContext);
  useFocusSelection2D(stage2D);
  return null;
}

function useFocusSelection2D(stage2D: Stage2D | null): void {
  const selectedPath = useSelectedNodePathStore();
  const liveTree = useSharedLiveTree();
  const loader = useResourceLoader();

  useEffect(() => {
    if (!stage2D?.stage) return undefined;
    const { stage, rects, view, moveView, zoomRange } = stage2D;
    function selectedRect() {
      const path = selectedPath.get();
      if (!path || !liveTree) return null;
      const placed = solvedNodePatchesOf(
        liveTreeOf(liveTree.roots, liveTree.ctx),
        liveFilesOf(loader).current()
      );
      const global = node2dWorldTransform(liveTree.roots, liveTree.ctx, path, placed);
      return global && selectionRect(global, rects.get(path) ?? null);
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (!isViewKeyEvent(event, stage)) return;
      if (event.key.toLowerCase() !== 'f' || hasModifier(event)) return;
      const rect = selectedRect();
      // Godot centres on the origin with nothing selected: its merged rect stays empty (:5165-5167).
      const target = rect ?? { x: 0, y: 0, w: 0, h: 0 };
      const size = stage.getBoundingClientRect();
      const current = view.current;
      if (!current) return;
      event.preventDefault();
      moveView(
        event.shiftKey
          ? frameSelection(current, target, size, zoomRange.min, zoomRange.max)
          : centerSelection(current, target, size)
      );
    }

    stage.addEventListener('keydown', onKeyDown);
    return () => stage.removeEventListener('keydown', onKeyDown);
  }, [stage2D, selectedPath, liveTree, loader]);
}
