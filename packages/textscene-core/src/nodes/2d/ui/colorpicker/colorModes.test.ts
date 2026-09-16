import { describe, expect, it } from 'vitest';
import {
  MODE_HSV,
  MODE_LINEAR,
  MODE_OKHSL,
  MODE_RGB,
  colorIntensity,
  colorModeAlphaChannel,
  colorModeChannels,
  colorModeIntensityChannel,
  colorNormalized,
  colorPickerSliderLabels,
  formatSliderValue,
  hexFieldText,
  rgbChannelGradientStops,
  hsvChannelGradientStops,
  hsvHueChannelBase,
  hsvHueChannelOverlayAlpha,
  okhslHueChannelStops,
  okhslLightnessGradientStops,
  okhslSaturationGradientStops,
  alphaChannelGradientStops,
} from './colorModes';

const RED = { r: 1, g: 0, b: 0, a: 1 };

describe('colorNormalized', () => {
  it('is the identity for a non-overbright colour — color_picker.cpp:593-602 (multiplier=1)', () => {
    const n = colorNormalized(RED);
    expect(n.r).toBeCloseTo(1, 9);
    expect(n.g).toBeCloseTo(0, 9);
    expect(n.b).toBeCloseTo(0, 9);
    expect(n.a).toBe(1);
  });
});

describe('colorIntensity', () => {
  it('is 0 for a non-overbright colour — log2(1)', () => {
    expect(colorIntensity(RED)).toBe(0);
  });
});

describe('colorModeChannels', () => {
  it('MODE_RGB reads color_normalized.components * 255 — color_mode.cpp:46-49', () => {
    const [r, g, b] = colorModeChannels(MODE_RGB, RED);
    expect(r.value).toBeCloseTo(255, 9);
    expect(g.value).toBeCloseTo(0, 9);
    expect(b.value).toBeCloseTo(0, 9);
    expect([r.label, g.label, b.label]).toEqual(['R', 'G', 'B']);
    expect([r.max, g.max, b.max]).toEqual([255, 255, 255]);
  });

  it('MODE_HSV reads h*360/s*100/v*100 off color_normalized — color_mode.cpp:151-172', () => {
    const [h, s, v] = colorModeChannels(MODE_HSV, RED);
    expect(h.value).toBeCloseTo(0, 9);
    expect(s.value).toBeCloseTo(100, 9);
    expect(v.value).toBeCloseTo(100, 9);
    expect([h.label, s.label, v.label]).toEqual(['H', 'S', 'V']);
    expect([h.max, s.max, v.max]).toEqual([359, 100, 100]);
  });

  it('MODE_LINEAR reads srgb_to_linear(color_normalized) — color_mode.cpp:234-238', () => {
    expect(colorModeChannels(MODE_LINEAR, RED)).toEqual([
      { label: 'R', value: 1, max: 1, decimals: 3 },
      { label: 'G', value: 0, max: 1, decimals: 3 },
      { label: 'B', value: 0, max: 1, decimals: 3 },
    ]);
  });

  it('MODE_OKHSL reads get_ok_hsl_h/s/l * 360/100/100 off color_normalized — color_mode.cpp:349-370', () => {
    const [h, s, l] = colorModeChannels(MODE_OKHSL, RED);
    // ok_color.h's srgb_to_okhsl for sRGB red: h=0.0812052366, s=1, l=0.5680846525
    // (an independent Python transcription of the same cited algorithm; see okhsl.test.ts).
    expect(h.value).toBeCloseTo(29.2338852, 4);
    expect(s.value).toBeCloseTo(100, 4);
    expect(l.value).toBeCloseTo(56.8084653, 4);
    expect(h.max).toBe(359);
    expect(s.max).toBe(100);
    expect(l.max).toBe(100);
  });
});

describe('colorModeAlphaChannel', () => {
  it('is color.a * 255 for every mode but Linear — color_mode.h:51-52', () => {
    expect(colorModeAlphaChannel(MODE_RGB, { ...RED, a: 0.5 })).toEqual({ label: 'A', value: 127.5, max: 255, decimals: 0 });
  });

  it('is the raw alpha, 0..1, for Linear — color_mode.h:127-128', () => {
    expect(colorModeAlphaChannel(MODE_LINEAR, { ...RED, a: 0.5 })).toEqual({ label: 'A', value: 0.5, max: 1, decimals: 3 });
  });
});

describe('colorModeIntensityChannel', () => {
  it('is fixed range -10..10 at 3 decimals — color_picker.cpp:2184-2186', () => {
    expect(colorModeIntensityChannel(RED)).toEqual({ label: 'I', value: 0, max: 10, decimals: 3 });
  });
});

describe('formatSliderValue', () => {
  it('formats an integer with no decimal point — String::num, ustring.cpp:1405,1467-1481', () => {
    expect(formatSliderValue(255, 0)).toBe('255');
  });

  // ustring.cpp:1467-1481 "Destroy trailing zeroes, except one after period" —
  // 0.500 trims to 0.5, not the naively padded 0.500 a plain toFixed(3) gives.
  it('trims trailing zeroes past the decimal point, keeping at least one digit', () => {
    expect(formatSliderValue(0.5, 3)).toBe('0.5');
    expect(formatSliderValue(0, 3)).toBe('0.0');
    expect(formatSliderValue(2, 3)).toBe('2.0');
  });
});

describe('rgbChannelGradientStops', () => {
  it('sweeps channel 0 from black to red, holding g/b at 0 — color_mode.cpp:91-98', () => {
    expect(rgbChannelGradientStops(0, RED)).toEqual([
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 1, g: 0, b: 0, a: 1 },
    ]);
  });
});

