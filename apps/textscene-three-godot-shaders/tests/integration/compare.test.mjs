import { describe, expect, it } from 'vitest';
import { compareProbe } from './compare.mjs';

const ENDS_GODOT = {
  source: '',
  inputs: [],
  rejected: { stage: 'Godot', message: 'Godot ends with signal 8' },
};

describe('the verdict on a shader that ends Godot', () => {
  it('passes when the transpiler refuses it as an expression Godot aborts on', () => {
    const actual = { error: 'Godot 4.6.3 aborts on this expression: it traps.', isRefusal: true };
    expect(compareProbe(ENDS_GODOT, actual).passed).toBe(true);
  });

  it('fails when the transpiler refuses it for another reason', () => {
    const actual = { error: 'OP_CALL is not transpiled yet (#1825).', isRefusal: true };
    expect(compareProbe(ENDS_GODOT, actual).passed).toBe(false);
  });
});
