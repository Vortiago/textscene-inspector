/**
 * The ported Godot blend table, and the claim that three's presets equal it.
 *
 * Two separate assertions, deliberately:
 *
 *  1. `GODOT_BLEND_ATTACHMENTS` is the transcription of
 *     `MaterialStorage::ShaderData::blend_mode_to_blend_attachment`. Pinning it
 *     as data means a mis-transcription is a failure here rather than a subtly
 *     wrong composite three modes away.
 *  2. For the modes that resolve to a three PRESET, the preset's own documented
 *     factors are restated and compared against the ported ones. That equality
 *     is a claim about three's internals, so it needs an assertion of its own —
 *     otherwise a change in `WebGLState.setBlending` would silently turn a
 *     "provably equal preset" into a divergence.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_BLEND_ATTACHMENTS,
  godotBlendState,
  type GodotBlendAttachment,
} from './blendState';
import { BlendMode } from './types';

describe('GODOT_BLEND_ATTACHMENTS', () => {
  it('transcribes blend_mode_to_blend_attachment exactly', () => {
    expect(GODOT_BLEND_ATTACHMENTS).toEqual({
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
    });
  });

  it('covers every blend mode the enum declares', () => {
    for (const mode of [
      BlendMode.MIX,
      BlendMode.ADD,
      BlendMode.SUB,
      BlendMode.MUL,
      BlendMode.PREMULT_ALPHA,
    ]) {
      expect(GODOT_BLEND_ATTACHMENTS[mode]).toBeDefined();
    }
  });
});

/**
 * What three's `WebGLState.setBlending` programs for each preset, in the
 * NON-premultiplied branch (`material.premultipliedAlpha === false`, which every
 * StandardMaterial3D keeps). `gl.blendFunc` / `gl.blendEquation` set BOTH
 * channels, which is why the alpha pair repeats the colour pair for two of them.
 */
const PRESET_FACTORS: Readonly<Record<number, GodotBlendAttachment>> = {
  [THREE.NormalBlending]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one-minus-src-alpha',
    alphaOp: 'add',
    srcAlpha: 'one',
    dstAlpha: 'one-minus-src-alpha',
  },
  [THREE.AdditiveBlending]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one',
    alphaOp: 'add',
    srcAlpha: 'src-alpha',
    dstAlpha: 'one',
  },
  // `blendFunc(ZERO, SRC_COLOR)` — the operands of Godot's `DST_COLOR/ZERO` are
  // swapped, and multiplication commutes, so colour and alpha both land on the
  // same products (`src × dst`, `a_src × a_dst`).
  [THREE.MultiplyBlending]: {
    colorOp: 'add',
    srcColor: 'dst-color',
    dstColor: 'zero',
    alphaOp: 'add',
    srcAlpha: 'dst-alpha',
    dstAlpha: 'zero',
  },
};

const THREE_EQUATION: Readonly<Record<string, THREE.BlendingEquation>> = {
  add: THREE.AddEquation,
  'reverse-subtract': THREE.ReverseSubtractEquation,
};

const THREE_FACTOR: Readonly<Record<string, THREE.BlendingDstFactor>> = {
  zero: THREE.ZeroFactor,
  one: THREE.OneFactor,
  'src-alpha': THREE.SrcAlphaFactor,
  'one-minus-src-alpha': THREE.OneMinusSrcAlphaFactor,
  'dst-color': THREE.DstColorFactor,
  'dst-alpha': THREE.DstAlphaFactor,
};

describe('godotBlendState', () => {
  it('resolves MIX, ADD and MUL to the presets that match the ported factors', () => {
    expect(godotBlendState(BlendMode.MIX)).toEqual({ blending: THREE.NormalBlending });
    expect(godotBlendState(BlendMode.ADD)).toEqual({ blending: THREE.AdditiveBlending });
    expect(godotBlendState(BlendMode.MUL)).toEqual({ blending: THREE.MultiplyBlending });
  });

  it('each preset it uses programs the factors Godot programs', () => {
    for (const mode of [BlendMode.MIX, BlendMode.ADD, BlendMode.MUL]) {
      const { blending } = godotBlendState(mode);
      expect(PRESET_FACTORS[blending as number], `preset for mode ${mode}`).toEqual(
        GODOT_BLEND_ATTACHMENTS[mode]
      );
    }
  });

  it('spells SUB and PREMULT_ALPHA out, because no preset matches', () => {
    for (const mode of [BlendMode.SUB, BlendMode.PREMULT_ALPHA]) {
      const attachment = GODOT_BLEND_ATTACHMENTS[mode];
      expect(godotBlendState(mode)).toEqual({
        blending: THREE.CustomBlending,
        blendEquation: THREE_EQUATION[attachment.colorOp],
        blendSrc: THREE_FACTOR[attachment.srcColor],
        blendDst: THREE_FACTOR[attachment.dstColor],
        blendEquationAlpha: THREE_EQUATION[attachment.alphaOp],
        blendSrcAlpha: THREE_FACTOR[attachment.srcAlpha],
        blendDstAlpha: THREE_FACTOR[attachment.dstAlpha],
      });
    }
  });

  it('does not approximate SUB with three’s SubtractiveBlending', () => {
    // three spells that as `FUNC_ADD` with `ZERO / ONE_MINUS_SRC_COLOR`, which
    // is a different operation from Godot's reverse-subtract — the
    // approximation this table replaces.
    expect(godotBlendState(BlendMode.SUB).blending).not.toBe(THREE.SubtractiveBlending);
  });

  it('omits the factor fields entirely for a preset', () => {
    // `undefined` would make `Material.setValues` warn and would let R3F assign
    // over three's own state; the keys must simply be absent.
    expect(Object.keys(godotBlendState(BlendMode.ADD))).toEqual(['blending']);
  });
});
