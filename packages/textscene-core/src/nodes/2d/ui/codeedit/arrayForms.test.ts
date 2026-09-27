/**
 * The shared reader of CodeEdit's string arrays, which the delimiter validator, the collision rule
 * and the render parser all call. Each spelling reads as Godot's tokenizer reads it.
 */

import { describe, expect, it } from 'vitest';
import { parsePackedStringArray } from './arrayForms';

describe('parsePackedStringArray', () => {
  it('reads the elements of each of the three spellings', () => {
    expect(parsePackedStringArray('Array[String](["#", "/* */"])')).toEqual(['#', '/* */']);
    expect(parsePackedStringArray('PackedStringArray("#", "/* */")')).toEqual(['#', '/* */']);
    expect(parsePackedStringArray('["#", "/* */"]')).toEqual(['#', '/* */']);
  });

  it('reads an empty array as no elements, not as malformed', () => {
    expect(parsePackedStringArray('Array[String]([])')).toEqual([]);
    expect(parsePackedStringArray('PackedStringArray()')).toEqual([]);
  });

  it('takes one trailing comma, as both engine loops do', () => {
    // `_parse_array` closes on `]` after a comma (variant_parser.cpp:1658-1660), and the
    // PackedStringArray loop breaks on `)` after one (:1524-1525).
    expect(parsePackedStringArray('Array[String](["#",])')).toEqual(['#']);
    expect(parsePackedStringArray('["#",]')).toEqual(['#']);
    expect(parsePackedStringArray('PackedStringArray("#",)')).toEqual(['#']);
  });

  it('refuses a lone comma, an interior empty element and a non-string element', () => {
    // A comma with no value before it reaches `parse_value`, which fails (:1673-1676), and the
    // packed loop wants a string where it finds the comma (:1526-1529).
    expect(parsePackedStringArray('[,]')).toBeNull();
    expect(parsePackedStringArray('PackedStringArray(,)')).toBeNull();
    expect(parsePackedStringArray('["#",,]')).toBeNull();
    expect(parsePackedStringArray('["#", 5]')).toBeNull();
  });

  it('keeps a comma inside a quoted element as part of it', () => {
    expect(parsePackedStringArray('["a, b", "\\" \\""]')).toEqual(['a, b', '" "']);
  });

  it('refuses text that is no array spelling', () => {
    expect(parsePackedStringArray('"#"')).toBeNull();
  });
});
