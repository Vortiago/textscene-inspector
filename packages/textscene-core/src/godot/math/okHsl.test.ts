import { describe, expect, it } from 'vitest';
import { srgbToOkhsl } from './okHsl';

const f = Math.fround;

describe('srgbToOkhsl', () => {
  // Printed by Godot 4.6.3: var_to_str of the colour's ok_hsl_h, ok_hsl_s and ok_hsl_l.
  it.each([
    [
      [0.2, 0.4, 0.6],
      [0.6956475, 0.6170649, 0.42035818],
    ],
    [
      [0.9, 0.85, 0.1],
      [0.29211676, 0.96408296, 0.84572583],
    ],
  ])('gives the float OKHSL of %j that Godot gives', ([r, g, b], [h, s, l]) => {
    expect(srgbToOkhsl({ r: f(r!), g: f(g!), b: f(b!) })).toEqual({ h: f(h!), s: f(s!), l: f(l!) });
  });

  it('gives black as all zeros, the header guard against its precision errors', () => {
    expect(srgbToOkhsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });
});
