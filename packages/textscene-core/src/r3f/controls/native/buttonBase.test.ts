/**
 * `buttonBase.ts` — the shared composite (StyleBox chrome + text + icon)
 * logic `nodes/2d/ui/button/nativeSolver.ts` and `Component.tsx` build
 * on. Expected numbers below are hand-derived from `Button::_notification`'s
 * `NOTIFICATION_DRAW` (`scene/gui/button.cpp:203-465`) and
 * `Button::_fit_icon_size` (`:469-479`), NOT recomputed the way the
 * implementation itself computes them — an independent worked example per
 * `AGENTS.md`'s test-authoring rule.
 *
 * `text.offset` is the paragraph's own BOX TOP-LEFT, straight out of the
 * source's formula — the MSDF bake's own line anchor is `<TextRun>`'s to
 * reconcile (`TextRun.test.tsx` pins it), never something this layout adds.
 */
import { describe, expect, it } from 'vitest';
import type { StyleBoxFlatData } from './styleBoxFlat';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_RIGHT,
  VERTICAL_ALIGNMENT_BOTTOM,
  VERTICAL_ALIGNMENT_CENTER,
  VERTICAL_ALIGNMENT_TOP,
  fitIconSize,
  layoutButtonContent,
  pickButtonStyleBox,
  resolveButtonDrawState,
  tintColor,
  tintStyleBox,
  type ButtonContentInput,
} from './buttonBase';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function styleBox(overrides: Partial<StyleBoxFlatData> = {}): StyleBoxFlatData {
  return {
    bgColor: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { ...ZERO_SIDES },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('resolveButtonDrawState', () => {
  it('is "normal" when disabled is false/undefined, "disabled" when true (no hover/pressed/focus — no input modelled)', () => {
    expect(resolveButtonDrawState(undefined)).toBe('normal');
    expect(resolveButtonDrawState(false)).toBe('normal');
    expect(resolveButtonDrawState(true)).toBe('disabled');
  });
});

describe('pickButtonStyleBox', () => {
  const defaults = { normal: styleBox({ bgColor: { r: 1, g: 0, b: 0, a: 1 } }), disabled: styleBox({ bgColor: { r: 0, g: 1, b: 0, a: 1 } }) };

  it('prefers a resolved theme_override_styles entry over the default-theme struct', () => {
    const override = styleBox({ bgColor: { r: 0, g: 0, b: 1, a: 1 } });
    expect(pickButtonStyleBox({ normal: override }, defaults, 'normal')).toBe(override);
  });

  it('falls back to the default-theme struct for the current state when no override resolves', () => {
    expect(pickButtonStyleBox({}, defaults, 'disabled')).toBe(defaults.disabled);
  });

  // `Button::_get_current_stylebox` (`scene/gui/button.cpp:100-148`): every
  // draw-state arm reads `rtl && has_theme_stylebox("<state>_mirrored")`
  // before its plain key.
  it('prefers the <state>_mirrored key under RTL', () => {
    const mirrored = styleBox({ bgColor: { r: 0, g: 0, b: 1, a: 1 } });
    const plain = styleBox({ bgColor: { r: 1, g: 1, b: 0, a: 1 } });
    expect(pickButtonStyleBox({ normal: plain, normal_mirrored: mirrored }, defaults, 'normal', true)).toBe(mirrored);
    expect(pickButtonStyleBox({ disabled_mirrored: mirrored }, defaults, 'disabled', true)).toBe(mirrored);
  });

  it('ignores the <state>_mirrored key under LTR', () => {
    const mirrored = styleBox({ bgColor: { r: 0, g: 0, b: 1, a: 1 } });
    const plain = styleBox({ bgColor: { r: 1, g: 1, b: 0, a: 1 } });
    expect(pickButtonStyleBox({ normal: plain, normal_mirrored: mirrored }, defaults, 'normal', false)).toBe(plain);
    expect(pickButtonStyleBox({ normal_mirrored: mirrored }, defaults, 'normal', false)).toBe(defaults.normal);
  });

  it('falls through to the plain key under RTL when nothing resolved a mirrored one', () => {
    const plain = styleBox({ bgColor: { r: 1, g: 1, b: 0, a: 1 } });
    expect(pickButtonStyleBox({ normal: plain }, defaults, 'normal', true)).toBe(plain);
    expect(pickButtonStyleBox({}, defaults, 'normal', true)).toBe(defaults.normal);
  });
});

describe('tintStyleBox', () => {
  it('returns the SAME reference at opaque-white tint (no-op fast path)', () => {
    const box = styleBox();
    expect(tintStyleBox(box, { r: 1, g: 1, b: 1, a: 1 })).toBe(box);
  });

  it('multiplies BOTH bgColor and borderColor by the tint, in raw sRGB (no linear conversion here)', () => {
    const box = styleBox({ bgColor: { r: 0.8, g: 0.4, b: 0.2, a: 1 }, borderColor: { r: 1, g: 1, b: 1, a: 1 } });
    const tinted = tintStyleBox(box, { r: 0.5, g: 0.5, b: 0.5, a: 0.5 });
    expect(tinted.bgColor).toEqual({ r: 0.4, g: 0.2, b: 0.1, a: 0.5 });
    expect(tinted.borderColor).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 });
  });
});

