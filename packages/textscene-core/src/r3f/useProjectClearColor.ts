/**
 * The project's `default_clear_color` as the linear colour three clears or paints with. Godot
 * clears every opaque viewport to it, the root and each SubViewport alike
 * (`servers/rendering/renderer_viewport.cpp:371`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { projectClearColor } from '../parser/projectSettingsParser.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { useGodotLinearColor } from './godotColor.js';

export function useProjectClearColor(): THREE.Color {
  const { settings } = useProjectSettings();
  return useGodotLinearColor(useMemo(() => projectClearColor(settings), [settings]));
}
