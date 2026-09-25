/**
 * Which line the format version is read from, and what counts as declaring one.
 */

import { describe, expect, it } from 'vitest';
import { isLegacyFormat, readHeaderFormat } from './headerFormat.js';

describe('readHeaderFormat', () => {
  it('reads the version and the line off a plain header', () => {
    expect(readHeaderFormat('[gd_scene format=3]\n')).toEqual({ format: 3, line: 1 });
    expect(readHeaderFormat('[gd_resource type="Curve" format=2]\n')).toEqual({
      format: 2,
      line: 1,
    });
  });

  it('skips leading blank and comment lines to find the header', () => {
    // A scene may open with a `;` block and carry the header below it.
    const content = '; A comment\n;; another\n\n[gd_scene format=2]\n';
    expect(readHeaderFormat(content)).toEqual({ format: 2, line: 4 });
  });

  it('reports no version when the header declares none', () => {
    // Absent is current, not oldest: the engine defaults it to FORMAT_VERSION
    // (resource_format_text.cpp:1147-1148).
    expect(readHeaderFormat('[gd_scene]\n')).toEqual({ format: null, line: 1 });
    expect(readHeaderFormat('[gd_scene load_steps=2 uid="uid://abc"]\n')).toEqual({
      format: null,
      line: 1,
    });
  });

  it('reports no version for text no number grammar reads', () => {
    expect(readHeaderFormat('[gd_scene format=abc]\n')?.format).toBeNull();
    expect(readHeaderFormat('[gd_scene format=]\n')?.format).toBeNull();
    // Digits and an exponent, but it overflows: a grammar cannot catch this,
    // so the finite check is on the parsed result.
    expect(readHeaderFormat('[gd_scene format=1e999]\n')?.format).toBeNull();
  });

  it('truncates a number spelling, because the engine assigns it to an int', () => {
    // `format_version = tag.fields["format"]` (resource_format_text.cpp:1140)
    // targets `int format_version` (resource_format_text.h:68), so the field is
    // read as a Variant number and truncated. Reading `format=2.0` as absent
    // would mean current (:1147-1148), and lint a legacy file.
    expect(readHeaderFormat('[gd_scene format=3.0]\n')?.format).toBe(3);
    expect(readHeaderFormat('[gd_scene format=2.0]\n')?.format).toBe(2);
    expect(readHeaderFormat('[gd_scene format=2.9]\n')?.format).toBe(2);
    expect(readHeaderFormat('[gd_scene format=-1]\n')?.format).toBe(-1);
  });

  it('reads the bare-exponent spellings Godot loads, which `Number` calls NaN', () => {
    // `READING_EXP` takes a sign and zero digits (variant_parser.cpp:466-472),
    // so `2e` and `1e-` load as 2 and 1. `Number('2e')` is NaN, the absent case,
    // which means current and would lint a format-2 file.
    expect(readHeaderFormat('[gd_scene format=2e]\n')?.format).toBe(2);
    expect(readHeaderFormat('[gd_scene format=1e-]\n')?.format).toBe(1);
    expect(readHeaderFormat('[gd_scene format=5.e2]\n')?.format).toBe(500);
  });

  it('stops at an unreadable header rather than advancing past it', () => {
    // `edge-malformed-bracket.tscn`'s shape. Advancing would hand the caller an
    // `[ext_resource …]` line to answer for the file.
    const content = '[gd_scene format=3\n\n[ext_resource type="Texture2D" path="res://a.png" id="1"]\n';
    expect(readHeaderFormat(content)).toBeNull();
  });

  it('declines content that opens with neither header', () => {
    expect(readHeaderFormat('[ext_resource type="Texture2D" id="1"]\n')).toBeNull();
    expect(readHeaderFormat('not a scene at all\n')).toBeNull();
    expect(readHeaderFormat('')).toBeNull();
  });
});

describe('isLegacyFormat', () => {
  it('declines only 1 and 2: the engine has no lower bound, so 0 and below load as current', () => {
    // `if (format_version > FORMAT_VERSION)` (resource_format_text.cpp:1141)
    // is the loader's only comparison.
    expect([-1, 0, 1, 2, 3, 4, null].map(isLegacyFormat)).toEqual([
      false, false, true, true, false, false, false,
    ]);
  });
});