describe('tintColor', () => {
  it('multiplies a plain ControlColor by the tint componentwise', () => {
    expect(tintColor({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 }, { r: 0.5, g: 0.5, b: 0.5, a: 1 })).toEqual({
      r: 0.4375,
      g: 0.4375,
      b: 0.4375,
      a: 0.5,
    });
  });
});

describe('fitIconSize (Button::_fit_icon_size, button.cpp:469-479)', () => {
  it('leaves the size unchanged when icon_max_width is 0 (the theme default: unclamped)', () => {
    expect(fitIconSize({ x: 40, y: 20 }, 0)).toEqual({ x: 40, y: 20 });
  });

  it('leaves the size unchanged when it is already under icon_max_width', () => {
    expect(fitIconSize({ x: 10, y: 5 }, 20)).toEqual({ x: 10, y: 5 });
  });

  it('clamps width to icon_max_width and scales height to preserve aspect', () => {
    // 40x20 (2:1) clamped to max width 20 -> 20 x (20*20/40) = 20x10.
    expect(fitIconSize({ x: 40, y: 20 }, 20)).toEqual({ x: 20, y: 10 });
  });
});

// --- layoutButtonContent (button.cpp:233-456) ------------------------------

const BASE_INPUT: ButtonContentInput = {
  rectSize: { x: 120, y: 32 },
  styleMargin: { left: 4, top: 4, right: 4, bottom: 4 },
  hSeparation: 4,
  iconMaxWidth: 0,
  textAlignment: HORIZONTAL_ALIGNMENT_LEFT,
  iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
  verticalIconAlignment: VERTICAL_ALIGNMENT_CENTER,
  expandIcon: false,
  iconNaturalSize: null,
  hasText: true,
  textNaturalSize: { x: 50, y: 26 },
  rtl: false,
};

describe('layoutButtonContent — text only, no icon', () => {
  it('LEFT alignment: text starts flush at the style margin', () => {
    const { icon, text } = layoutButtonContent(BASE_INPUT);
    expect(icon).toBeNull();
    expect(text!.offset.x).toBe(4);
    expect(text!.offset.y).toBeCloseTo(3, 10);
  });

  it('CENTER alignment: text centers within the drawable box', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, textAlignment: HORIZONTAL_ALIGNMENT_CENTER });
    // customElementSize.x = 120-4-4=112; (112-50)/2=31; +styleMargin.left(4) = 35.
    expect(text!.offset.x).toBe(35);
  });

  it('RIGHT alignment: text hugs the right edge of the drawable box', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, textAlignment: HORIZONTAL_ALIGNMENT_RIGHT });
    // 112-50=62; +4 = 66.
    expect(text!.offset.x).toBe(66);
  });

  it('returns text: null when hasText is false', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, hasText: false, textNaturalSize: { x: 0, y: 0 } });
    expect(text).toBeNull();
  });
});

