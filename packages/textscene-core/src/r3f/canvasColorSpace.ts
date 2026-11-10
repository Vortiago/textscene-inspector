/**
 * The **canvas colour space**: whether a canvas multiplies sRGB numbers into an 8-bit target, or
 * linear values into a half-float one. Godot draws linear only into a render target that uses HDR
 * (`renderer_canvas_render_rd.cpp:671`), which a SubViewport's `use_hdr_2d` sets. A painter reads
 * the space of its canvas here, so the target, its texture views, its material defines and its
 * tint all follow one switch.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { CANVAS_LINEAR_DEFINES, CANVAS_SRGB_DEFINES } from './canvasSrgbMultiply';
import { godotColorToLinear } from './godotColor';
import type { ViewportTextureView } from '../resources/textures/viewporttexture/useViewportTextureSlot';

export interface CanvasColorSpace {
  /** Godot's `use_linear_colors`: every canvas colour converts from sRGB to linear. */
  isLinear: boolean;
  /**
   * The `defines` of a material that samples a map in this space or carries vertex colours. In
   * sRGB, the material multiplies sRGB numbers (`canvas.glsl:181`). In linear, it decodes the
   * vertex colours on their own (`canvas.glsl:176-178`) and multiplies the decoded texel.
   */
  defines: Readonly<Record<string, string>>;
  /**
   * The colour space a canvas item samples a texture in. In sRGB, the canvas filters the raw bytes.
   * In linear, it samples the sRGB view, which decodes before the filter (`texture_storage.cpp:754`).
   */
  textureColorSpace: THREE.ColorSpace;
  /** The view of a ViewportTexture a canvas item samples: the plain view, or the sRGB one in linear. */
  viewportTextureView: ViewportTextureView;
}

/** The default canvas: sRGB numbers in an 8-bit target (`rendering_server.cpp:3771`). */
const SRGB_CANVAS: CanvasColorSpace = {
  isLinear: false,
  defines: CANVAS_SRGB_DEFINES,
  textureColorSpace: THREE.NoColorSpace,
  viewportTextureView: 'plain',
};

/** The canvas of an HDR render target: linear values in a half-float target. */
const LINEAR_CANVAS: CanvasColorSpace = {
  isLinear: true,
  defines: CANVAS_LINEAR_DEFINES,
  textureColorSpace: THREE.SRGBColorSpace,
  viewportTextureView: 'decoding',
};

/** The space of a canvas whose render target uses HDR when `usesHdr`. */
export function canvasColorSpaceOf(usesHdr: boolean): CanvasColorSpace {
  return usesHdr ? LINEAR_CANVAS : SRGB_CANVAS;
}

/**
 * A Godot colour in the numbers `space` draws with: the authored sRGB, or linear in a linear canvas
 * (`renderer_canvas_render_rd.cpp:692-693`).
 *
 * @canonical A Godot colour in the numbers of a canvas colour space
 */
export function canvasNumbersOf(
  space: CanvasColorSpace,
  colour: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  return space.isLinear ? godotColorToLinear(colour) : colour;
}

/**
 * The `defines` of a material whose vertex colours carry an instance colour. An sRGB canvas
 * multiplies them as sRGB numbers (`canvas.glsl:189`). A linear canvas multiplies the instance colour
 * raw (`canvas.glsl:255`), so three's linear multiply holds there.
 */
export function instanceColorDefines(space: CanvasColorSpace): Readonly<Record<string, string>> | undefined {
  return space.isLinear ? undefined : CANVAS_SRGB_DEFINES;
}

/** Written only by the root canvas (`World2DContents`) and by a SubViewport pass. Outside both, sRGB. */
const CanvasColorSpaceContext = createContext<CanvasColorSpace>(SRGB_CANVAS);
CanvasColorSpaceContext.displayName = 'CanvasColorSpaceContext';

export const CanvasColorSpaceProvider = CanvasColorSpaceContext.Provider;

/**
 * The space of the canvas this item draws in.
 *
 * @canonical The colour space of the canvas a 2D painter draws in
 */
export function useCanvasColorSpace(): CanvasColorSpace {
  return useContext(CanvasColorSpaceContext);
}
