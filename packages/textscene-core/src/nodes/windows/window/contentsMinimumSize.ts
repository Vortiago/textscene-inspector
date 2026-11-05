/**
 * The contents minimum an embedded window's `wrap_controls` floors its size at
 * (`Window::get_contents_minimum_size`, `window.cpp:2234-2242`), read from the rects and minimums
 * the solve gave its Controls.
 */

import type { Vector2 } from '../../../godot/math/vector';
import type { SolvedControl } from '../../../r3f/controls/native/controlRectSolver';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { isLaidOutChild, isSceneChild, type SolveNode } from '../../../r3f/controls/native/solveTree';
import { popupPanelContentsMinimumSize } from '../popuppanel/contentLayout';

type Solved = ReadonlyMap<string, SolvedControl>;

/**
 * `Window::_get_contents_minimum_size` (`window.cpp:1839-1853`): the furthest corner of any child
 * Control's `Point2i` position plus its `Size2i` combined minimum.
 */
function furthestChildCorner(window: SolveNode, solved: Solved): Vector2 {
  let x = 0;
  let y = 0;
  for (const child of window.children) {
    const entry = isSceneChild(window, child) ? solved.get(child.path) : undefined;
    if (!entry) continue;
    x = Math.max(x, Math.trunc(entry.rect.x) + Math.trunc(entry.minSize.x));
    y = Math.max(y, Math.trunc(entry.rect.y) + Math.trunc(entry.minSize.y));
  }
  return { x, y };
}

/** `PopupPanel::_get_contents_minimum_size` over the children its layout places. */
function popupPanelMinimum(popup: SolveNode, solved: Solved, theme: NativeTheme): Vector2 {
  const childMinimums = popup.children
    .filter((child) => isLaidOutChild(popup, child))
    .flatMap((child) => solved.get(child.path)?.minSize ?? []);
  return popupPanelContentsMinimumSize(popup, childMinimums, theme);
}

export function windowContentsMinimumSize(window: SolveNode, solved: Solved, theme: NativeTheme): Vector2 {
  // PopupPanel overrides the virtual (`popup.cpp:270`); Window and Popup keep the base.
  return window.node.type === 'PopupPanel'
    ? popupPanelMinimum(window, solved, theme)
    : furthestChildCorner(window, solved);
}
