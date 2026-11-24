import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import type { Rect2 } from '../../godot/math/rect2.js';
import { useNodePath } from '../contexts/NodePathContext.js';

/** `_edit_get_rect` by live path (canvas_item.cpp:1342). A missing path's `_edit_use_rect` is false. */
export interface EditRects {
  get(path: string): Rect2 | undefined;
  set(path: string, rect: Rect2): void;
  delete(path: string): void;
}

const EditRectsContext = createContext<EditRects | null>(null);
EditRectsContext.displayName = 'EditRectsContext';

/** One map per 2D view. Written only by the items it draws, through `usePublishEditRect`. */
export function createEditRects(): EditRects {
  return new Map<string, Rect2>();
}

export function EditRectsProvider({ rects, children }: { rects: EditRects; children: ReactNode }) {
  return <EditRectsContext.Provider value={rects}>{children}</EditRectsContext.Provider>;
}

function useEditRects(): EditRects | null {
  return useContext(EditRectsContext);
}

/** Publishes the drawing item's edit rect, or none for null, until it unmounts. */
export function usePublishEditRect(rect: Rect2 | null): void {
  const rects = useEditRects();
  const path = useNodePath();
  const x = rect?.x;
  const y = rect?.y;
  const w = rect?.w;
  const h = rect?.h;
  useLayoutEffect(() => {
    if (!rects || !path || x === undefined || y === undefined || w === undefined || h === undefined) {
      return undefined;
    }
    rects.set(path, { x, y, w, h });
    return () => rects.delete(path);
  }, [rects, path, x, y, w, h]);
}

/** Publishes the edit rect of each path in `byPath`, for a walker that draws many items. */
export function usePublishEditRects(byPath: ReadonlyMap<string, Rect2>): void {
  const rects = useEditRects();
  useLayoutEffect(() => {
    if (!rects) return undefined;
    for (const [path, rect] of byPath) rects.set(path, rect);
    return () => {
      for (const path of byPath.keys()) rects.delete(path);
    };
  }, [rects, byPath]);
}
