/**
 * Blend-state parity with `blend_mode_to_blend_attachment`
 * (servers/rendering/renderer_rd/storage_rd/material_storage.cpp:651-716), which the canvas
 * renderer calls (renderer_canvas_render_rd.cpp:1516). The table below transcribes that switch.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canvasItemBlendState } from './build';
import { decodeCanvasItemMaterial } from './decode';
import { CanvasItemBlendMode, CanvasItemLightMode } from './types';

/** Godot's RD blend factors/ops in three's constants. */
const SRC_ALPHA = THREE.SrcAlphaFactor;
const ONE_MINUS_SRC_ALPHA = THREE.OneMinusSrcAlphaFactor;
const ONE = THREE.OneFactor;
const ZERO = THREE.ZeroFactor;
const DST_COLOR = THREE.DstColorFactor;
const DST_ALPHA = THREE.DstAlphaFactor;
const OP_ADD = THREE.AddEquation;
const OP_REVERSE_SUBTRACT = THREE.ReverseSubtractEquation;

interface GodotAttachment {
  colorOp: THREE.BlendingEquation;
  colorSrc: THREE.BlendingSrcFactor;
  colorDst: THREE.BlendingDstFactor;
  alphaOp: THREE.BlendingEquation;
  alphaSrc: THREE.BlendingSrcFactor;
  alphaDst: THREE.BlendingDstFactor;
  premultipliedAlpha: boolean;
}

/** `blend_mode_to_blend_attachment`, case by case (cpp:655-708). */
const GODOT: Array<[CanvasItemBlendMode, string, GodotAttachment]> = [
  [
    CanvasItemBlendMode.ADD,
    'ADD (cpp:664-672)',
    {
      colorOp: OP_ADD,
      colorSrc: SRC_ALPHA,
      colorDst: ONE,
      alphaOp: OP_ADD,
      alphaSrc: SRC_ALPHA,
      alphaDst: ONE,
      premultipliedAlpha: false,
    },
  ],
  [
    CanvasItemBlendMode.SUB,
    'SUB — reverse subtract (cpp:673-681)',
    {
      colorOp: OP_REVERSE_SUBTRACT,
      colorSrc: SRC_ALPHA,
      colorDst: ONE,
      alphaOp: OP_REVERSE_SUBTRACT,
      alphaSrc: SRC_ALPHA,
      alphaDst: ONE,
      premultipliedAlpha: false,
    },
  ],
  [
    CanvasItemBlendMode.MUL,
    'MUL — alpha multiplies too (cpp:682-690)',
    {
      colorOp: OP_ADD,
      colorSrc: DST_COLOR,
      colorDst: ZERO,
      alphaOp: OP_ADD,
      alphaSrc: DST_ALPHA,
      alphaDst: ZERO,
      premultipliedAlpha: false,
    },
  ],
  [
    CanvasItemBlendMode.PREMULT_ALPHA,
    'PREMULT_ALPHA (cpp:700-708)',
    {
      colorOp: OP_ADD,
      colorSrc: ONE,
      colorDst: ONE_MINUS_SRC_ALPHA,
      alphaOp: OP_ADD,
      alphaSrc: ONE,
      alphaDst: ONE_MINUS_SRC_ALPHA,
      // Factors only: Godot's canvas shader never premultiplies in-shader,
      // so three's flag (which adds `rgb *= a`) must stay off (see build.ts).
      premultipliedAlpha: false,
    },
  ],
];

