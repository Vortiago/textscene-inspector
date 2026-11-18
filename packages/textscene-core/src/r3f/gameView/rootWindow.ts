import type { Rect2 } from '../../godot/math/rect2.js';
import { VECTOR2_ZERO, vector2Equals, type Vector2 } from '../../godot/math/vector.js';
import { ContentScaleMode } from '../../godot/scene/window.js';
import { windowContentScale } from '../../nodes/windows/window/contentScale.js';
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

export function rootWindow(settings: ProjectSettings | null): RootWindow {
  const { width, height } = projectWindowSize(settings);
  const size = { x: width, y: height };
  const contentScale = projectContentScale(settings);
  const { renderSize, layoutSize, drawRect } = windowContentScale(size, contentScale);
  // Viewport mode sets no 2D override (`window.cpp:1337-1347`).
  const size2dOverride = contentScale.mode === ContentScaleMode.VIEWPORT ? VECTOR2_ZERO : layoutSize;
  return { size, targetSize: renderSize, size2dOverride, drawRect };
}

/** The target at the size the pane draws it, when smaller (ADR-0087). A hidden pane keeps it. */
export function fittedTargetSize(window: RootWindow, paneScale: number): Vector2 {
  const scale = paneScale * windowPixelsPerTargetPixel(window);
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

function shrunkExtent(extent: number, scale: number): number {
  return Math.max(1, Math.round(extent * scale));
}
