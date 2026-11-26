import type { Rect2 } from '../../godot/math/rect2.js';
import { VECTOR2_ZERO, vector2Equals, type Vector2 } from '../../godot/math/vector.js';
import { windowContentScale } from '../../nodes/windows/window/contentScale.js';
import { smallerStretchAxis } from '../../nodes/viewport/subviewport/targetSize.js';
import {
  projectContentScale,
  projectWindowSize,
  type ProjectSettings,
} from '../../parser/projectSettingsParser.js';

/** The root window as the project opens it, and how it stretches the root viewport into itself. */
export interface RootWindow {
  size: Vector2;
  /** The root viewport's pixels: `final_size`. */
  targetSize: Vector2;
  /** The rect the canvas lays out in, stretched over the target: `final_size_override`, zero for none. */
  size2dOverride: Vector2;
  /** Where the target lands in the window. Black bars fill the rest. */
  drawRect: Rect2;
}

/** The root's minimum size, against tiny-window bugs (`scene_tree.cpp:2043`). */
const ROOT_MIN_EXTENT = 64;

export function rootWindow(settings: ProjectSettings | null): RootWindow {
  const { width, height } = projectWindowSize(settings);
  const size = { x: Math.max(ROOT_MIN_EXTENT, width), y: Math.max(ROOT_MIN_EXTENT, height) };
  const { renderSize, sizeOverride, drawRect } = windowContentScale(size, projectContentScale(settings));
  return { size, targetSize: renderSize, size2dOverride: sizeOverride, drawRect };
}

/** Target pixels per canvas pixel on each axis: one where the canvas lays out in the target itself. */
export function rootCanvasStretch({ targetSize, size2dOverride }: RootWindow): Vector2 {
  if (size2dOverride.x <= 0 || size2dOverride.y <= 0) return { x: 1, y: 1 };
  return { x: targetSize.x / size2dOverride.x, y: targetSize.y / size2dOverride.y };
}

/** The smaller axis of the root's stretch transform, which its windows render at (`window.cpp:1363`). */
export function rootWindowStretch({ targetSize, size2dOverride }: RootWindow): number {
  return smallerStretchAxis(targetSize, size2dOverride);
}

/** The target at the size the pane draws it, when smaller (ADR-0087). A hidden pane keeps it. */
export function fittedTargetSize(window: RootWindow, paneScale: number): Vector2 {
  // A window that minifies its target keeps Godot's ratio: only the pane, or a magnification, shrinks it.
  const scale = paneScale * Math.max(1, windowPixelsPerTargetPixel(window));
  if (!(scale > 0) || scale >= 1) return window.targetSize;
  const { targetSize } = window;
  return { x: shrunkExtent(targetSize.x, scale), y: shrunkExtent(targetSize.y, scale) };
}

/** The window's screen pixels per target pixel: above 1 where the viewport mode magnifies the target. */
function windowPixelsPerTargetPixel({ targetSize, drawRect }: RootWindow): number {
  if (targetSize.x <= 0 || targetSize.y <= 0) return 1;
  return Math.min(drawRect.w / targetSize.x, drawRect.h / targetSize.y);
}

/** The window rendered into a smaller target, laid out in the rect the full target had. */
export function shrinkRootWindow(window: RootWindow, targetSize: Vector2): RootWindow {
  if (vector2Equals(targetSize, window.targetSize)) return window;
  const { size2dOverride } = window;
  const hasOverride = !vector2Equals(size2dOverride, VECTOR2_ZERO);
  return { ...window, targetSize, size2dOverride: hasOverride ? size2dOverride : window.targetSize };
}

/** The window magnifies the drawn target only at full size: a shrunk one is drawn at about its own pixels. */
export function magnifiesTarget(projectWindow: RootWindow, drawnWindow: RootWindow): boolean {
  const { targetSize, drawRect } = projectWindow;
  if (!vector2Equals(drawnWindow.targetSize, targetSize)) return false;
  return drawRect.w !== targetSize.x || drawRect.h !== targetSize.y;
}

function shrunkExtent(extent: number, scale: number): number {
  return Math.max(1, Math.round(extent * scale));
}