describe('canvasItemBlendState', () => {
  it.each(GODOT)('encodes Godot %s: %s', (mode, _label, godot) => {
    const state = canvasItemBlendState(mode);
    expect(state.blending).toBe(THREE.CustomBlending);
    expect(state.blendEquation).toBe(godot.colorOp);
    expect(state.blendSrc).toBe(godot.colorSrc);
    expect(state.blendDst).toBe(godot.colorDst);
    expect(state.blendEquationAlpha).toBe(godot.alphaOp);
    expect(state.blendSrcAlpha).toBe(godot.alphaSrc);
    expect(state.blendDstAlpha).toBe(godot.alphaDst);
    expect(state.premultipliedAlpha).toBe(godot.premultipliedAlpha);
  });

  it('leaves MIX to NormalBlending, which is Godot MIX exactly (cpp:655-662)', () => {
    // Godot MIX: colour SRC_ALPHA / ONE_MINUS_SRC_ALPHA, alpha ONE /
    // ONE_MINUS_SRC_ALPHA, both ADD: the pair three's NormalBlending sets for a
    // straight-alpha material, so no custom factors are needed and none are set.
    const state = canvasItemBlendState(CanvasItemBlendMode.MIX);
    expect(state.blending).toBe(THREE.NormalBlending);
    expect(state.premultipliedAlpha).toBe(false);
    expect(state.blendSrc).toBeUndefined();
    expect(state.blendDst).toBeUndefined();
    expect(state.blendEquation).toBeUndefined();
  });

  it('covers every authorable blend mode (cpp:268-272)', () => {
    // The five BIND_ENUM_CONSTANTs are the modes a scene can carry; each must
    // resolve to a state, and only MIX may be the preset one.
    const authorable = [
      CanvasItemBlendMode.MIX,
      CanvasItemBlendMode.ADD,
      CanvasItemBlendMode.SUB,
      CanvasItemBlendMode.MUL,
      CanvasItemBlendMode.PREMULT_ALPHA,
    ];
    const custom = authorable.filter(
      (mode) => canvasItemBlendState(mode).blending === THREE.CustomBlending
    );
    expect(custom).toEqual(authorable.filter((mode) => mode !== CanvasItemBlendMode.MIX));
  });

  it('never sets three\'s in-shader premultiply — Godot only programs blend factors', () => {
    // Godot's premult mode is blend attachments alone (cpp:700-708); three's
    // premultipliedAlpha adds `rgb *= a` in-shader, which would premultiply a
    // straight-alpha texture twice against Godot's output.
    const premultiplied = [
      CanvasItemBlendMode.MIX,
      CanvasItemBlendMode.ADD,
      CanvasItemBlendMode.SUB,
      CanvasItemBlendMode.MUL,
      CanvasItemBlendMode.PREMULT_ALPHA,
    ].filter((mode) => canvasItemBlendState(mode).premultipliedAlpha);
    expect(premultiplied).toEqual([]);
  });

  it('falls back to MIX for the unauthorable DISABLED mode (h:45, unbound)', () => {
    // BLEND_MODE_DISABLED is in the C++ enum but bound to neither the script API
    // nor the inspector hint, so decode rejects a `blend_mode = 5` first; the
    // build half still has to answer, and MIX is the safe answer.
    const disabled = 5 as CanvasItemBlendMode;
    expect(canvasItemBlendState(disabled)).toEqual(canvasItemBlendState(CanvasItemBlendMode.MIX));
    expect(decodeCanvasItemMaterial({ blend_mode: '5' }).blendMode).toBe(CanvasItemBlendMode.MIX);
  });

  it('is independent of light_mode — unshaded and light_only blend the same', () => {
    // light_mode selects which 2D lights reach the item (canvasItemLighting),
    // never how its pixels combine, so the blend state must not move with it.
    const forMode = (lightMode: CanvasItemLightMode) =>
      canvasItemBlendState(
        decodeCanvasItemMaterial({ blend_mode: '1', light_mode: String(lightMode) }).blendMode
      );
    expect(forMode(CanvasItemLightMode.UNSHADED)).toEqual(forMode(CanvasItemLightMode.NORMAL));
    expect(forMode(CanvasItemLightMode.LIGHT_ONLY)).toEqual(forMode(CanvasItemLightMode.NORMAL));
  });

  it('blends a material with no blend_mode at all as MIX (the decode default)', () => {
    const state = canvasItemBlendState(decodeCanvasItemMaterial({}).blendMode);
    expect(state).toEqual(canvasItemBlendState(CanvasItemBlendMode.MIX));
  });
});
