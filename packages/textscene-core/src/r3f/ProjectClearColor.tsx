/**
 * Clears the canvas to the project's clear colour (`servers/rendering/renderer_viewport.cpp:751`),
 * opaque, as Godot clears each opaque viewport (`:371`): a blended 2D item and a 3D root with no
 * Environment show it. A transparent root clears to `Color(0, 0, 0, 0)` (`:371`), so the stage shows.
 */

import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { projectTransparentBackground } from '../parser/projectSettingsParser.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { useProjectClearColor } from './useProjectClearColor.js';

export function ProjectClearColor() {
  const gl = useThree((state) => state.gl);
  const color = useProjectClearColor();
  const { settings } = useProjectSettings();
  const isTransparent = projectTransparentBackground(settings);

  useLayoutEffect(() => {
    const previousColor = gl.getClearColor(new THREE.Color());
    const previousAlpha = gl.getClearAlpha();
    gl.setClearColor(color, isTransparent ? 0 : 1);
    return () => gl.setClearColor(previousColor, previousAlpha);
  }, [gl, color, isTransparent]);

  return null;
}
