import type { Rect2 } from '../../godot/math/rect2.js';
import { VECTOR2_ZERO, type Vector2 } from '../../godot/math/vector.js';
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

/** The window as a pane that shows it at `scale` renders it: below 1, at the fitted size (ADR-0087). */
export function shrinkRootWindow(window: RootWindow, scale: number): RootWindow {
  if (scale >= 1) return window;
  const { targetSize, size2dOverride } = window;
  const hasOverride = size2dOverride.x !== 0 || size2dOverride.y !== 0;
  return {
    ...window,
    targetSize: { x: shrunkExtent(targetSize.x, scale), y: shrunkExtent(targetSize.y, scale) },
    size2dOverride: hasOverride ? size2dOverride : targetSize,
  };
}

function shrunkExtent(extent: number, scale: number): number {
  return Math.max(1, Math.round(extent * scale));
}
