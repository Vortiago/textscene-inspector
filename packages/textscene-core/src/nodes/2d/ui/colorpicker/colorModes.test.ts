import { describe, expect, it } from 'vitest';
import { ColorPickerColorMode } from '../../../../godot/scene/gui';
import { GradientColorSpace } from '../../../../godot/scene/gradientTexture';
import {
  colorModeAlphaChannel,
  colorModeChannels,
  colorModeIntensityChannel,
  colorNormalized,
  extractHsv,
  hexFieldText,
  alphaGradient,
  channelGradient,
  type ChannelGradient,
} from './colorModes';

const RED = { r: 1, g: 0, b: 0, a: 1 };

describe('colorNormalized', () => {
  it('is the identity for a non-overbright colour: color_picker.cpp:593-602 (multiplier=1)', () => {
    const n = colorNormalized(RED);
    expect(n.r).toBeCloseTo(1, 9);
    expect(n.g).toBeCloseTo(0, 9);
    expect(n.b).toBeCloseTo(0, 9);
    expect(n.a).toBe(1);
  });

  it("round-trips through Godot's float srgb_to_linear and linear_to_srgb (color.h:192-204)", () => {
    // A grey's OKHSL hue is float noise, so the hue the OK shapes draw reads this float result.
    expect(colorNormalized({ r: 0.25, g: 0.25, b: 0.25, a: 1 }).r).toBe(0.2499999850988388);
    expect(colorNormalized({ r: 0.7, g: 0.7, b: 0.7, a: 1 }).r).toBe(0.6999999284744263);
  });
});

describe('colorModeChannels', () => {
  it('ColorPickerColorMode.MODE_RGB reads color_normalized.components * 255: color_mode.cpp:46-49', () => {
    const [r, g, b] = colorModeChannels(ColorPickerColorMode.MODE_RGB, colorNormalized(RED));
    expect(r.value).toBeCloseTo(255, 9);
    expect(g.value).toBeCloseTo(0, 9);
    expect(b.value).toBeCloseTo(0, 9);
    expect([r.label, g.label, b.label]).toEqual(['R', 'G', 'B']);
    expect([r.max, g.max, b.max]).toEqual([255, 255, 255]);
  });

  it('ColorPickerColorMode.MODE_HSV reads h*360/s*100/v*100 off color_normalized: color_mode.cpp:151-172', () => {
    const [h, s, v] = colorModeChannels(ColorPickerColorMode.MODE_HSV, colorNormalized(RED));
    expect(h.value).toBeCloseTo(0, 9);
    expect(s.value).toBeCloseTo(100, 9);
    expect(v.value).toBeCloseTo(100, 9);
    expect([h.label, s.label, v.label]).toEqual(['H', 'S', 'V']);
    expect([h.max, s.max, v.max]).toEqual([359, 100, 100]);
  });

  it('ColorPickerColorMode.MODE_LINEAR reads srgb_to_linear(color_normalized): color_mode.cpp:234-238', () => {
    expect(colorModeChannels(ColorPickerColorMode.MODE_LINEAR, colorNormalized(RED))).toEqual([
      { label: 'R', value: 1, max: 1 },
      { label: 'G', value: 0, max: 1 },
      { label: 'B', value: 0, max: 1 },
    ]);
  });

  it('ColorPickerColorMode.MODE_OKHSL reads get_ok_hsl_h/s/l * 360/100/100 off color_normalized: color_mode.cpp:349-370', () => {
    const [h, s, l] = colorModeChannels(ColorPickerColorMode.MODE_OKHSL, colorNormalized(RED));
    // ok_color.h's srgb_to_okhsl for sRGB red: h=0.0812052366, s=1, l=0.5680846525
    // (from a separate Python transcription of the same algorithm).
    expect(h.value).toBeCloseTo(29.2338852, 4);
    expect(s.value).toBeCloseTo(100, 4);
    expect(l.value).toBeCloseTo(56.8084653, 4);
    expect(h.max).toBe(359);
    expect(s.max).toBe(100);
    expect(l.max).toBe(100);
  });
});

describe('colorModeAlphaChannel', () => {
  it('is color.a * 255 for every mode but Linear: color_mode.h:51-52', () => {
    expect(colorModeAlphaChannel(ColorPickerColorMode.MODE_RGB, { ...RED, a: 0.5 })).toEqual({
      label: 'A',
      value: 127.5,
      max: 255,
    });
  });

  it('is the raw alpha, 0..1, for Linear: color_mode.h:127-128', () => {
    expect(colorModeAlphaChannel(ColorPickerColorMode.MODE_LINEAR, { ...RED, a: 0.5 })).toEqual({
      label: 'A',
      value: 0.5,
      max: 1,
    });
  });
});

describe('colorModeIntensityChannel', () => {
  it('is fixed range -10..10: color_picker.cpp:2184-2186', () => {
    expect(colorModeIntensityChannel(RED)).toEqual({ label: 'I', value: 0, max: 10 });
  });
});

/** The polygon stops of a row, which fails the test for a texture row. */
function polygonOf(band: ChannelGradient) {
  if ('texture' in band) throw new Error('expected a polygon row, got a texture row');
  return band;
}

