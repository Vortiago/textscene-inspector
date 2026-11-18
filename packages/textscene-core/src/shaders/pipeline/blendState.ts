import * as THREE from 'three';
import {
  ALPHA_TO_COVERAGE_ATTACHMENT,
  BlendMode,
  GODOT_BLEND_ATTACHMENTS,
  type GodotBlendAttachment,
  type GodotBlendFactor,
  type GodotBlendOp,
} from '../../godot/rendering/materials/blendMode.js';
import {
  AlphaAntiAliasing,
  type AlphaToCoverageMode,
} from '../../godot/rendering/materials/alphaAntialiasing.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** three's blending state for one Godot blend mode, in three's material property names. */
export interface MaterialBlendState {
  blending: THREE.Blending;
  blendEquation?: THREE.BlendingEquation;
  blendSrc?: THREE.BlendingSrcFactor;
  blendDst?: THREE.BlendingDstFactor;
  blendEquationAlpha?: THREE.BlendingEquation;
  blendSrcAlpha?: THREE.BlendingSrcFactor;
  blendDstAlpha?: THREE.BlendingDstFactor;
}

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

/** The modes a three preset draws with Godot's factors (`WebGLState.setBlending`, non-premultiplied). */
const PRESETS: Readonly<Partial<Record<EnumValue<typeof BlendMode>, THREE.Blending>>> = {
  // `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`, `FUNC_ADD`.
  [BlendMode.MIX]: THREE.NormalBlending,
  // `blendFunc(SRC_ALPHA, ONE)` sets colour and alpha, so alpha gets Godot's pair.
  [BlendMode.ADD]: THREE.AdditiveBlending,
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
export function godotBlendState(mode: EnumValue<typeof BlendMode>): MaterialBlendState {
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
