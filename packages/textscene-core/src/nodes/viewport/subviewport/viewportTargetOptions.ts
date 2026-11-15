/** What a sub-viewport's properties ask of its target: the canvas colour space, debanding and MSAA. */

import { canvasColorSpaceOf, type CanvasColorSpace } from '../../../r3f/canvasColorSpace';
import type { SubViewportProperties } from './types';

/**
 * The colour space of a sub-viewport's canvas: linear under `use_hdr_2d`. A canvas drawn over a 3D
 * world follows it, since that world's tonemap pass writes the same HDR target.
 */
export function viewportCanvasColorSpace(
  properties: Pick<SubViewportProperties, 'use_hdr_2d'>
): CanvasColorSpace {
  return canvasColorSpaceOf(properties.use_hdr_2d);
}

/**
 * Whether the tonemap pass dithers its output: it does when `use_debanding` asks and the target is
 * 8-bit. An HDR target holds half floats, so Godot clears the flag (`renderer_scene_render_rd.cpp:941`).
 */
export function viewportUsesDebanding(
  properties: Pick<SubViewportProperties, 'use_debanding' | 'use_hdr_2d'>
): boolean {
  return properties.use_debanding && !properties.use_hdr_2d;
}

/**
 * The MSAA mode a sub-viewport's pass takes: `msaa_3d` for the 3D world it draws, `msaa_2d` for its
 * canvas items. Godot keeps one mode per buffer (`renderer_viewport.cpp:1354-1370`).
 */
export function viewportMsaaMode(
  modes: Pick<SubViewportProperties, 'msaa_2d' | 'msaa_3d'>,
  kind: '2d' | '3d'
): number {
  return kind === '3d' ? modes.msaa_3d : modes.msaa_2d;
}
