/**
 * `linkbutton/nativeSolver.ts` vs Godot 4.6.3 (`scene/gui/link_button.cpp`,
 * `scene/theme/default_theme.cpp:196-210`). Expected numbers are
 * hand-derived from the source, not recomputed the way the implementation
 * itself computes them — same vendored OpenSans_SemiBold metrics other
 * Button-family slices cite (`unitsPerEm=2048`, `ascent=2189`, `descent=600`;
 * 'A' hmtx advance 1354 design units).
 *
 * At font size 16: ascentPx=ceil(2189*16/2048)=18, descentPx=ceil(600*16/2048)=5,
 * linePitchPx (lineSpacingPx 0, LinkButton reads no `line_spacing` key) = 23.
 * 'A' advance = 1354*(16/2048) = 10.578125, shaped (ceiled) width = 11.
 * `getUnderlinePositionPx(16)` = 0.9765625, `getUnderlineThicknessPx(16)` =
 * 0.390625 — `openSansMetrics.ts`'s own worked examples.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { LinkButtonProperties } from './types';
import {
  linkButtonMinimumSize,
  linkButtonTextTheme,
  resolveLinkButtonDrawState,
  shouldUnderline,
  linkButtonUnderlineSpacing,
  linkButtonUnderlineGeometry,
  linkButtonTextPlacement,
  LINKBUTTON_DEFAULT_FONT_COLOR,
  LINKBUTTON_DEFAULT_PRESSED_FONT_COLOR,
  LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(props: Partial<LinkButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'L',
    node: { name: 'L', type: 'LinkButton', children: [], properties: { name: 'L', ...props } as LinkButtonProperties },
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors` (the walker folds it in unconditionally), not props.
    colors: props.themeOverrideColors ?? {},
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('resolveLinkButtonDrawState', () => {
  it('is "normal" when neither pressed nor disabled', () => {
    expect(resolveLinkButtonDrawState({} as LinkButtonProperties)).toBe('normal');
  });

  it('is "pressed" when button_pressed is true and not disabled', () => {
    expect(resolveLinkButtonDrawState({ buttonPressed: true } as LinkButtonProperties)).toBe('pressed');
  });

  it('is "disabled" when disabled is true, even if also pressed', () => {
    expect(resolveLinkButtonDrawState({ buttonPressed: true, disabled: true } as LinkButtonProperties)).toBe(
      'disabled'
    );
  });
});

describe('linkButtonTextTheme', () => {
  it('resolves control_font_color for the normal state', () => {
    expect(linkButtonTextTheme(node({}), {} as LinkButtonProperties, 'normal', ctx()).color).toEqual(
      LINKBUTTON_DEFAULT_FONT_COLOR
    );
  });

  it('resolves control_font_pressed_color (opaque white) for the pressed state', () => {
    expect(linkButtonTextTheme(node({}), {} as LinkButtonProperties, 'pressed', ctx()).color).toEqual(
      LINKBUTTON_DEFAULT_PRESSED_FONT_COLOR
    );
  });

  it('resolves OPAQUE BLACK for the disabled state — no font_disabled_color anywhere in its ClassDB chain', () => {
    expect(linkButtonTextTheme(node({}), {} as LinkButtonProperties, 'disabled', ctx()).color).toEqual(
      LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR
    );
    expect(LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('a theme_override_colors/font_color override wins over the default', () => {
    const props: LinkButtonProperties = {
      name: 'L',
      themeOverrideColors: { font_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(linkButtonTextTheme(node(props), props, 'normal', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('shouldUnderline (link_button.cpp:249-278)', () => {
  it('normal: underlines only on UNDERLINE_MODE_ALWAYS (0)', () => {
    expect(shouldUnderline('normal', 0)).toBe(true);
    expect(shouldUnderline('normal', 1)).toBe(false);
    expect(shouldUnderline('normal', 2)).toBe(false);
  });

  it('normal: defaults to ALWAYS when underline is undefined', () => {
    expect(shouldUnderline('normal', undefined)).toBe(true);
  });

  it('pressed: underlines whenever mode is not NEVER (2)', () => {
    expect(shouldUnderline('pressed', 0)).toBe(true);
    expect(shouldUnderline('pressed', 1)).toBe(true);
    expect(shouldUnderline('pressed', 2)).toBe(false);
  });

  it('disabled: underlines only on ALWAYS, same as normal', () => {
    expect(shouldUnderline('disabled', 0)).toBe(true);
    expect(shouldUnderline('disabled', 1)).toBe(false);
  });
});

describe('linkButtonUnderlineSpacing (default_theme.cpp:210)', () => {
  it('is round(2*scale)', () => {
    expect(linkButtonUnderlineSpacing({}, ctx())).toBe(2);
  });

  it('a theme_override_constants/underline_spacing override (already folded into n.constants) wins over the theme default', () => {
    expect(linkButtonUnderlineSpacing({ underline_spacing: 9 }, ctx())).toBe(9);
  });

  it('moves with a non-1 theme scale (default_theme.cpp:210: round(2*scale))', () => {
    expect(linkButtonUnderlineSpacing({}, { theme: nativeTheme(2.5) })).toBe(5);
  });
});

describe('linkButtonUnderlineGeometry (link_button.cpp:306-308)', () => {
  it('at size 16: spacing=trunc(2+0.9765625)=2, y=ascent(18)+2=20, thickness=1', () => {
    const { y, thickness } = linkButtonUnderlineGeometry(16, 2, 18);
    expect(y).toBe(20);
    expect(thickness).toBe(1);
  });

  it('a larger underline_spacing constant shifts y down by the same amount', () => {
    const { y } = linkButtonUnderlineGeometry(16, 10, 18);
    // spacing = trunc(10+0.9765625) = 10; y = 18+10 = 28.
    expect(y).toBe(28);
  });
});

function size(result: { x: number; y: number } | MinimumSizeResult): { x: number; y: number } {
  return 'x' in result ? result : result.size;
}

describe('linkButtonMinimumSize (link_button.cpp:193-200) — no text', () => {
  it('is (0, 0) with no text at all', () => {
    expect(size(linkButtonMinimumSize(node({}), ctx()))).toEqual({ x: 0, y: 0 });
  });

  it('treats an absent measurer as "text contributes nothing"', () => {
    expect(size(linkButtonMinimumSize(node({ text: 'A' }), ctx(false)))).toEqual({ x: 0, y: 0 });
  });
});

describe('linkButtonMinimumSize — with text', () => {
  it("is the shaped, ceiled text extent — 'A' is (11, 23)", () => {
    const result = size(linkButtonMinimumSize(node({ text: 'A' }), ctx()));
    expect(result).toEqual({ x: 11, y: 23 });
  });

  it('zeroes the width when overrun_behavior is anything but NO_TRIMMING (0), height unaffected', () => {
    const result = size(linkButtonMinimumSize(node({ text: 'A', overrunBehavior: 3 }), ctx()));
    expect(result).toEqual({ x: 0, y: 23 });
  });

  it('overrun_behavior === 0 (NO_TRIMMING, the default) keeps the full shaped width', () => {
    const result = size(linkButtonMinimumSize(node({ text: 'A', overrunBehavior: 0 }), ctx()));
    expect(result.x).toBe(11);
  });
});

/**
 * `LinkButton::_notification` (`link_button.cpp:289-314`):
 *
 *     int width = text_buf->get_line_width();
 *     if (is_layout_rtl()) { text_buf->draw(ci, Vector2(size.width - width, 0), color); }
 *     else                 { text_buf->draw(ci, Vector2(0, 0), color); }
 *
 * and the underline runs `(size.width - width) .. size.width` on the RTL arm,
 * `0 .. width` on the LTR one. `width` is `TextParagraph::get_line_width`
 * (`scene/resources/text_paragraph.cpp:810`) narrowed to `int` — that
 * accessor is `TS->shaped_text_get_width`, already
 * `Math::ceil(sd->width)` (`text_server_adv.cpp:7569`), so the narrowing
 * never removes a fraction and the line width is the CEILED pen extent.
 */
describe('linkButtonTextPlacement', () => {
  it('ceils the pen extent to Godot\'s own int line width', () => {
    expect(linkButtonTextPlacement(200, 63.4, false).lineWidthPx).toBe(64);
    expect(linkButtonTextPlacement(200, 64, false).lineWidthPx).toBe(64);
  });

  it('draws from the left edge under LTR', () => {
    expect(linkButtonTextPlacement(200, 63.4, false).originX).toBe(0);
  });

  it('draws flush against the right edge under RTL', () => {
    expect(linkButtonTextPlacement(200, 63.4, true).originX).toBe(136);
  });
});
