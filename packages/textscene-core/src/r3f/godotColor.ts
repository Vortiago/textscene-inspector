/**
 * Godot stores Color literals in sRGB (matching its inspector colour picker).
 * three.js works in a linear space, so a Godot colour must be converted before
 * it reaches a material. `setRGB(..., SRGBColorSpace)` performs that conversion
 * (vs the number constructor, which treats its args as already-linear). This is
 * the one place the conversion lives, so a colour-space change is a single edit.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

/** Convert a Godot sRGB {r,g,b} (0..1) to a linear-space THREE.Color. */
export function godotColorToLinear(c: { r: number; g: number; b: number }): THREE.Color {
  return new THREE.Color().setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
}

/**
 * Memoized `godotColorToLinear` keyed on the r/g/b VALUES, not the object
 * identity: callers whose colour object churns per render (animated modulate,
 * re-derived properties) don't allocate a fresh THREE.Color each time.
 */
export function useGodotLinearColor(c: { r: number; g: number; b: number }): THREE.Color {
  const { r, g, b } = c;
  return useMemo(() => godotColorToLinear({ r, g, b }), [r, g, b]);
}
