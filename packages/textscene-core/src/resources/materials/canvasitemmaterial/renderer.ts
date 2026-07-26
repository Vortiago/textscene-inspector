/**
 * `CanvasItemMaterial.blend_mode` → three.js blending state.
 *
 * Godot's canvas rasteriser picks a fixed glBlendFunc per mode
 * (`RasterizerCanvasGLES3::_render_batch` / the RD equivalent), all with
 * separate alpha factors. `NormalBlending` covers MIX exactly; every other mode
 * needs `CustomBlending` because three has no preset for them.
 *
 * These are the state a canvas item's material needs; applying them is the
 * caller's job so one item can combine them with its own map/tint.
 */

import * as THREE from 'three';
import { CanvasItemBlendMode } from './types';

export interface CanvasItemBlendState {
  blending: THREE.Blending;
  blendSrc?: THREE.BlendingSrcFactor;
  blendDst?: THREE.BlendingDstFactor;
  blendEquation?: THREE.BlendingEquation;
  blendSrcAlpha?: THREE.BlendingSrcFactor;
  blendDstAlpha?: THREE.BlendingDstFactor;
  blendEquationAlpha?: THREE.BlendingEquation;
  /**
   * Whether the source colour is already multiplied by its alpha. Only
   * PREMULT_ALPHA says yes; the rest expect three's usual straight alpha.
   */
  premultipliedAlpha: boolean;
}

const MIX: CanvasItemBlendState = {
  blending: THREE.NormalBlending,
  premultipliedAlpha: false,
};

/**
 * Godot's per-mode factors. Every custom mode leaves alpha accumulating as
 * `a_src * 1 + a_dst * (1 - a_src)`, which is what its canvas blend equations
 * use for the alpha channel regardless of the colour mode.
 */
const CUSTOM: Partial<Record<CanvasItemBlendMode, CanvasItemBlendState>> = {
  [CanvasItemBlendMode.ADD]: {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneFactor,
    premultipliedAlpha: false,
  },
  [CanvasItemBlendMode.SUB]: {
    blending: THREE.CustomBlending,
    blendEquation: THREE.ReverseSubtractEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
    blendSrcAlpha: THREE.SrcAlphaFactor,
    blendDstAlpha: THREE.OneFactor,
    premultipliedAlpha: false,
  },
  [CanvasItemBlendMode.MUL]: {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.DstAlphaFactor,
    blendDstAlpha: THREE.ZeroFactor,
    premultipliedAlpha: false,
  },
  [CanvasItemBlendMode.PREMULT_ALPHA]: {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    premultipliedAlpha: true,
  },
};

export function canvasItemBlendState(mode: CanvasItemBlendMode): CanvasItemBlendState {
  return CUSTOM[mode] ?? MIX;
}
