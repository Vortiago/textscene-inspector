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
