/**
 * Where a Godot sRGB Color literal becomes a linear `THREE.Color`, through
 * `setRGB(..., SRGBColorSpace)`: the number constructor reads its arguments as linear.
 * `utils/colorSpace.ts` carries three's curve for raw channels. The two differ only in which
 * side of 0.04045 the knee sits on.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * @oneWay A Godot sRGB colour as a linear `THREE.Color`
 */
export function godotColorToLinear(c: { r: number; g: number; b: number }): THREE.Color {
  return setGodotColorLinear(new THREE.Color(), c);
}

/**
 * Writes Godot's sRGB `color` into `target` as linear, for a caller that allocates nothing per draw.
 *
 * @oneWay A Godot sRGB colour as a linear `THREE.Color`
 */
export function setGodotColorLinear(
  target: THREE.Color,
  { r, g, b }: { r: number; g: number; b: number }
): THREE.Color {
  return target.setRGB(r, g, b, THREE.SRGBColorSpace);
}

/**
 * Memoised on the r/g/b values, not the object identity, so a colour object that churns per
 * render (animated modulate, re-derived properties) allocates no fresh THREE.Color.
 *
 * @oneWay A Godot sRGB colour as a linear `THREE.Color`
 */
export function useGodotLinearColor(c: { r: number; g: number; b: number }): THREE.Color {
  const { r, g, b } = c;
  return useMemo(() => godotColorToLinear({ r, g, b }), [r, g, b]);
}
