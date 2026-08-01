/**
 * `CanvasItemMaterial.blend_mode` → three.js blending state (the slice's build
 * half: decoded data in, renderer state out).
 *
 * Ported from `MaterialStorage::ShaderData::blend_mode_to_blend_attachment`
 * (servers/rendering/renderer_rd/storage_rd/material_storage.cpp:651-716), which
 * the canvas renderer calls for every pipeline it creates
 * (renderer_canvas_render_rd.cpp:1516). Each mode is one fixed blend attachment
 * with SEPARATE colour and alpha factors, so the alpha pair is per mode, not
 * shared. `NormalBlending` covers MIX exactly; every other mode needs
 * `CustomBlending` because three has no preset for them.
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

/**
 * BLEND_MODE_MIX is colour `SRC_ALPHA / ONE_MINUS_SRC_ALPHA` over alpha
 * `ONE / ONE_MINUS_SRC_ALPHA`, both ADD — exactly the pair three's
 * `NormalBlending` sets for a straight-alpha material, so it needs no custom
 * state. Also the fallback for a blend mode no scene can author (DISABLED).
 */
const MIX: CanvasItemBlendState = {
  blending: THREE.NormalBlending,
  premultipliedAlpha: false,
};

/** Godot's per-mode factors, colour pair then alpha pair. */
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
    // FALSE deliberately: Godot's premult mode sets these blend attachments and
    // nothing else (material_storage.cpp:700-708) — its canvas shader never
    // multiplies rgb by alpha. three's flag adds exactly that in-shader
    // multiply, so with identical texture bytes it would premultiply TWICE
    // against Godot. Same ruling as the 3D slice's blendState.
    premultipliedAlpha: false,
  },
};

export function canvasItemBlendState(mode: CanvasItemBlendMode): CanvasItemBlendState {
  return CUSTOM[mode] ?? MIX;
}