/**
 * `button.cpp:437-441` sets the paragraph's own width to
 * `Math::ceil(MAX(1.0f, drawable_size_remained.width))` and hands the
 * alignment to the TextServer, which measures every arm against THAT width
 * and floors its own half (`text_paragraph.cpp:887-922`, the block
 * `TextParagraph::draw` runs). Only the CENTER arm carries the box's own
 * `(drawable - text_buf_width) / 2`, and it is the only arm that does not
 * shift at all once the line is wider than the box (`:902`).
 */
describe('layoutButtonContent — the paragraph box the alignment measures against', () => {
  it('CENTER floors its own half (text_paragraph.cpp:904)', () => {
    // drawable 112, text_buf_width 112, length 51: floor(61/2) = 30, not 30.5.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
      textNaturalSize: { x: 51, y: 26 },
    });
    expect(text!.offset.x).toBe(34);
  });

  it('CENTER measures against the CEILED width and keeps the box offset that ceiling leaves (button.cpp:437,439)', () => {
    // drawable 112.5 -> text_buf_width 113; box offset (112.5 - 113)/2 = -0.25;
    // paragraph shift floor((113 - 50)/2) = 31. 4 - 0.25 + 31 = 34.75.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rectSize: { x: 120.5, y: 32 },
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
    });
    expect(text!.offset.x).toBeCloseTo(34.75, 10);
  });

  it('CENTER does not shift an OVERFLOWING line at all (text_paragraph.cpp:902)', () => {
    // length 200 > text_buf_width 112, so the centring arm is skipped entirely
    // and the else-branch needs an RTL inferred direction this shaper never
    // produces. Only the style margin is left.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
      textNaturalSize: { x: 200, y: 26 },
    });
    expect(text!.offset.x).toBe(4);
  });

  it('RIGHT hugs the CEILED width, not the raw drawable (text_paragraph.cpp:916-922)', () => {
    // drawable 112.5 -> text_buf_width 113; 113 - 50 = 63; + style margin 4.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rectSize: { x: 120.5, y: 32 },
      textAlignment: HORIZONTAL_ALIGNMENT_RIGHT,
    });
    expect(text!.offset.x).toBeCloseTo(67, 10);
  });

  it('a box with no drawable width left still lays out against MAX(1, ...) (button.cpp:437)', () => {
    // rect 8 wide, margins 4+4 -> drawable 0 -> text_buf_width 1. The label
    // overflows it, so CENTER contributes only the box offset (0 - 1)/2.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rectSize: { x: 8, y: 32 },
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
    });
    expect(text!.offset.x).toBeCloseTo(3.5, 10);
  });

  it('LEFT is untouched by all of it — the source adds nothing for it', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rectSize: { x: 120.5, y: 32 } });
    expect(text!.offset.x).toBe(4);
  });
});

describe('layoutButtonContent — icon + text, horizontal icon_alignment', () => {
  const WITH_ICON: ButtonContentInput = {
    ...BASE_INPUT,
    iconNaturalSize: { x: 16, y: 16 },
    textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
  };

  it('icon LEFT: reserves icon+h_separation width, text shifts right and centers in the remainder', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_LEFT });
    expect(icon).toEqual({ rect: { x: 4, y: 8, w: 16, h: 16 } });
    // drawableWidth = 112-(16+4)=92; textOffsetX = 4 + (112-92)=24; + (92-50)/2=21 -> 45.
    expect(text!.offset.x).toBe(45);
  });

  it('icon RIGHT: reserves the SAME width but does NOT shift text past it (Button only special-cases LEFT)', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_RIGHT });
    expect(icon).toEqual({ rect: { x: 100, y: 8, w: 16, h: 16 } });
    // drawableWidth = 92 (same reservation); textOffsetX = 4 + (92-50)/2=21 -> 25.
    expect(text!.offset.x).toBe(25);
  });

  it('icon CENTER: no width reservation at all — text lays out exactly as if there were no icon', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_CENTER });
    // iconX = 4 + (112-16)/2 = 52.
    expect(icon).toEqual({ rect: { x: 52, y: 8, w: 16, h: 16 } });
    expect(text!.offset.x).toBe(35); // identical to the no-icon CENTER case above
  });
});

