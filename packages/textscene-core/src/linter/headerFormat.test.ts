/**
 * Which line the format version is read from, and what counts as declaring one.
 */

import { describe, expect, it } from 'vitest';
import { readHeaderFormat } from './headerFormat.js';

describe('readHeaderFormat', () => {
  it('reads the version and the line off a plain header', () => {
    expect(readHeaderFormat('[gd_scene format=3]\n')).toEqual({ format: 3, line: 1 });
    expect(readHeaderFormat('[gd_resource type="Curve" format=2]\n')).toEqual({
      format: 2,
      line: 1,
    });
  });

  it('skips leading blank and comment lines to find the header', () => {
    // 40 scenes under scenes/ open with a `;` block and carry the header below
    // it, so a line-1 read misses every one of them.
    const content = '; A comment\n;; another\n\n[gd_scene format=2]\n';
    expect(readHeaderFormat(content)).toEqual({ format: 2, line: 4 });
  });

  it('reports no version when the header declares none', () => {
    // Absent is CURRENT, not oldest — the engine defaults it to FORMAT_VERSION
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
    // so the finite check is on the parsed RESULT.
    expect(readHeaderFormat('[gd_scene format=1e999]\n')?.format).toBeNull();
  });

  it('truncates a number spelling, because the engine assigns it to an int', () => {
    // `format_version = tag.fields["format"]` (resource_format_text.cpp:1140)
    // targets `int format_version` (resource_format_text.h:68), so the field is
    // read as a Variant number and truncated. Reading only `\d+` reported
    // `format=2.0` as ABSENT, and absent means CURRENT (:1147-1148) — so a
    // legacy file was linted against a grammar it predates.
    expect(readHeaderFormat('[gd_scene format=3.0]\n')?.format).toBe(3);
    expect(readHeaderFormat('[gd_scene format=2.0]\n')?.format).toBe(2);
    expect(readHeaderFormat('[gd_scene format=2.9]\n')?.format).toBe(2);
    expect(readHeaderFormat('[gd_scene format=-1]\n')?.format).toBe(-1);
  });

  it('stops at an unreadable header rather than advancing past it', () => {
    // `edge-malformed-bracket.tscn`'s shape. Advancing would hand the caller an
    // `[ext_resource …]` line and let it answer for the file.
    const content = '[gd_scene format=3\n\n[ext_resource type="Texture2D" path="res://a.png" id="1"]\n';
    expect(readHeaderFormat(content)).toBeNull();
  });

  it('declines content that opens with neither header', () => {
    expect(readHeaderFormat('[ext_resource type="Texture2D" id="1"]\n')).toBeNull();
    expect(readHeaderFormat('not a scene at all\n')).toBeNull();
    expect(readHeaderFormat('')).toBeNull();
  });
});
