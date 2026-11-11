/**
 * Expected numbers are hand-derived from `Button::_notification`
 * (`scene/gui/button.cpp:203-465`) and `Button::_fit_icon_size` (`:469-479`), not
 * recomputed as the code does. `text.offset` is the paragraph box's top-left: the
 * line anchor is `<TextRun>`'s (`TextRun.test.tsx`).
 */
import { describe, expect, it } from 'vitest';
import type { StyleBoxFlatData } from './styleBoxFlat';
import {
  buttonContentSize,
  buttonDrawnLabel,
  fitIconSize,
  iconOnlyButtonIconRectIn,
  layoutButtonContent,
  pickButtonStyleBox,
  resolveToggleDrawState,
  textMinimumWidthPx,
  tintColor,
  trimButtonLabel,
  type ButtonContentInput,
} from './buttonBase';
import { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import { shapeText, type TextLineLayout } from './text/textLayout';
import { visualChars } from './text/textLayout.testkit';
import { OPEN_SANS_FONT_METRICS } from './text/openSansFontMetrics';
import { AutowrapMode, OverrunBehavior } from '../../../godot/text/textServerEnums';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

const { HORIZONTAL_ALIGNMENT_CENTER, HORIZONTAL_ALIGNMENT_LEFT, HORIZONTAL_ALIGNMENT_RIGHT } =
  HorizontalAlignment;
const { VERTICAL_ALIGNMENT_CENTER, VERTICAL_ALIGNMENT_TOP, VERTICAL_ALIGNMENT_BOTTOM } = VerticalAlignment;

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

describe('resolveToggleDrawState', () => {
  it('is "normal" when disabled and pressed are false or undefined', () => {
    expect(resolveToggleDrawState(undefined, undefined)).toBe('normal');
    expect(resolveToggleDrawState(false, false)).toBe('normal');
  });

  it('is "pressed" for a toggle that is on', () => {
    expect(resolveToggleDrawState(false, true)).toBe('pressed');
  });

  it('is "disabled" over a toggle that is on (base_button.cpp:326-328)', () => {
    expect(resolveToggleDrawState(true, true)).toBe('disabled');
  });
});

describe('pickButtonStyleBox', () => {
  const defaults = {
    normal: styleBox({ bgColor: { r: 1, g: 0, b: 0, a: 1 } }),
    disabled: styleBox({ bgColor: { r: 0, g: 1, b: 0, a: 1 } }),
  };

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
    expect(pickButtonStyleBox({ normal: plain, normal_mirrored: mirrored }, defaults, 'normal', true)).toBe(
      mirrored
    );
    expect(pickButtonStyleBox({ disabled_mirrored: mirrored }, defaults, 'disabled', true)).toBe(mirrored);
  });

  it('ignores the <state>_mirrored key under LTR', () => {
    const mirrored = styleBox({ bgColor: { r: 0, g: 0, b: 1, a: 1 } });
    const plain = styleBox({ bgColor: { r: 1, g: 1, b: 0, a: 1 } });
    expect(pickButtonStyleBox({ normal: plain, normal_mirrored: mirrored }, defaults, 'normal', false)).toBe(
      plain
    );
    expect(pickButtonStyleBox({ normal_mirrored: mirrored }, defaults, 'normal', false)).toBe(
      defaults.normal
    );
  });

  it('falls through to the plain key under RTL when nothing resolved a mirrored one', () => {
    const plain = styleBox({ bgColor: { r: 1, g: 1, b: 0, a: 1 } });
    expect(pickButtonStyleBox({ normal: plain }, defaults, 'normal', true)).toBe(plain);
    expect(pickButtonStyleBox({}, defaults, 'normal', true)).toBe(defaults.normal);
  });
});

