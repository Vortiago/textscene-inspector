/**
 * The packed-array and string combinators.
 *
 * Both grammars are about what Godot's own serialiser WRITES rather than what
 * looks well-formed: a truncating element count, a non-finite literal, an empty
 * array, an `&`-prefixed StringName. Rejecting any of them rejects a file Godot
 * saved.
 *
 * Kept under the same outer describe as the rest of the renderer float-grammar
 * cases in `v.tuples.test.ts`, which is where the scalar/tuple halves live.
 */

import { describe, expect, it } from 'vitest';
import { v } from './v.js';

describe('float-tuple validators accept the renderer float grammar', () => {
  describe('v.packedVector2Array', () => {
    const check = (value: string) => v.packedVector2Array('polygon')('polygon', value, 1);

    it('accepts coordinate pairs', () => {
      expect(check('PackedVector2Array(0, -1, 0, 0, 2, -1)')).toBeNull();
    });

    it('accepts an EMPTY array, which is how Godot serialises one', () => {
      expect(check('PackedVector2Array()')).toBeNull();
      expect(check('PackedVector2Array(  )')).toBeNull();
    });

    it('accepts the numeric forms the corpus actually writes', () => {
      // Scientific notation appears verbatim in the vendored soft-body scenes.
      expect(check('PackedVector2Array(4.37114e-08, -1.5, 0.5, 0.25)')).toBeNull();
    });

    it('accepts an ODD count, which Godot truncates rather than refusing', () => {
      // variant_parser.cpp:1555 builds the array with `args.size() / 2`, integer
      // division, so the lone trailing coordinate is dropped and the file loads.
      expect(check('PackedVector2Array(0, -1, 0)')).toBeNull();
    });

    it('rejects a non-numeric entry as a format error', () => {
      const err = check('PackedVector2Array(0, nope, 1, 2)');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('INVALID_POLYGON_FORMAT');
    });

    it('rejects the wrong wrapper', () => {
      expect(check('PackedVector3Array(0, 0, 0)')).not.toBeNull();
      expect(check('[0, 0, 1, 1]')).not.toBeNull();
    });

    it('rejects a trailing comma rather than reading it as an empty coordinate', () => {
      expect(check('PackedVector2Array(0, 1,)')).not.toBeNull();
    });
  });

  const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'];

  describe('v.packedVector3Array', () => {
    const check = (value: string) => v.packedVector3Array('emission_points')('emission_points', value, 1);

    it('accepts vertex triples', () => {
      expect(check('PackedVector3Array(0, 0, 0, 1, 0, 0)')).toBeNull();
    });

    it('accepts an EMPTY array, which is how Godot serialises one', () => {
      expect(check('PackedVector3Array()')).toBeNull();
    });

    it.each(NON_FINITE)('accepts %s, which rtos_fix writes into a Vector3Array too', (value) => {
      expect(check(`PackedVector3Array(0, ${value}, 0)`)).toBeNull();
    });

    it('accepts a count that is not a multiple of 3 (VariantParser truncates via integer division, variant_parser.cpp:1573)', () => {
      expect(check('PackedVector3Array(0, 0, 1, 0)')).toBeNull();
    });

    it('rejects a non-numeric entry as a format error', () => {
      const err = check('PackedVector3Array(0, nope, 0)');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('INVALID_EMISSION_POINTS_FORMAT');
    });

    it('rejects the wrong wrapper', () => {
      expect(check('PackedColorArray(0, 0, 0, 1)')).not.toBeNull();
      expect(check('PackedVector2Array(0, 0)')).not.toBeNull();
    });
  });

  describe('v.packedColorArray', () => {
    const check = (value: string) => v.packedColorArray('emission_colors')('emission_colors', value, 1);

    it('accepts RGBA quadruples', () => {
      expect(check('PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)')).toBeNull();
    });

    it('accepts an EMPTY array, which is how Godot serialises one', () => {
      expect(check('PackedColorArray()')).toBeNull();
    });

    it.each(NON_FINITE)('accepts %s, which rtos_fix writes into a ColorArray too', (value) => {
      expect(check(`PackedColorArray(1, 1, 1, ${value})`)).toBeNull();
    });

    it('accepts a count that is not a multiple of 4 (VariantParser truncates via integer division, variant_parser.cpp:1609)', () => {
      expect(check('PackedColorArray(1, 1, 1)')).toBeNull();
    });

    it('rejects a non-numeric entry as a format error', () => {
      const err = check('PackedColorArray(1, 1, 1, nope)');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('INVALID_EMISSION_COLORS_FORMAT');
    });

    it('rejects the wrong wrapper', () => {
      expect(check('PackedVector3Array(0, 0, 0)')).not.toBeNull();
    });
  });

  describe('quotedString / stringName grammar', () => {
    const quoted = (value: string) => v.quotedString('title')('title', value, 1);
    const name = (value: string) => v.stringName('bone_name')('bone_name', value, 1);

    it('accepts a plain quoted literal on both', () => {
      expect(quoted('"Head"')).toBeNull();
      expect(name('"Head"')).toBeNull();
    });

    it('accepts the &-prefixed StringName form Godot actually saves', () => {
      expect(name('&"Head"')).toBeNull();
      // variant.cpp:582-587: STRING_NAME is a strict source for STRING, so the
      // jacket loads into a string slot too.
      expect(quoted('&"Head"')).toBeNull();
    });

    it('accepts the 3.x @ prefix on both, which the tokenizer still reads', () => {
      // `case '@':` falls straight through to the StringName case under
      // `#ifndef DISABLE_DEPRECATED` (variant_parser.cpp:262-265), so the value
      // loads and a rejection here would be an error on a file Godot opens.
      // `quotedString` accepted it already; `stringName` did not, and the two
      // grammars sit four lines apart in one file.
      expect(name('@"Footsteps"')).toBeNull();
      expect(quoted('@"Footsteps"')).toBeNull();
    });

    it('honours an escaped quote inside the value', () => {
      expect(quoted('"a\\"b"')).toBeNull();
      expect(name('"a\\"b"')).toBeNull();
    });

    it('rejects two literals glued together', () => {
      // The previous grammar checked only the first and last character, so this
      // read as one string.
      expect(quoted('"Head" junk "Tail"')).not.toBeNull();
      expect(name('"Head" junk "Tail"')).not.toBeNull();
    });

    it('rejects an unterminated literal', () => {
      expect(quoted('"unterminated')).not.toBeNull();
      expect(name('&"unterminated')).not.toBeNull();
    });

    it('accepts the empty string', () => {
      expect(quoted('""')).toBeNull();
      expect(name('&""')).toBeNull();
    });
  });
});
