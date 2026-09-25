/**
 * `BaseMaterial3D.blend_mode` → three.js blending state. `_update_shader` in
 * `scene/resources/material.cpp` emits `render_mode blend_*`, which
 * `scene_shader_forward_clustered.cpp` maps to a `BlendMode`. `GODOT_BLEND_ATTACHMENTS`
 * transcribes the factors of `servers/rendering/renderer_rd/storage_rd/material_storage.cpp`.
 */

import * as THREE from 'three';
import { BlendMode, type MaterialBlendState } from './types';

/** Godot `RD::BlendOperation`, only the two values this table uses. */
export type GodotBlendOp = 'add' | 'reverse-subtract';

/** Godot `RD::BlendFactor`, only the values this table uses. */
export type GodotBlendFactor =
  | 'zero'
  | 'one'
  | 'src-alpha'
  | 'one-minus-src-alpha'
  | 'dst-color'
  | 'dst-alpha';

/** One `RD::PipelineColorBlendState::Attachment`, in Godot's vocabulary. */
export interface GodotBlendAttachment {
  colorOp: GodotBlendOp;
  srcColor: GodotBlendFactor;
  dstColor: GodotBlendFactor;
  alphaOp: GodotBlendOp;
  srcAlpha: GodotBlendFactor;
  dstAlpha: GodotBlendFactor;
}

/**
 * `blend_mode_to_blend_attachment`, verbatim. Every mode enables blending, and the alpha
 * channel gets its own factors in all five, so no colour-only `gl.blendFunc` reading
 * expresses a mode.
 */
export const GODOT_BLEND_ATTACHMENTS: Readonly<Record<BlendMode, GodotBlendAttachment>> = {
  [BlendMode.MIX]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one-minus-src-alpha',
    alphaOp: 'add',
    srcAlpha: 'one',
    dstAlpha: 'one-minus-src-alpha',
  },
  [BlendMode.ADD]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one',
    alphaOp: 'add',
    srcAlpha: 'src-alpha',
    dstAlpha: 'one',
  },
  [BlendMode.SUB]: {
    colorOp: 'reverse-subtract',
    srcColor: 'src-alpha',
    dstColor: 'one',
    alphaOp: 'reverse-subtract',
    srcAlpha: 'src-alpha',
    dstAlpha: 'one',
  },
  [BlendMode.MUL]: {
    colorOp: 'add',
    srcColor: 'dst-color',
    dstColor: 'zero',
    alphaOp: 'add',
    srcAlpha: 'dst-alpha',
    dstAlpha: 'zero',
  },
  [BlendMode.PREMULT_ALPHA]: {
    colorOp: 'add',
    srcColor: 'one',
    dstColor: 'one-minus-src-alpha',
    alphaOp: 'add',
    srcAlpha: 'one',
    dstAlpha: 'one-minus-src-alpha',
  },
};

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

/** The blending state a material with this `blend_mode` must carry. */
export function godotBlendState(mode: BlendMode): MaterialBlendState {
  const preset = PRESETS[mode];
  if (preset !== undefined) return { blending: preset };
  const attachment = GODOT_BLEND_ATTACHMENTS[mode];
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
