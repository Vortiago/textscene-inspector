/**
 * The project's `default_clear_color`. Godot clears every opaque viewport to it, the root and each
 * SubViewport alike (`servers/rendering/renderer_viewport.cpp:371`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { projectClearColor } from '../parser/projectSettingsParser.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { useGodotLinearColor } from './godotColor.js';
import type { Rgba } from '../godot/math.js';

/** The colour as the project stores it, in sRGB. */
export function useProjectClearColorSrgb(): Rgba {
  const { settings } = useProjectSettings();
  return useMemo(() => projectClearColor(settings), [settings]);
}

/** The linear colour three clears or paints with. */
export function useProjectClearColor(): THREE.Color {
  return useGodotLinearColor(useProjectClearColorSrgb());
}