describe('layoutButtonContent — vertical_icon_alignment', () => {
  const WITH_ICON: ButtonContentInput = {
    ...BASE_INPUT,
    iconNaturalSize: { x: 16, y: 16 },
    iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
    textAlignment: HORIZONTAL_ALIGNMENT_LEFT,
  };

  it('TOP: icon sits at the style margin; text is pushed down by the reserved icon height', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, verticalIconAlignment: VERTICAL_ALIGNMENT_TOP });
    expect(icon).toEqual({ rect: { x: 4, y: 4, w: 16, h: 16 } });
    // drawableHeight = 24-16=8; base y=(8-26)/2+4=-5; TOP adds (24-8)=16 -> 11; + origin.
    expect(text!.offset.y).toBeCloseTo(11, 10);
  });

  it('BOTTOM: icon sits flush at the bottom; text does NOT get the extra TOP-only shift', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, verticalIconAlignment: VERTICAL_ALIGNMENT_BOTTOM });
    expect(icon).toEqual({ rect: { x: 4, y: 12, w: 16, h: 16 } });
    // Same reduced drawableHeight (8) and base y (-5), but no TOP bonus shift.
    expect(text!.offset.y).toBeCloseTo(-5, 10);
  });
});

describe('layoutButtonContent — vertical centring floors like the per-glyph Math::floor(cpos.y) (text_server_adv.cpp:4083)', () => {
  it('floors a half-pixel centring remainder DOWN, matching a 32px Button around 23px-tall SemiBold text', () => {
    // drawableHeight = 32-4-4=24; (24-23)/2=0.5; +styleMargin.top(4)=4.5 -> floor 4.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rectSize: { x: 120, y: 32 },
      textNaturalSize: { x: 50, y: 23 },
    });
    expect(text!.offset.y).toBe(4);
  });
});

describe('layoutButtonContent — expand_icon', () => {
  it('scales the icon to fill the remaining box height, preserving aspect, when it fits within the remaining width', () => {
    const { icon } = layoutButtonContent({
      ...BASE_INPUT,
      expandIcon: true,
      iconNaturalSize: { x: 32, y: 16 }, // 2:1
      iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
      verticalIconAlignment: VERTICAL_ALIGNMENT_CENTER,
    });
    // w=112-(50+4)=58; h=24 (vertical CENTER, not reduced); iw=32*24/16=48 (<=58, no width clamp).
    expect(icon).toEqual({ rect: { x: 4, y: 4, w: 48, h: 24 } });
  });

  it('clamps to the remaining WIDTH instead when the height-driven size would overflow it', () => {
    const { icon } = layoutButtonContent({
      ...BASE_INPUT,
      expandIcon: true,
      iconNaturalSize: { x: 100, y: 16 }, // very wide
      iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
      verticalIconAlignment: VERTICAL_ALIGNMENT_CENTER,
    });
    // w=58, h=24; iw=100*24/16=150 > 58 -> iw=58, ih=16*58/100=9.28 -> round 9.
    // iconY (vertical CENTER) = 4 + (24-9)/2 = 4+7.5=11.5 -> floor 11.
    expect(icon).toEqual({ rect: { x: 4, y: 11, w: 58, h: 9 } });
  });
});

