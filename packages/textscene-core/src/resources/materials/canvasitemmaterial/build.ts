/**
 * `CanvasItemMaterial.blend_mode` → three.js blending state, which the caller applies
 * with its own map and tint. Ported from `blend_mode_to_blend_attachment`
 * (servers/rendering/renderer_rd/storage_rd/material_storage.cpp:651-716), called per
 * canvas pipeline (renderer_canvas_render_rd.cpp:1516), with separate alpha factors per mode.
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

/**
 * BLEND_MODE_MIX is colour `SRC_ALPHA / ONE_MINUS_SRC_ALPHA` over alpha
 * `ONE / ONE_MINUS_SRC_ALPHA`, both ADD: the pair three's `NormalBlending` sets for a
 * straight-alpha material. Also the fallback for DISABLED, which no scene can author.
 */
const MIX: CanvasItemBlendState = {
  blending: THREE.NormalBlending,
  premultipliedAlpha: false,
};

/** Godot's per-mode factors, colour pair then alpha pair. Three has no preset for these. */
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
    // False: Godot's premult mode sets these blend attachments and nothing else
    // (material_storage.cpp:700-708). three's flag adds an in-shader `rgb *= a`, which
    // would premultiply twice against Godot, as in the 3D slice's blendState.
    premultipliedAlpha: false,
  },
};

export function canvasItemBlendState(mode: CanvasItemBlendMode): CanvasItemBlendState {
  return CUSTOM[mode] ?? MIX;
}