describe('tintColor', () => {
  it('multiplies a plain colour by the tint componentwise', () => {
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
  isTextRtl: false,
  isClipped: false,
  rtl: false,
};

describe('layoutButtonContent: text only, no icon', () => {
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
 * `button.cpp:437-441` sets the paragraph width to
 * `Math::ceil(MAX(1.0f, drawable_size_remained.width))`, and every arm measures
 * against it (`text_paragraph.cpp:887-922`). Only CENTER adds
 * `(drawable - text_buf_width) / 2`, and stops shifting once the line overflows (`:902`).
 */
describe('layoutButtonContent: the paragraph box the alignment measures against', () => {
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

  it('CENTER does not shift an OVERFLOWING left-to-right line at all (text_paragraph.cpp:902)', () => {
    // length 200 > text_buf_width 112, so the centring arm is skipped. Only the style margin is left.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
      textNaturalSize: { x: 200, y: 26 },
    });
    expect(text!.offset.x).toBe(4);
  });

  it('CENTER ends an OVERFLOWING right-to-left line at the trailing edge (text_paragraph.cpp:908-910)', () => {
    // 112 - 200 = -88, after the style margin 4.
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
      textNaturalSize: { x: 200, y: 26 },
      isTextRtl: true,
    });
    expect(text!.offset.x).toBe(-84);
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

  it('LEFT is untouched by all of it: the source adds nothing for it', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rectSize: { x: 120.5, y: 32 } });
    expect(text!.offset.x).toBe(4);
  });
});

describe('layoutButtonContent: icon + text, horizontal icon_alignment', () => {
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

  it('icon CENTER: no width reservation at all: text lays out exactly as if there were no icon', () => {
    const { icon, text } = layoutButtonContent({ ...WITH_ICON, iconAlignment: HORIZONTAL_ALIGNMENT_CENTER });
    // iconX = 4 + (112-16)/2 = 52.
    expect(icon).toEqual({ rect: { x: 52, y: 8, w: 16, h: 16 } });
    expect(text!.offset.x).toBe(35); // identical to the no-icon CENTER case above
  });
});

describe('layoutButtonContent: vertical_icon_alignment', () => {
  const WITH_ICON: ButtonContentInput = {
    ...BASE_INPUT,
    iconNaturalSize: { x: 16, y: 16 },
    iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
    textAlignment: HORIZONTAL_ALIGNMENT_LEFT,
  };

  it('TOP: icon sits at the style margin; text is pushed down by the reserved icon height', () => {
    const { icon, text } = layoutButtonContent({
      ...WITH_ICON,
      verticalIconAlignment: VERTICAL_ALIGNMENT_TOP,
    });
    expect(icon).toEqual({ rect: { x: 4, y: 4, w: 16, h: 16 } });
    // drawableHeight = 24-16=8; base y=(8-26)/2+4=-5; TOP adds (24-8)=16 -> 11; + origin.
    expect(text!.offset.y).toBeCloseTo(11, 10);
  });

  it('BOTTOM: icon sits flush at the bottom; text does NOT get the extra TOP-only shift', () => {
    const { icon, text } = layoutButtonContent({
      ...WITH_ICON,
      verticalIconAlignment: VERTICAL_ALIGNMENT_BOTTOM,
    });
    expect(icon).toEqual({ rect: { x: 4, y: 12, w: 16, h: 16 } });
    // Same reduced drawableHeight (8) and base y (-5), but no TOP bonus shift.
    expect(text!.offset.y).toBeCloseTo(-5, 10);
  });
});

