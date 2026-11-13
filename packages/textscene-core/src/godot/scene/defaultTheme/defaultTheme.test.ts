import { describe, expect, it } from 'vitest';
import measured from '../defaultTheme.godot.json';
import type { Rgba } from '../../math/math.js';
import {
  defaultConstant,
  defaultThemeAt,
  type DefaultStyleBox,
  type DefaultThemeType,
  type Sides,
} from './defaultTheme.js';
import { typeItems } from './typeItems.js';
import { DEFAULT_THEME_VARIATION_BASES } from './variations.js';

/**
 * Godot 4.6.3's default theme (`ThemeDB.get_default_theme()`) at each scale, item by item. Regenerate the
 * file with `../testing/defaultTheme/measure.mjs`.
 */
type Tuple = number[];
interface MeasuredType {
  colors: Record<string, Tuple>;
  constants: Record<string, number>;
  fontSizes: Record<string, number>;
  styles: Record<string, Record<string, unknown>>;
}
interface MeasuredTheme {
  scale: number;
  defaultFontSize: number;
  variations: Record<string, string>;
  types: Record<string, MeasuredType>;
}

/** A type the table leaves out, such as `Icons`, holds only icons, which the table does not hold. */
const ICONS_ONLY = typeItems({});

/** A 32-bit float colour channel holds about seven digits. */
const COLOUR_DIGITS = 6;

const themes = Object.entries(measured as Record<string, MeasuredTheme>);

const rgba = ({ r, g, b, a }: Rgba): Tuple => [r, g, b, a];
const sides = ({ left, top, right, bottom }: Sides): Tuple => [left, top, right, bottom];
const close = (tuple: Tuple) => tuple.map((channel) => expect.closeTo(channel, COLOUR_DIGITS));

/** A table box in the shape `dump.gd` writes. */
function capturedShape(box: DefaultStyleBox): Record<string, unknown> {
  if (box.kind === 'empty') return { kind: 'empty', contentMargin: sides(box.contentMargin) };
  if (box.kind === 'line')
    return {
      kind: 'line',
      color: close(rgba(box.color)),
      contentMargin: sides(box.contentMargin),
      thickness: box.thickness,
      vertical: box.vertical,
      growBegin: box.growBegin,
      growEnd: box.growEnd,
    };
  const { topLeft, topRight, bottomRight, bottomLeft } = box.cornerRadius;
  return {
    kind: 'flat',
    bgColor: close(rgba(box.bgColor)),
    contentMargin: sides(box.contentMargin),
    cornerRadius: [topLeft, topRight, bottomRight, bottomLeft],
    cornerDetail: box.cornerDetail,
    borderWidth: sides(box.borderWidth),
    borderColor: close(rgba(box.borderColor)),
    expandMargin: sides(box.expandMargin),
    drawCenter: box.drawCenter,
  };
}

function expectSameItems(table: DefaultThemeType, godot: MeasuredType): void {
  expect(Object.fromEntries(Object.entries(table.colors).map(([name, c]) => [name, rgba(c)]))).toEqual(
    Object.fromEntries(Object.entries(godot.colors).map(([name, c]) => [name, close(c)]))
  );
  expect(table.constants).toEqual(godot.constants);
  expect(table.fontSizes).toEqual(godot.fontSizes);
  expect(
    Object.fromEntries(Object.entries(table.styles).map(([name, box]) => [name, capturedShape(box)]))
  ).toEqual(godot.styles);
}

describe.each(themes)('defaultThemeAt(%s)', (_scale, godot) => {
  const table = defaultThemeAt(godot.scale);

  it.each(Object.keys(godot.types))('holds every item of %s as Godot does', (type) => {
    expectSameItems(table.types[type] ?? ICONS_ONLY, godot.types[type]!);
  });

  it('holds no type that the capture lacks', () => {
    expect(Object.keys(table.types).filter((type) => !(type in godot.types))).toEqual([]);
  });

  it('scales default_font_size as Godot does', () => {
    expect(table.defaultFontSize).toBe(godot.defaultFontSize);
  });
});

describe('DEFAULT_THEME_VARIATION_BASES', () => {
  it('names each variation of the default theme with its base, at every scale', () => {
    for (const [, godot] of themes) expect(DEFAULT_THEME_VARIATION_BASES).toEqual(godot.variations);
  });
});

describe('defaultThemeAt', () => {
  it('builds each scale once', () => {
    expect(defaultThemeAt(1)).toBe(defaultThemeAt(1));
  });

  it('keeps two scales side by side', () => {
    const one = defaultThemeAt(1);
    const half = defaultThemeAt(1.5);
    expect(half).not.toBe(one);
    expect(defaultThemeAt(1)).toBe(one);
    expect(one.defaultFontSize).toBe(16);
    expect(half.defaultFontSize).toBe(24);
  });

  it('freezes every box, so a reader cannot edit the margins of another', () => {
    const margin = defaultThemeAt(1).types.Button!.styles.normal!.contentMargin as { left: number };
    expect(() => {
      margin.left = 0;
    }).toThrow(TypeError);
  });
});

describe('defaultConstant', () => {
  it('reads a constant of the table at scale 1', () => {
    expect(defaultConstant('SpinBox', 'buttons_width')).toBe(16);
  });

  it('names the type and the constant it misses', () => {
    expect(() => defaultConstant('SpinBox', 'no_such_constant')).toThrow(
      'expected the default theme to hold the constant SpinBox/no_such_constant'
    );
  });

  it('throws for a type the table leaves out', () => {
    expect(() => defaultConstant('Icons', 'anything')).toThrow('Icons/anything');
  });
});
