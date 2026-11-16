import { describe, expect, it } from 'vitest';
import { NIL, variant } from '../value/variant.js';
import { COLOR_METHODS } from './colorMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const f = Math.fround;
const color = (r: number, g: number, b: number, a: number) => variant('COLOR', { r, g, b, a });

describe('COLOR_METHODS', () => {
  it('writes the channels as hex, with alpha only when asked', () => {
    expect(COLOR_METHODS.to_html!.run(color(1, 0.5, 0, 1), [false], NO_CONTEXT)).toEqual(
      variant('STRING', 'ff8000')
    );
    expect(COLOR_METHODS.to_html!.run(color(1, 0.5, 0, 1), [true], NO_CONTEXT)).toEqual(
      variant('STRING', 'ff8000ff')
    );
  });

  it('reads a hex text that is not a colour as opaque black', () => {
    expect(COLOR_METHODS.html!.run(NIL, ['#zzz'], NO_CONTEXT)).toEqual(color(0, 0, 0, 1));
  });

  it('reads a short hex text in float', () => {
    expect(COLOR_METHODS.html!.run(NIL, ['#f80'], NO_CONTEXT)).toEqual(color(1, f(8 / 15), 0, 1));
  });

  it('leaves a channel out of range as it is when inverting', () => {
    expect(COLOR_METHODS.inverted!.run(color(2, -1, 0.5, 0.3), [], NO_CONTEXT)).toEqual(
      color(-1, 2, 0.5, 0.3)
    );
  });

  it('packs the channels into a 32-bit int, red first', () => {
    expect(COLOR_METHODS.to_rgba32!.run(color(1, 0, 0, 1), [], NO_CONTEXT)).toEqual(
      variant('INT', 0xff0000ffn)
    );
  });
});
