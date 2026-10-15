/**
 * `BaseMaterial3D.blend_mode` → three.js blending state. `_update_shader` in
 * `scene/resources/material.cpp` emits `render_mode blend_*`, which
 * `scene_shader_forward_clustered.cpp` maps to a `BlendMode`. `godot/rendering/materials/blendMode.ts`
 * holds the attachment of each `BlendMode`.
 */

import * as THREE from 'three';
import type { MaterialBlendState } from './types';
import {
  ALPHA_TO_COVERAGE_ATTACHMENT,
  BlendMode,
  GODOT_BLEND_ATTACHMENTS,
  type GodotBlendAttachment,
  type GodotBlendFactor,
  type GodotBlendOp,
} from '../../../godot/rendering/materials/blendMode';
import {
  AlphaAntiAliasing,
  type AlphaToCoverageMode,
} from '../../../godot/rendering/materials/alphaAntialiasing';

const THREE_EQUATION: Readonly<Record<GodotBlendOp, THREE.BlendingEquation>> = {
  add: THREE.AddEquation,
  'reverse-subtract': THREE.ReverseSubtractEquation,
};

const THREE_FACTOR: Readonly<Record<GodotBlendFactor, THREE.BlendingDstFactor>> = {
  zero: THREE.ZeroFactor,
  one: THREE.OneFactor,
  'src-alpha': THREE.SrcAlphaFactor,
  'one-minus-src-alpha': THREE.OneMinusSrcAlphaFactor,
  'dst-color': THREE.DstColorFactor,
  'dst-alpha': THREE.DstAlphaFactor,
};

/**
 * The modes a three preset expresses exactly, kept as presets for the blending constant
 * consumers assert on (`WebGLState.setBlending`, non-premultiplied; `blendState.test.ts`).
 * SUB is not `SubtractiveBlending` (`FUNC_ADD` with `ZERO/ONE_MINUS_SRC_COLOR`), and
 * PREMULT_ALPHA is not `premultipliedAlpha`, which premultiplies a premultiplied source again.
 * Every Godot mode gives alpha its own factors, so no colour-only `gl.blendFunc` reading fits one.
 */
const PRESETS: Readonly<Partial<Record<BlendMode, THREE.Blending>>> = {
  // `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`, `FUNC_ADD`.
  [BlendMode.MIX]: THREE.NormalBlending,
  // `blendFunc(SRC_ALPHA, ONE)` sets colour and alpha, so alpha gets Godot's pair.
  [BlendMode.ADD]: THREE.AdditiveBlending,
  // `blendFunc(ZERO, SRC_COLOR)`: `src × dst` and `a_src × a_dst`, Godot's
  // `DST_COLOR/ZERO` and `DST_ALPHA/ZERO` products with the operands swapped.
  [BlendMode.MUL]: THREE.MultiplyBlending,
};

/**
 * ALPHA_TO_COVERAGE_AND_TO_ONE's attachment: alpha to one sets the source alpha to 1 before the
 * blend, so the colour overwrites. WebGL has no alpha to one, so the stored alpha stays the
 * source alpha where Godot stores 1. Only a transparent background shows it: a SubViewport with
 * `transparent_bg`, or a root with `rendering/viewport/transparent_background`.
 */
const ALPHA_TO_ONE_ATTACHMENT: GodotBlendAttachment = {
  ...ALPHA_TO_COVERAGE_ATTACHMENT,
  srcColor: 'one',
  dstColor: 'zero',
};

/** The blending state a material with this `blend_mode` must carry. */
export function godotBlendState(mode: BlendMode): MaterialBlendState {
  const preset = PRESETS[mode];
  if (preset !== undefined) return { blending: preset };
  return customBlendState(GODOT_BLEND_ATTACHMENTS[mode]);
}

/** The blending state a surface whose alpha antialiasing turns alpha to coverage on must carry. */
export function alphaToCoverageBlendState(mode: AlphaToCoverageMode): MaterialBlendState {
  return customBlendState(
    mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE
      ? ALPHA_TO_ONE_ATTACHMENT
      : ALPHA_TO_COVERAGE_ATTACHMENT
  );
}

function customBlendState(attachment: GodotBlendAttachment): MaterialBlendState {
  return {
    blending: THREE.CustomBlending,
    blendEquation: THREE_EQUATION[attachment.colorOp],
    blendSrc: THREE_FACTOR[attachment.srcColor],
    blendDst: THREE_FACTOR[attachment.dstColor],
    blendEquationAlpha: THREE_EQUATION[attachment.alphaOp],
    blendSrcAlpha: THREE_FACTOR[attachment.srcAlpha],
    blendDstAlpha: THREE_FACTOR[attachment.dstAlpha],
  };
}
