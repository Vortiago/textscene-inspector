/**
 * The one spelling of a resource reference, and every reader of it.
 *
 * The padded cases are the point: they are what eleven hand-written copies
 * disagreed about, and what a linter and three parsers answered differently.
 */

import { describe, expect, it } from 'vitest';
import {
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  dictSubResourceEntries,
  keyedResourceRefReader,
  resourceRef,
  subResourceRefAnywhere,
} from './resourceRef.js';

describe('resourceRef', () => {
  it.each([
    ['SubResource("Curve3D_a1b")', 'SubResource', 'Curve3D_a1b'],
    ['ExtResource("1_proj")', 'ExtResource', '1_proj'],
    ['SubResource ( "Curve3D_a1b" )', 'SubResource', 'Curve3D_a1b'],
    ['ExtResource ("1_proj")', 'ExtResource', '1_proj'],
  ] as const)('reads %s', (raw, kind, id) => {
    expect(resourceRef(raw)).toEqual({ kind, id });
  });

  it('accepts an id the old validator class rejected', () => {
    // The validator alone read `[\w-]+` while every resolver read `[^"]+`, so
    // the linter was the strictest reader of an id it does not itself look up.
    expect(resourceRef('ExtResource("res://a b.png")')).toEqual({
      kind: 'ExtResource',
      id: 'res://a b.png',
    });
  });

  it('requires a non-empty id, and rejects a non-reference', () => {
    expect(resourceRef('SubResource("")')).toBeNull();
    expect(resourceRef('null')).toBeNull();
    expect(resourceRef('Resource("x")')).toBeNull();
  });

  // The loader takes TK_NUMBER as well as TK_STRING (`resource_format_text.cpp:107,128`) and stringifies the int,
  // as the header's `String id = next_tag.fields["id"]` is (`:488`, `:1048`), so `id=1` and `ExtResource(1)` meet as "1".
  it.each([
    ['ExtResource(1)', 'ExtResource', '1'],
    ['SubResource(3)', 'SubResource', '3'],
    ['SubResource( 3 )', 'SubResource', '3'],
    ['ExtResource (12)', 'ExtResource', '12'],
  ] as const)('reads the old-style integer index %s as the id string', (raw, kind, id) => {
    expect(resourceRef(raw)).toEqual({ kind, id });
  });

  it('keeps the digits as written, the way the header scanner stores them', () => {
    expect(resourceRef('SubResource(03)')?.id).toBe('03');
  });

  it('takes only the unsigned integer index, not the other number spellings', () => {
    // The old-style index is a non-negative int; a quoted id is the spelling
    // for anything else.
    expect(resourceRef('SubResource(-1)')).toBeNull();
    expect(resourceRef('SubResource(1.5)')).toBeNull();
    expect(resourceRef('SubResource(1e1)')).toBeNull();
    expect(resourceRef('SubResource()')).toBeNull();
    expect(resourceRef('SubResource(1 2)')).toBeNull();
    expect(resourceRef('SubResource(abc)')).toBeNull();
  });

  it('is a WHOLE value, so an embedded reference is not one', () => {
    expect(resourceRef('[SubResource("a")]')).toBeNull();
  });

  // No `g` flag, so `.exec()` carries no `lastIndex` between callers.
  it('is stateless across calls', () => {
    for (let i = 0; i < 3; i++) expect(resourceRef('SubResource("a")')).not.toBeNull();
  });
});

describe('the anchored and anywhere readers agree on whitespace', () => {
  // The divergence that motivated this module: the anchored copies were widened
  // to tolerate padding while the scanning copies were not, so a value the
  // linter passed was dropped by the parser that had to resolve it.
  const PADDED_REF = 'SubResource ( "Curve3D_a1b" )';

  it('the SubResource scanner reads what the reference validator accepts', () => {
    expect(resourceRef(PADDED_REF)?.id).toBe('Curve3D_a1b');
    expect(subResourceRefAnywhere(PADDED_REF)).toBe('Curve3D_a1b');
  });

  it('finds a reference embedded in a larger value, where the anchored reader must not', () => {
    const embedded = `nodes/Walk/node = ${PADDED_REF}`;
    expect(resourceRef(embedded)).toBeNull();
    expect(subResourceRefAnywhere(embedded)).toBe('Curve3D_a1b');
  });

  it('the scanner reads only a SubResource', () => {
    expect(subResourceRefAnywhere('ExtResource("1_a")')).toBeNull();
  });

  it('every reader takes the integer index', () => {
    expect(subResourceRefAnywhere('nodes/Walk/node = SubResource(3)')).toBe('3');
    expect(dictSubResourceEntries('{ "": SubResource(3), "b": SubResource("x") }')).toEqual([
      { key: '', id: '3' },
      { key: 'b', id: 'x' },
    ]);
    expect(keyedResourceRefReader('texture')('{ "texture": ExtResource(1) }')).toBe('ExtResource(1)');
  });
});

describe('dictSubResourceEntries', () => {
  it('reads every entry in order, an EMPTY key included', () => {
    const dict = '{\n"": SubResource("Lib_a"),\n"combat": SubResource ( "Lib_b" )\n}';
    expect(dictSubResourceEntries(dict)).toEqual([
      { key: '', id: 'Lib_a' },
      { key: 'combat', id: 'Lib_b' },
    ]);
  });

  it('skips an ExtResource entry, which points outside the file', () => {
    expect(dictSubResourceEntries('{ "walk": ExtResource("1_a"), "run": SubResource("b") }')).toEqual([
      { key: 'run', id: 'b' },
    ]);
  });

  it('is stateless across calls, with a shared `g` instance behind it', () => {
    const dict = '{ "a": SubResource("x") }';
    for (let i = 0; i < 3; i++) expect(dictSubResourceEntries(dict)).toHaveLength(1);
  });
});

describe('keyedResourceRefReader', () => {
  const texture = keyedResourceRefReader('texture');

  it('hands back the literal, padding kept, for a reader that stores references undecoded', () => {
    expect(texture('{ "texture": ExtResource( "2" ), "duration": 1.0 }')).toBe('ExtResource( "2" )');
  });

  it('reads null for an absent key and for a slot holding no reference', () => {
    expect(texture('{ "duration": 1.0 }')).toBeNull();
    expect(texture('{ "texture": null }')).toBeNull();
  });

  // No `g` flag, so one instance per key carries no `lastIndex` between frames.
  it('is stateless across calls', () => {
    for (let i = 0; i < 3; i++) expect(texture('{ "texture": ExtResource("2") }')).toBe('ExtResource("2")');
  });
});

describe('the ExtResource discriminator', () => {
  it('takes the padding the tokenizer discards', () => {
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('{ "walk": ExtResource("1_abc") }')).toBe(true);
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('{ "walk": ExtResource ("1_abc") }')).toBe(true);
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('{ "walk": ExtResource\t( "1_abc" ) }')).toBe(true);
  });

  it('stops at the paren, so any id spelling counts as a reference', () => {
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('ExtResource( 1 )')).toBe(true);
  });

  it('says nothing about a SubResource, which is resolvable in-file', () => {
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('{ "walk": SubResource("Animation_1") }')).toBe(false);
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test('"ExtResource"')).toBe(false);
  });

  // No `g` flag, so `.test()` carries no `lastIndex` between callers.
  it('is stateless across calls', () => {
    const value = 'ExtResource("1_abc")';
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test(value)).toBe(true);
    expect(EXT_RESOURCE_CALL_ANYWHERE_RE.test(value)).toBe(true);
  });
});
