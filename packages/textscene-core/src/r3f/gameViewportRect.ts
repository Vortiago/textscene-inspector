/**
 * The game viewport rect in Godot canvas pixels: `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`)
 * from `display/window/size/viewport_*`. The stage applies no Camera2D, so the canvas transform is
 * the identity and viewport pixels are canvas pixels. A root Control anchors to it, and a
 * DirectionalLight2D's shadow map spans it.
 */

import { useMemo } from 'react';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import type { Rect2 } from './controls/native/rect.js';

export function useGameViewportRect(): Rect2 {
  const { width, height } = useProjectSettings().viewportSize;
  return useMemo(() => ({ x: 0, y: 0, w: width, h: height }), [width, height]);
}
