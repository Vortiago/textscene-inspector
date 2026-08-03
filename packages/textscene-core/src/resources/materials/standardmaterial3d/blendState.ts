/**
 * `BaseMaterial3D.blend_mode` → three.js blending state, ported from Godot.
 *
 * Godot turns the mode into a `render_mode blend_*` line on the generated
 * spatial shader (`scene/resources/material.cpp` `_update_shader`, the
 * `switch (blend_mode)` emitting `blend_mix` / `blend_add` / `blend_sub` /
 * `blend_mul` / `blend_premul_alpha`); the shader compiler maps those names back
 * to a `BlendMode` (`scene_shader_forward_clustered.cpp`
 * `render_mode_values["blend_add"]` …), and
 * `MaterialStorage::ShaderData::blend_mode_to_blend_attachment`
 * (`servers/rendering/renderer_rd/storage_rd/material_storage.cpp`) picks the
 * actual factors. `GODOT_BLEND_ATTACHMENTS` below IS that function's table,
 * transcribed — the same engine enum `CanvasItemMaterial` blends 2D with.
 *
 * Three of the five modes come out identical to a three.js PRESET, so those use
 * the preset (fewer moving parts, and the material keeps the blending constant
 * existing consumers assert on). `blendState.test.ts` pins the equivalence
 * against the ported factors, so a change in either engine surfaces as a
 * failure rather than a silent divergence.
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
 * `blend_mode_to_blend_attachment`, verbatim. Every mode enables blending; the
 * alpha channel gets its own factors in all five, which is why a mode cannot be
 * expressed by a colour-only `gl.blendFunc` reading.
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
 * The modes a three preset already expresses EXACTLY, with the equality each
 * claim rests on (three's `WebGLState.setBlending`, non-premultiplied branch):
 *
 *   MIX → NormalBlending: `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA,
 *         ONE, ONE_MINUS_SRC_ALPHA)` with `FUNC_ADD` on both channels.
 *   ADD → AdditiveBlending: `blendFunc(SRC_ALPHA, ONE)` — a colour-and-alpha
 *         call, so the alpha channel gets the same pair Godot's does.
 *   MUL → MultiplyBlending: `blendFunc(ZERO, SRC_COLOR)`, i.e. `src × dst` for
 *         colour and `a_src × a_dst` for alpha (GL takes SRC_COLOR's alpha
 *         component for the alpha channel) — the same products as Godot's
 *         `DST_COLOR/ZERO` + `DST_ALPHA/ZERO`, with the operands swapped.
 *
 * SUB is NOT `SubtractiveBlending` (three spells that `FUNC_ADD` with
 * `ZERO/ONE_MINUS_SRC_COLOR`, a different operation entirely), and
 * PREMULT_ALPHA is not NormalBlending-with-`premultipliedAlpha` either: that
 * flag makes three premultiply the shader output (`gl_FragColor.rgb *= a` under
 * `#define PREMULTIPLIED_ALPHA`), which would double-apply against a Godot
 * material whose source is already premultiplied. Both take the real factors.
 */
const PRESETS: Readonly<Partial<Record<BlendMode, THREE.Blending>>> = {
  [BlendMode.MIX]: THREE.NormalBlending,
  [BlendMode.ADD]: THREE.AdditiveBlending,
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
