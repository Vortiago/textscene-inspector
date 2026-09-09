import { describe, it, expect } from 'vitest';
import { boolSlotValue, boolLiteralAsNumber } from './variantBool.js';

describe('boolSlotValue', () => {
  it('reads the two boolean literals', () => {
    expect(boolSlotValue('true')).toBe(true);
    expect(boolSlotValue('false')).toBe(false);
  });

  it('booleanizes an int spelling, because the slot converts rather than refusing', () => {
    // Measured on 4.6.3: a Sprite2D with `visible = 0` loads hidden and one with
    // `flip_h = 1` loads flipped.
    expect(boolSlotValue('0')).toBe(false);
    expect(boolSlotValue('1')).toBe(true);
    expect(boolSlotValue('-1')).toBe(true);
    // `!is_zero()`, not `== 1`: measured, `flip_h = 2` loads flipped.
    expect(boolSlotValue('2')).toBe(true);
  });

  it('booleanizes a float spelling the same way', () => {
    expect(boolSlotValue('0.0')).toBe(false);
    expect(boolSlotValue('2.7')).toBe(true);
  });

  it('refuses a spelling can_convert_strict leaves out', () => {
    // STRING is commented out of the BOOL row, so this is not a conversion the
    // slot performs and the linter keeps reporting it.
    expect(boolSlotValue('"yes"')).toBeUndefined();
    expect(boolSlotValue('Vector2(1, 2)')).toBeUndefined();
    expect(boolSlotValue('')).toBeUndefined();
  });

  it('is not fooled by surrounding space', () => {
    expect(boolSlotValue('  0 ')).toBe(false);
  });

  it('answers undefined for an absent property, not false', () => {
    // A defaulted-true property is read as `!== false`, so collapsing absent
    // onto false would hide every node whose `visible` key is simply not there.
    expect(boolSlotValue(undefined)).toBeUndefined();
  });
});

describe('boolLiteralAsNumber', () => {
  it('maps the boolean literals onto the 1/0 a numeric slot reads', () => {
    // Measured: `z_index = true` stores 1, `rotation = false` stores 0.0.
    expect(boolLiteralAsNumber('true')).toBe(1);
    expect(boolLiteralAsNumber('false')).toBe(0);
  });

  it('leaves every other spelling to the number grammar', () => {
    expect(boolLiteralAsNumber('1')).toBeUndefined();
    expect(boolLiteralAsNumber('"true"')).toBeUndefined();
  });
});
