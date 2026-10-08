/**
 * Clears the 2D canvas to the project's clear colour, opaque, under every canvas item. Godot's
 * editor sets the default clear colour from the project (`servers/rendering/renderer_viewport.cpp:751`)
 * and clears each opaque viewport to it (`:371`), so the whole 2D editor view shows it and an
 * additive, subtractive or multiplying item blends with it. A transparent root clears to
 * `Color(0, 0, 0, 0)` (`:371`), so the stage behind the canvas shows through.
 */

import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { projectTransparentBackground } from '../../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext.js';
import { useProjectClearColor } from '../../useProjectClearColor.js';

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
