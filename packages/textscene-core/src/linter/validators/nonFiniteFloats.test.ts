/**
 * `inf` / `-inf` / `inf_neg` / `nan` are legal TSCN float literals.
 *
 * Godot's parser reads all four (`core/variant/variant_parser.cpp:150-155` for
 * the string form, `:701-706` for the token form) and its serializer writes
 * them back, so a scene carrying one is a scene Godot produced. `parseFloat`
 * returns NaN for every one, which used to make the shared numeric validator
 * report a FORMAT error on all of them everywhere.
 *
 * That was right for exactly five properties and wrong for every other float in
 * the repo. These tests pin both halves of the split.
 */

import { describe, expect, it } from 'vitest';
import { parseGodotFloat } from './commonValidators.js';
import { v } from './v.js';

const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'];

describe('parseGodotFloat', () => {
  it.each([
    ['inf', Infinity],
    ['-inf', -Infinity],
    ['inf_neg', -Infinity],
  ])('reads %s as %s', (text, expected) => {
    expect(parseGodotFloat(text)).toBe(expected);
  });

  it('reads nan as NaN rather than as a miss', () => {
    // The distinction the null sentinel exists for: `nan` is a value, not a
    // parse failure, and collapsing the two would reject it.
    expect(parseGodotFloat('nan')).toBeNaN();
    expect(parseGodotFloat('nan')).not.toBeNull();
  });

  it('still reads ordinary floats', () => {
    expect(parseGodotFloat('1.5')).toBe(1.5);
    expect(parseGodotFloat('-0.25')).toBe(-0.25);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseGodotFloat('  inf  ')).toBe(Infinity);
  });

  it.each(['', 'abc', 'Infinity', '-Infinity', 'NaN', 'inf inf'])(
    'returns null for %o',
    (text) => {
      // `Infinity`/`NaN` are JavaScript spellings; Godot's tokenizer matches
      // only the four above, so they stay format errors.
      expect(parseGodotFloat(text)).toBeNull();
    }
  );

  it('still reads an overflowing literal as infinity, as Godot does', () => {
    expect(parseGodotFloat('1e999')).toBe(Infinity);
  });
});

describe('an ordinary float property', () => {
  const unbounded = v.float('some_float');

  it.each(NON_FINITE)('accepts %s, which Godot stores unaltered', (value) => {
    expect(unbounded('some_float', value, 1)).toBeNull();
  });

  it('still rejects text that is not a float at all', () => {
    expect(unbounded('some_float', 'wide', 1)?.code).toBe('INVALID_SOME_FLOAT_FORMAT');
  });

  it('reports inf against a hinted ceiling as a range problem, not a format one', () => {
    const bounded = v.float('ratio', { min: 0, max: 1, hinted: 'x.cpp:1' });
    const diagnostic = bounded('ratio', 'inf', 1);
    expect(diagnostic?.code).toBe('INVALID_RATIO_VALUE');
    expect(diagnostic?.severity).toBe('warning');
  });

  it('reports nothing for nan against a bound, since every comparison is false', () => {
    const bounded = v.float('ratio', { min: 0, max: 1, hinted: 'x.cpp:1' });
    expect(bounded('ratio', 'nan', 1)).toBeNull();
  });
});

describe('a property whose setter guards is_finite', () => {
  const guarded = v.float('icon_scale', { finite: 'item_list.cpp:2098' });

  it.each(NON_FINITE)('rejects %s as an error', (value) => {
    const diagnostic = guarded('icon_scale', value, 1);
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.code).toBe('INVALID_ICON_SCALE_VALUE');
    expect(diagnostic?.message).toContain('finite');
  });

  it('accepts an ordinary value', () => {
    expect(guarded('icon_scale', '1.5', 1)).toBeNull();
  });

  it('accepts a negative value, which this setter does not refuse', () => {
    expect(guarded('icon_scale', '-2', 1)).toBeNull();
  });

  it('carries the finite guard as its grounding', () => {
    expect(guarded.grounding).toEqual({ kind: 'enforced', cite: 'item_list.cpp:2098' });
  });

  it('keeps both citations when a range bound is also present', () => {
    // The finite check and the range check are separate lines in the setter;
    // recording only one makes the other uncheckable.
    const both = v.float('radial_initial_angle', {
      min: 0,
      max: 360,
      enforced: 'texture_progress_bar.cpp:594',
      finite: 'texture_progress_bar.cpp:592',
    });
    expect(both.grounding?.cite).toBe('texture_progress_bar.cpp:592, texture_progress_bar.cpp:594');
  });

  it('applies to nonNegativeFloat too, where zoom_step needs it', () => {
    const step = v.nonNegativeFloat('zoom_step', {
      enforced: { min: 'graph_edit.cpp:2465' },
      finite: 'graph_edit.cpp:2466',
    });
    expect(step('zoom_step', 'inf', 1)?.severity).toBe('error');
    expect(step('zoom_step', '1.2', 1)).toBeNull();
  });
});