describe('layoutButtonContent — icon_max_width clamps the FINAL icon size', () => {
  it('clamps a non-expanding icon before it is positioned', () => {
    const { icon } = layoutButtonContent({
      ...BASE_INPUT,
      iconMaxWidth: 20,
      iconNaturalSize: { x: 40, y: 20 },
      iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
    });
    // fitIconSize(40x20, 20) = 20x10.
    expect(icon).toEqual({ rect: { x: 4, y: 11, w: 20, h: 10 } });
  });
});

describe('layoutButtonContent — no icon at all', () => {
  it('returns icon: null and leaves text layout exactly as the no-icon case', () => {
    const { icon, text } = layoutButtonContent({ ...BASE_INPUT, iconNaturalSize: { x: 0, y: 0 } });
    expect(icon).toBeNull();
    expect(text!.offset.x).toBe(4);
  });
});

/**
 * `Button::_notification`'s RTL side swap (`scene/gui/button.cpp:262-276`):
 *
 *     if (is_layout_rtl()) {
 *       if (horizontal_icon_alignment == HORIZONTAL_ALIGNMENT_RIGHT) { icon_align_rtl_checked = LEFT; }
 *       else if (horizontal_icon_alignment == HORIZONTAL_ALIGNMENT_LEFT) { icon_align_rtl_checked = RIGHT; }
 *       if (alignment == HORIZONTAL_ALIGNMENT_RIGHT) { align_rtl_checked = LEFT; }
 *       else if (alignment == HORIZONTAL_ALIGNMENT_LEFT) { align_rtl_checked = RIGHT; }
 *     }
 *
 * CENTER is absent from both ladders, so it never moves. Everything below the
 * swap (`:277-456`) then reads the swapped values and nothing else, so the
 * expected pixels are the LTR ones of the OPPOSITE alignment.
 */
describe('layoutButtonContent — RTL swaps the text alignment side', () => {
  it('lays LEFT-aligned text out at the RIGHT edge of the drawable box', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rtl: true });
    // align_rtl_checked = RIGHT: 4 (style margin) + (112 - 50) = 66.
    expect(text!.offset.x).toBe(66);
  });

  it('lays RIGHT-aligned text out flush at the style margin', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rtl: true, textAlignment: HORIZONTAL_ALIGNMENT_RIGHT });
    expect(text!.offset.x).toBe(4);
  });

  it('leaves CENTER-aligned text where LTR puts it', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rtl: true, textAlignment: HORIZONTAL_ALIGNMENT_CENTER });
    expect(text!.offset.x).toBe(35);
  });
});

describe('layoutButtonContent — RTL swaps the icon side', () => {
  const WITH_ICON: ButtonContentInput = {
    ...BASE_INPUT,
    rtl: true,
    iconNaturalSize: { x: 16, y: 16 },
    textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
  };

  it('draws a LEFT icon at the right edge, and stops shifting the text past it', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_LEFT });
    // icon_align_rtl_checked = RIGHT: x = 120 - 4 - 16 = 100; y = 4 + (24-16)/2 = 8.
    expect(icon).toEqual({ rect: { x: 100, y: 8, w: 16, h: 16 } });
    // drawableWidth = 112-(16+4)=92; the LEFT-icon shift (`:449`) no longer applies: 4 + (92-50)/2 = 25.
    expect(text!.offset.x).toBe(25);
  });

  it('draws a RIGHT icon at the left edge, and shifts the text past it', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_RIGHT });
    // icon_align_rtl_checked = LEFT: x = style margin 4.
    expect(icon).toEqual({ rect: { x: 4, y: 8, w: 16, h: 16 } });
    // 4 + (112-92) + (92-50)/2 = 4 + 20 + 21 = 45.
    expect(text!.offset.x).toBe(45);
  });

  it('leaves a CENTER icon, and the text beside it, exactly where LTR puts them', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_CENTER });
    expect(icon).toEqual({ rect: { x: 52, y: 8, w: 16, h: 16 } });
    expect(text!.offset.x).toBe(35);
  });
});
