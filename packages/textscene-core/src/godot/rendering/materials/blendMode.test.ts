/** The ported blend table, pinned as data against `blend_mode_to_blend_attachment`. */

import { describe, expect, it } from 'vitest';
import {
  ALPHA_TO_COVERAGE_ATTACHMENT,
  BlendMode,
  GODOT_BLEND_ATTACHMENTS,
  type GodotBlendAttachment,
} from './blendMode';
import type { EnumValue } from '../../classdb/enumNames.js';

/**
 * `blend_mode_to_blend_attachment` (`material_storage.cpp:651-716`, Godot 4.6.3), one row per
 * `BaseMaterial3D` blend mode, in Godot's vocabulary.
 */
const EXPECTED_ATTACHMENTS: Readonly<Record<EnumValue<typeof BlendMode>, GodotBlendAttachment>> = {
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

describe('GODOT_BLEND_ATTACHMENTS', () => {
  it('holds the attachment Godot programs for every blend mode', () => {
    expect(GODOT_BLEND_ATTACHMENTS).toEqual(EXPECTED_ATTACHMENTS);
  });

  it('declares a row for exactly the five BaseMaterial3D modes (edge case)', () => {
    expect(Object.keys(GODOT_BLEND_ATTACHMENTS).map(Number)).toEqual([
      BlendMode.MIX,
      BlendMode.ADD,
      BlendMode.SUB,
      BlendMode.MUL,
      BlendMode.PREMULT_ALPHA,
    ]);
  });
});

describe('ALPHA_TO_COVERAGE_ATTACHMENT', () => {
  it("keeps MIX's colour pair and stores the source alpha as it is", () => {
    // `material_storage.cpp:691-698`.
    expect(ALPHA_TO_COVERAGE_ATTACHMENT).toEqual({
      ...EXPECTED_ATTACHMENTS[BlendMode.MIX],
      srcAlpha: 'one',
      dstAlpha: 'zero',
    });
  });
});