describe('layoutButtonContent: vertical centring floors like the per-glyph Math::floor(cpos.y) (text_server_adv.cpp:4083)', () => {
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

describe('layoutButtonContent: expand_icon', () => {
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

describe('layoutButtonContent: expand_icon under a clipped label', () => {
  it('leaves the text out of the icon width, as `!is_clipped` skips the subtraction (button.cpp:345)', () => {
    const { icon } = layoutButtonContent({
      ...BASE_INPUT,
      expandIcon: true,
      isClipped: true,
      iconNaturalSize: { x: 100, y: 16 },
    });
    // w=112, h=24; iw=150 > 112 -> iw=112, ih=16*112/100=17.92 -> round 18.
    expect(icon).toEqual({ rect: { x: 4, y: 7, w: 112, h: 18 } });
  });
});

describe('layoutButtonContent: expand_icon with no room left', () => {
  it('draws no icon but still takes its negative size off the text box (button.cpp:349-405)', () => {
    // 56x62, margins 10/8, text 36x30: w=36-(36+4)=-4, h=46-30=16; iw=16>w -> iw=ih=-4.
    const { icon, iconReserve, drawableSize } = layoutButtonContent({
      ...BASE_INPUT,
      rectSize: { x: 56, y: 62 },
      styleMargin: { left: 10, top: 8, right: 10, bottom: 8 },
      textNaturalSize: { x: 36, y: 30 },
      expandIcon: true,
      iconNaturalSize: { x: 24, y: 24 },
      verticalIconAlignment: VERTICAL_ALIGNMENT_TOP,
    });
    expect(icon).toBeNull();
    expect(iconReserve).toEqual({ x: -4, y: -4 });
    expect(drawableSize).toEqual({ x: 36, y: 50 });
  });
});

describe('layoutButtonContent: an icon with no area to draw', () => {
  const input = {
    ...BASE_INPUT,
    rectSize: { x: 56, y: 62 },
    styleMargin: { left: 10, top: 8, right: 10, bottom: 8 },
    textNaturalSize: { x: 36, y: 30 },
    iconAlignment: HORIZONTAL_ALIGNMENT_LEFT,
  };

  it('draws no icon at exactly zero room, and reserves zero plus the separation (button.cpp:349-405)', () => {
    // The box is 20 wide inside 10/10 margins and the text has no width, so w = 0 and iw = ih = 0.
    const { icon, iconReserve, drawableSize } = layoutButtonContent({
      ...input,
      textNaturalSize: { x: 0, y: 30 },
      hasText: true,
      hSeparation: 0,
      expandIcon: true,
      iconNaturalSize: { x: 24, y: 24 },
      verticalIconAlignment: VERTICAL_ALIGNMENT_TOP,
      rectSize: { x: 20, y: 46 },
    });
    expect(iconReserve?.x).toBe(0);
    expect(icon).toBeNull();
    expect(drawableSize.x).toBe(0);
  });

  it('keeps a 1x0 icon (100x1 clamped by icon_max_width 1) and reserves its width and the separation', () => {
    const { icon, iconReserve, drawableSize } = layoutButtonContent({
      ...input,
      iconMaxWidth: 1,
      iconNaturalSize: { x: 100, y: 1 },
    });
    expect(iconReserve).toEqual({ x: 1, y: 0 });
    expect(icon!.rect.w).toBe(1);
    expect(drawableSize.x).toBe(36 - 1 - 4);
  });
});

describe('layoutButtonContent: icon_max_width clamps the FINAL icon size', () => {
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

describe('layoutButtonContent: no icon at all', () => {
  it('returns icon: null and leaves text layout exactly as the no-icon case', () => {
    const { icon, text } = layoutButtonContent({ ...BASE_INPUT, iconNaturalSize: { x: 0, y: 0 } });
    expect(icon).toBeNull();
    expect(text!.offset.x).toBe(4);
  });
});

/**
 * `Button::_notification` swaps LEFT and RIGHT for icon and text under RTL
 * (`scene/gui/button.cpp:262-276`), and CENTER never moves. The rest (`:277-456`)
 * reads only the swapped values, so the expected pixels are the LTR ones of the
 * opposite alignment.
 */
describe('layoutButtonContent: RTL swaps the text alignment side', () => {
  it('lays LEFT-aligned text out at the RIGHT edge of the drawable box', () => {
    const { text } = layoutButtonContent({ ...BASE_INPUT, rtl: true });
    // align_rtl_checked = RIGHT: 4 (style margin) + (112 - 50) = 66.
    expect(text!.offset.x).toBe(66);
  });

  it('lays RIGHT-aligned text out flush at the style margin', () => {
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rtl: true,
      textAlignment: HORIZONTAL_ALIGNMENT_RIGHT,
    });
    expect(text!.offset.x).toBe(4);
  });

  it('leaves CENTER-aligned text where LTR puts it', () => {
    const { text } = layoutButtonContent({
      ...BASE_INPUT,
      rtl: true,
      textAlignment: HORIZONTAL_ALIGNMENT_CENTER,
    });
    expect(text!.offset.x).toBe(35);
  });
});

describe('layoutButtonContent: RTL swaps the icon side', () => {
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

/** `a`..`j` and `klmno`, each glyph a 10 px advance at pen x 0, 10, 20, and so on. */
function lineOf(text: string): TextLineLayout {
  const glyphs = [...text].map((char, index) => ({
    char,
    x: index * 10,
    advance: 10,
    glyph: null,
    fontSizePx: 10,
    fontMetrics: OPEN_SANS_FONT_METRICS,
  }));
  return { text, glyphs, widthPx: glyphs.length * 10, paragraphIndex: 0 };
}

describe('buttonDrawnLabel: each line cut to the paragraph box as TextParagraph::draw cuts it', () => {
  const WIDE = lineOf('abcdefghij');

  it('LEFT keeps the leading glyphs that fit the box', () => {
    const [drawn] = buttonDrawnLabel([WIDE], 35, HORIZONTAL_ALIGNMENT_LEFT);
    expect(drawn!.line.text).toBe('abc');
    expect(drawn!.offsetXPx).toBe(0);
  });

  it('CENTER starts an overflowing line at the box edge, so it cuts as LEFT does', () => {
    const [drawn] = buttonDrawnLabel([WIDE], 35, HORIZONTAL_ALIGNMENT_CENTER);
    expect(drawn!.line.text).toBe('abc');
    expect(drawn!.offsetXPx).toBe(0);
  });

  it('CENTER keeps the ceiling leftover of a fractional box as the line offset', () => {
    const [drawn] = buttonDrawnLabel([WIDE], 34.5, HORIZONTAL_ALIGNMENT_CENTER);
    expect(drawn!.offsetXPx).toBe(-0.25);
  });

  it('RIGHT keeps the trailing glyphs, placed at the trailing edge', () => {
    const [drawn] = buttonDrawnLabel([WIDE], 35, HORIZONTAL_ALIGNMENT_RIGHT);
    expect(drawn!.line.text).toBe('hij');
    expect(drawn!.offsetXPx).toBe(-65);
  });

  it('returns a line that fits whole, centred by a floored half of the slack', () => {
    const line = lineOf('abc');
    const [drawn] = buttonDrawnLabel([line], 45, HORIZONTAL_ALIGNMENT_CENTER);
    expect(drawn!.line).toBe(line);
    expect(drawn!.offsetXPx).toBe(7);
  });

  it('cuts each line of a wrapped label on its own', () => {
    const drawn = buttonDrawnLabel([lineOf('abcdef'), lineOf('gh')], 35, HORIZONTAL_ALIGNMENT_LEFT);
    expect(drawn.map((entry) => entry.line.text)).toEqual(['abc', 'gh']);
  });
});

describe('textMinimumWidthPx: the label width a minimum size keeps (button.cpp:493-495)', () => {
  it('keeps the measured width, ceiled, with no clipping property', () => {
    expect(textMinimumWidthPx(40.2, {})).toBe(41);
  });

  it('drops the width under clip_text', () => {
    expect(textMinimumWidthPx(40.2, { clipText: true })).toBe(0);
  });

  it.each([
    OverrunBehavior.OVERRUN_TRIM_CHAR,
    OverrunBehavior.OVERRUN_TRIM_WORD,
    OverrunBehavior.OVERRUN_TRIM_ELLIPSIS,
    OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS,
    OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE,
    OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS_FORCE,
  ])('drops the width under text_overrun_behavior %i', (overrunBehavior) => {
    expect(textMinimumWidthPx(40.2, { overrunBehavior })).toBe(0);
  });

  it('keeps the width under OVERRUN_NO_TRIMMING', () => {
    expect(textMinimumWidthPx(40.2, { overrunBehavior: OverrunBehavior.OVERRUN_NO_TRIMMING })).toBe(41);
  });
});

describe('trimButtonLabel: the label trimmed to its paragraph box (button.cpp:428-432, text_paragraph.cpp:286-293)', () => {
  const FONT_SIZE_PX = 16;
  const UNWRAPPED = { isWrapped: false, fontSizePx: FONT_SIZE_PX, isDrawnRtl: false };

  function shaped(
    text: string,
    boxWidthPx = 0,
    autowrapMode: EnumValue<typeof AutowrapMode> = AutowrapMode.AUTOWRAP_OFF
  ) {
    return shapeText(text, {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx,
      autowrapMode,
      lineSpacingPx: 0,
      fontMetrics: OPEN_SANS_FONT_METRICS,
    });
  }

  it('trims a line wider than the box', () => {
    const layout = shaped('alpha bravo charlie');
    const trimmed = trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, 60, UNWRAPPED);
    expect(trimmed.lines[0]!.widthPx).toBeLessThanOrEqual(60);
    expect(visualChars(trimmed.lines[0]!).length).toBeLessThan(visualChars(layout.lines[0]!).length);
  });

  it('keeps a line that fits', () => {
    const layout = shaped('alpha');
    expect(trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, 200, UNWRAPPED)).toBe(layout);
  });

  it('keeps every line of a wrapped label', () => {
    const layout = shaped('alpha bravo charlie', 40, AutowrapMode.AUTOWRAP_WORD);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(
      trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, 40, { ...UNWRAPPED, isWrapped: true })
    ).toBe(layout);
  });

  it('keeps the label under OVERRUN_NO_TRIMMING', () => {
    const layout = shaped('alpha bravo charlie');
    expect(trimButtonLabel(layout, OverrunBehavior.OVERRUN_NO_TRIMMING, 60, UNWRAPPED)).toBe(layout);
  });

  it('trims at the ceiled box width, with a floor of 1 px', () => {
    const layout = shaped('alpha bravo charlie');
    const atCeil = trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, 59.2, UNWRAPPED);
    expect(atCeil.lines[0]).toEqual(
      trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, 60, UNWRAPPED).lines[0]
    );
    expect(trimButtonLabel(layout, OverrunBehavior.OVERRUN_TRIM_CHAR, -5, UNWRAPPED).lines[0]!.widthPx).toBe(
      0
    );
  });
});

describe('iconOnlyButtonIconRect: an icon with no text sits at the left margin and floors its centred y (button.cpp:349-405)', () => {
  const margin = { left: 4, top: 4, right: 4, bottom: 4 };

  it("puts a 16px icon of a 28x31 button at (4, 7), as pnpm ref:godot measures text_type's script icon", () => {
    // x: style margin 4. y: floor((31 - 8 - 16) / 2) = 3, plus margin 4.
    expect(iconOnlyButtonIconRectIn({ x: 0, y: 0, w: 28, h: 31 }, margin, { x: 16, y: 16 }, false)).toEqual({
      x: 4,
      y: 7,
      w: 16,
      h: 16,
    });
  });

  it('offsets the icon by the button position in iconOnlyButtonIconRectIn', () => {
    const box = { x: 10, y: 20, w: 28, h: 31 };
    expect(iconOnlyButtonIconRectIn(box, margin, { x: 16, y: 16 }, false)).toEqual({
      x: 14,
      y: 27,
      w: 16,
      h: 16,
    });
  });

  it('puts the icon on the trailing edge in a right-to-left layout', () => {
    expect(iconOnlyButtonIconRectIn({ x: 0, y: 0, w: 28, h: 31 }, margin, { x: 16, y: 16 }, true)).toEqual({
      x: 8,
      y: 7,
      w: 16,
      h: 16,
    });
  });

  it('floors a centred icon of a 29x31 button to whole pixels (icon_alignment CENTER)', () => {
    expect(
      iconOnlyButtonIconRectIn(
        { x: 0, y: 0, w: 29, h: 31 },
        margin,
        { x: 16, y: 16 },
        false,
        HORIZONTAL_ALIGNMENT_CENTER
      )
    ).toEqual({
      x: 6,
      y: 7,
      w: 16,
      h: 16,
    });
  });
});

describe('buttonContentSize', () => {
  const left = HORIZONTAL_ALIGNMENT_LEFT;
  const center = HORIZONTAL_ALIGNMENT_CENTER;
  const base = {
    textSize: { x: 50, y: 20 },
    hasText: true,
    hSeparation: 4,
    verticalIconAlignment: VERTICAL_ALIGNMENT_CENTER,
  };

  it('adds a side icon and the separation to the text width and floors the height on the icon', () => {
    const size = buttonContentSize({ ...base, iconSize: { x: 16, y: 24 }, iconAlignment: left });
    expect(size).toEqual({ x: 70, y: 24 });
  });

  it('takes the wider of the text and a centred icon', () => {
    const size = buttonContentSize({ ...base, iconSize: { x: 80, y: 16 }, iconAlignment: center });
    expect(size).toEqual({ x: 80, y: 20 });
  });

  it('is the text alone without an icon', () => {
    expect(buttonContentSize({ ...base, iconSize: null, iconAlignment: left })).toEqual({ x: 50, y: 20 });
  });
});