/** The gradient of a texture row, which fails the test for a polygon row. */
function textureOf(band: ChannelGradient) {
  if (!('texture' in band)) throw new Error('expected a texture row, got a polygon row');
  return band;
}

/** The grey polygon under the HSV H row of `color`. */
function hueUnderlay(color: { r: number; g: number; b: number; a: number }) {
  const { underlay } = polygonOf(channelGradient(ColorPickerColorMode.MODE_HSV, 0, color));
  if (underlay === null || underlay === 'checkerboard')
    throw new Error(`expected a grey underlay, got ${underlay}`);
  return underlay.grey;
}

function closeColor(
  actual: { r: number; g: number; b: number; a: number },
  expected: { r: number; g: number; b: number; a: number }
) {
  expect(actual.r).toBeCloseTo(expected.r, 9);
  expect(actual.g).toBeCloseTo(expected.g, 9);
  expect(actual.b).toBeCloseTo(expected.b, 9);
  expect(actual.a).toBeCloseTo(expected.a, 9);
}

describe('the HSV S and V rows', () => {
  it('S channel sweeps white to the hue at full saturation: color_mode.cpp:196-206', () => {
    const [left, right] = polygonOf(channelGradient(ColorPickerColorMode.MODE_HSV, 1, RED)).stops;
    closeColor(left!, { r: 1, g: 1, b: 1, a: 1 });
    closeColor(right!, { r: 1, g: 0, b: 0, a: 1 });
  });

  it('V channel sweeps black to the hue at full value', () => {
    const [left, right] = polygonOf(channelGradient(ColorPickerColorMode.MODE_HSV, 2, RED)).stops;
    closeColor(left!, { r: 0, g: 0, b: 0, a: 1 });
    closeColor(right!, { r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('the HSV H row underlay', () => {
  it('is the grey polygon at the value: color_mode.cpp:192-206', () => {
    closeColor(hueUnderlay({ r: 0.8, g: 0.6, b: 0.4, a: 1 }), {
      r: 0.8,
      g: 0.8,
      b: 0.8,
      a: 1,
    });
  });
});

describe('the HSV H row stops', () => {
  const PICKED = { r: 0.8, g: 0.6, b: 0.4, a: 1 }; // v = 0.8, s = 0.5

  it('are the 7 color_hue stops, from_hsv(i / 6, 1, 1), modulated by from_hsv(0, 0, v, s): color_mode.cpp:218-221, default_theme.cpp:1105-1128', () => {
    const { stops } = polygonOf(channelGradient(ColorPickerColorMode.MODE_HSV, 0, PICKED));
    expect(stops).toHaveLength(7);
    // Red, yellow, green, cyan, blue, magenta, red, each times v = 0.8, at alpha s = 0.5.
    const hues = [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
    ];
    stops.forEach((stop, i) => {
      closeColor(stop, {
        r: hues[i]![0]! * 0.8,
        g: hues[i]![1]! * 0.8,
        b: hues[i]![2]! * 0.8,
        a: 0.5,
      });
    });
  });

  it('vanishes at saturation 0: Color::from_hsv(0, 0, v, 0) has alpha 0', () => {
    const grey = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    for (const stop of polygonOf(channelGradient(ColorPickerColorMode.MODE_HSV, 0, grey)).stops)
      expect(stop.a).toBe(0);
  });
});

describe('the OKHSL S row', () => {
  it('sweeps an achromatic grey to the hue at full saturation, both at the current L: color_mode.cpp:412-427', () => {
    const [left, right] = polygonOf(channelGradient(ColorPickerColorMode.MODE_OKHSL, 1, RED)).stops;
    expect(left!.r).toBeCloseTo(0.5347439, 5);
    expect(left!.g).toBeCloseTo(0.5347439, 5);
    expect(left!.b).toBeCloseTo(0.5347439, 5);
    expect(right!.r).toBeCloseTo(1, 4);
    expect(right!.g).toBeCloseTo(0, 4);
    expect(right!.b).toBeCloseTo(0, 4);
  });
});

describe('the OKHSL L row', () => {
  it('is black, the hue at L=0.5, then white: color_mode.cpp:392-411', () => {
    const [black, mid, white] = polygonOf(channelGradient(ColorPickerColorMode.MODE_OKHSL, 2, RED)).stops;
    expect(black).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    // Color.from_ok_hsl(red.ok_hsl_h, red.ok_hsl_s, 0.5).r, measured in Godot 4.6.3.
    expect(mid!.r).toBeCloseTo(0.8773463368, 6);
    expect(mid!.g).toBeCloseTo(0, 5);
    expect(mid!.b).toBeCloseTo(0, 5);
    expect(white).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});

describe('the OKHSL H row', () => {
  it('sweeps hue at the current s and l, first and last stop equal: color_mode.cpp:428-457', () => {
    const { stops } = textureOf(channelGradient(ColorPickerColorMode.MODE_OKHSL, 0, RED)).gradient;
    expect(stops).toHaveLength(7);
    expect(stops[0]!.color).toEqual(stops[6]!.color);
    // from_ok_hsl(0, s, l) of red, measured in Godot 4.6.3.
    expect(stops[0]!.color.r).toBeCloseTo(0.9599455, 5);
    expect(stops[0]!.color.b).toBeCloseTo(0.5107065, 5);
  });
});

describe('hexFieldText', () => {
  it('spells an opaque colour as lowercase #RRGGBB with no alpha: color_picker.cpp:1315-1335', () => {
    expect(hexFieldText(RED, true)).toEqual({ label: 'Hex', typeText: '#', text: 'ff0000' });
  });

  it('appends the alpha byte when edit_alpha and alpha < 1', () => {
    expect(hexFieldText({ ...RED, a: 0.5 }, true)).toEqual({ label: 'Hex', typeText: '#', text: 'ff000080' });
  });

  it('drops the alpha byte when edit_alpha is false', () => {
    expect(hexFieldText({ ...RED, a: 0.5 }, false)).toEqual({ label: 'Hex', typeText: '#', text: 'ff0000' });
  });

  it('spells an overbright colour as Color(r, g, b): is_color_valid_hex fails, color_picker.cpp:60-62', () => {
    // color_to_string's own String::num(v, 3) trims trailing zeroes (ustring.cpp:1467-1481).
    expect(hexFieldText({ r: 2, g: 0, b: 0, a: 1 }, true)).toEqual({
      label: 'Expr',
      typeText: '',
      text: 'Color(2.0, 0.0, 0.0)',
    });
  });

  it('spells a negative channel as Color(r, g, b) too', () => {
    expect(hexFieldText({ r: -0.1, g: 0, b: 0, a: 1 }, true)).toEqual({
      label: 'Expr',
      typeText: '',
      text: 'Color(-0.1, 0.0, 0.0)',
    });
  });
});

describe('the alpha row stops', () => {
  it('sweeps the normalised colour from alpha 0 to alpha 1: color_picker.cpp:1423-1450', () => {
    expect(polygonOf(alphaGradient(RED)).stops).toEqual([
      { r: 1, g: 0, b: 0, a: 0 },
      { r: 1, g: 0, b: 0, a: 1 },
    ]);
  });
});

describe('extractHsv', () => {
  it('matches Color::get_h/get_s/get_v directly for a non-overbright colour', () => {
    // color_picker.cpp:593-602: multiplier is 1 for any channel <= 1, so
    // color_normalized === color and this is the plain HSV extraction.
    const { h, s, v } = extractHsv({ r: 1, g: 0, b: 0, a: 1 });
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('reads an overbright colour after colorNormalized: color_picker.cpp:593-602', () => {
    // r=2 (linear-equivalent overbright red): multiplier > 1, so v settles
    // back to 1 after the srgb round-trip, not 2.
    const { s, v } = extractHsv(colorNormalized({ r: 2, g: 0, b: 0, a: 1 }));
    expect(s).toBeCloseTo(1, 2);
    expect(v).toBeCloseTo(1, 2);
  });

  it('is achromatic (h=0) for pure black', () => {
    expect(extractHsv({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe('channelGradient', () => {
  const GREY = { r: 0.2, g: 0.4, b: 0.6, a: 1 };

  it.each([
    ['RGB', ColorPickerColorMode.MODE_RGB, GradientColorSpace.SRGB],
    ['Linear', ColorPickerColorMode.MODE_LINEAR, GradientColorSpace.LINEAR_SRGB],
  ])(
    'draws a %s row from a 400-texel gradient texture (color_mode.cpp:100-120,298-318)',
    (_, mode, space) => {
      const { texture, gradient } = textureOf(channelGradient(mode, 0, GREY));
      expect(texture.width).toBe(400);
      expect(gradient.interpolationColorSpace).toBe(space);
      expect(gradient.stops.map((stop) => stop.color)).toEqual([
        { r: 0, g: 0.4, b: 0.6, a: 1 },
        { r: 1, g: 0.4, b: 0.6, a: 1 },
      ]);
    }
  );

  it('draws the OKHSL H row from a 400-texel texture that blends in OKLab (color_mode.cpp:428-457)', () => {
    const { texture, gradient } = textureOf(channelGradient(ColorPickerColorMode.MODE_OKHSL, 0, GREY));
    expect(texture.width).toBe(400);
    expect(gradient.interpolationColorSpace).toBe(GradientColorSpace.OKLAB);
  });

  it.each([
    ['HSV S', ColorPickerColorMode.MODE_HSV, 1],
    ['OKHSL S', ColorPickerColorMode.MODE_OKHSL, 1],
    ['OKHSL L', ColorPickerColorMode.MODE_OKHSL, 2],
  ] as const)('draws the %s row as a polygon of evenly spaced stops', (_, mode, channel) => {
    expect('stops' in channelGradient(mode, channel, GREY)).toBe(true);
  });

  it('draws the alpha row as a polygon over the checkerboard (color_picker.cpp:1423-1450)', () => {
    expect(polygonOf(alphaGradient(GREY)).underlay).toBe('checkerboard');
  });
});