function closeColor(actual: { r: number; g: number; b: number; a: number }, expected: { r: number; g: number; b: number; a: number }) {
  expect(actual.r).toBeCloseTo(expected.r, 9);
  expect(actual.g).toBeCloseTo(expected.g, 9);
  expect(actual.b).toBeCloseTo(expected.b, 9);
  expect(actual.a).toBeCloseTo(expected.a, 9);
}

describe('hsvChannelGradientStops', () => {
  it('S channel sweeps white to the hue at full saturation — color_mode.cpp:196-206', () => {
    const [left, right] = hsvChannelGradientStops(1, RED);
    closeColor(left, { r: 1, g: 1, b: 1, a: 1 });
    closeColor(right, { r: 1, g: 0, b: 0, a: 1 });
  });

  it('V channel sweeps black to the hue at full value', () => {
    const [left, right] = hsvChannelGradientStops(2, RED);
    closeColor(left, { r: 0, g: 0, b: 0, a: 1 });
    closeColor(right, { r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('hsvHueChannelBase / hsvHueChannelOverlayAlpha', () => {
  it('base is grey at v, overlay alpha is s — color_mode.cpp:192-206', () => {
    closeColor(hsvHueChannelBase(RED), { r: 1, g: 1, b: 1, a: 1 });
    expect(hsvHueChannelOverlayAlpha(RED)).toBeCloseTo(1, 9);
  });
});

describe('okhslSaturationGradientStops', () => {
  it('sweeps an achromatic grey to the hue at full saturation, both at the current L — color_mode.cpp:412-427', () => {
    const [left, right] = okhslSaturationGradientStops(RED);
    expect(left.r).toBeCloseTo(0.5347439, 5);
    expect(left.g).toBeCloseTo(0.5347439, 5);
    expect(left.b).toBeCloseTo(0.5347439, 5);
    expect(right.r).toBeCloseTo(1, 4);
    expect(right.g).toBeCloseTo(0, 4);
    expect(right.b).toBeCloseTo(0, 4);
  });
});

describe('okhslLightnessGradientStops', () => {
  it('is black, the hue at L=0.5, then white — color_mode.cpp:392-411', () => {
    const [black, mid, white] = okhslLightnessGradientStops(RED);
    expect(black).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(mid.r).toBeCloseTo(0.8775765, 5);
    expect(mid.g).toBeCloseTo(0, 5);
    expect(mid.b).toBeCloseTo(0, 5);
    expect(white).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});

describe('okhslHueChannelStops', () => {
  it('is 7 stops sweeping hue at the current s/l, first and last equal — color_mode.cpp:428-457', () => {
    const stops = okhslHueChannelStops(RED);
    expect(stops).toHaveLength(7);
    closeColor(stops[0]!, stops[6]!);
    expect(stops[0]!.r).toBeCloseTo(0.9599455, 5);
    expect(stops[0]!.g).toBeCloseTo(0, 5);
    expect(stops[0]!.b).toBeCloseTo(0.5107065, 5);
  });
});

describe('colorPickerSliderLabels', () => {
  it('is 3 channel labels then intensity then alpha — color_picker.h:153-159, both shown', () => {
    expect(colorPickerSliderLabels(MODE_RGB, true, true)).toEqual(['R', 'G', 'B', 'I', 'A']);
  });

  it('intensity always precedes alpha, never the reverse (SLIDER_INTENSITY < SLIDER_ALPHA)', () => {
    const labels = colorPickerSliderLabels(MODE_HSV, true, true);
    expect(labels.indexOf('I')).toBeLessThan(labels.indexOf('A'));
    expect(labels).toEqual(['H', 'S', 'V', 'I', 'A']);
  });

  it('drops intensity/alpha independently without touching the 3 channel rows', () => {
    expect(colorPickerSliderLabels(MODE_OKHSL, false, true)).toEqual(['H', 'S', 'L', 'I']);
    expect(colorPickerSliderLabels(MODE_OKHSL, true, false)).toEqual(['H', 'S', 'L', 'A']);
    expect(colorPickerSliderLabels(MODE_LINEAR, false, false)).toEqual(['R', 'G', 'B']);
  });
});

describe('hexFieldText', () => {
  it('spells an opaque colour as lowercase #RRGGBB with no alpha — color_picker.cpp:1315-1335', () => {
    expect(hexFieldText(RED, true)).toEqual({ label: 'Hex', typeText: '#', text: 'ff0000' });
  });

  it('appends the alpha byte when edit_alpha and alpha < 1', () => {
    expect(hexFieldText({ ...RED, a: 0.5 }, true)).toEqual({ label: 'Hex', typeText: '#', text: 'ff000080' });
  });

  it('drops the alpha byte when edit_alpha is false', () => {
    expect(hexFieldText({ ...RED, a: 0.5 }, false)).toEqual({ label: 'Hex', typeText: '#', text: 'ff0000' });
  });

  it('spells an overbright colour as Color(r, g, b) — is_color_valid_hex fails, color_picker.cpp:60-62', () => {
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

describe('alphaChannelGradientStops', () => {
  it('sweeps the normalised colour from alpha 0 to alpha 1 — color_picker.cpp:1423-1450', () => {
    expect(alphaChannelGradientStops(RED)).toEqual([
      { r: 1, g: 0, b: 0, a: 0 },
      { r: 1, g: 0, b: 0, a: 1 },
    ]);
  });
});
