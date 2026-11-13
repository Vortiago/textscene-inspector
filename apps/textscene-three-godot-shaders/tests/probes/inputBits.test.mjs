/** Input rows kept as bits read back to the rows whose bits they are. */

import { describe, expect, it } from 'vitest';
import { inputRowsOfBits, parameterBits } from '../../../../scripts/godot-probes/probeShader.mjs';
import { hex } from '../../../../scripts/godot-probes/record.mjs';

const SOURCE = 'int probe(vec2 a, int b, bool c) { return b; }';

describe('inputRowsOfBits', () => {
  it('reads back every scalar kind bit for bit', () => {
    const inputs = [
      [[1.5, -0], -7, true],
      [[Number.NaN, 3e38], 2147483647, false],
    ];
    const bits = parameterBits({ source: SOURCE, inputs }).map((lanes) => lanes.map(hex));
    expect(parameterBits({ source: SOURCE, inputs: inputRowsOfBits(SOURCE, bits) })).toEqual(
      parameterBits({ source: SOURCE, inputs })
    );
  });

  it('refuses bits for another count of parameters', () => {
    expect(() => inputRowsOfBits(SOURCE, [['3f800000', '3f800000']])).toThrow(/3 parameters .* got 1/);
  });

  it('refuses a parameter whose lanes make no whole row', () => {
    expect(() => inputRowsOfBits(SOURCE, [['3f800000'], ['00000001'], ['00000001']])).toThrow(
      /whole rows of the same count .* 0.5, 1, 1/
    );
  });
});
