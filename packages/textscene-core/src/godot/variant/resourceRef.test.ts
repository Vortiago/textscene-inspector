/**
 * The one spelling of a resource reference, and every reader of it.
 *
 * The padded cases are the point: they are what eleven hand-written copies
 * disagreed about, and what a linter and three parsers answered differently.
 */

import { describe, expect, it } from 'vitest';
import {
  valueReadsAt,
  valueReadsIn,
  literalReadsIn,
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  dictSubResourceEntries,
  isPathResourceLiteral,
  keyedResourceRefReader,
  openResourceRef,
  renameResourceRefs,
  resourceRef,
  resourceRefSpansByLine,
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
    // The old-style index is a non-negative int. A quoted id is the spelling
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

// The text loader sets no `rp.func`, so `Resource(…)` takes the generic branch
// (`variant_parser.cpp:1123-1185`) and loads by path.
describe('isPathResourceLiteral', () => {
  it.each([
    'Resource("res://a.tres")',
    'Resource ( "res://a.tres" )',
    'Resource("uid://b3x")',
    'Resource("res://a.tres", "uid://b3x")',
    'Resource("uid://b3x", "res://a.tres")',
  ])('reads %s', (raw) => {
    expect(isPathResourceLiteral(raw)).toBe(true);
  });

  it('refuses the two-argument spellings the parser refuses', () => {
    // `variant_parser.cpp:1141-1152`: one uid and one path, never two of either.
    expect(isPathResourceLiteral('Resource("uid://a", "uid://b")')).toBe(false);
    expect(isPathResourceLiteral('Resource("res://a.tres", "res://b.tres")')).toBe(false);
  });

  it('refuses an argument that is not a string', () => {
    // `variant_parser.cpp:1183`: "Expected string as argument for Resource()".
    expect(isPathResourceLiteral('Resource()')).toBe(false);
    expect(isPathResourceLiteral('Resource(1)')).toBe(false);
    expect(isPathResourceLiteral('Resource("res://a.tres", 2)')).toBe(false);
  });

  it('is a whole value, and neither reference kind', () => {
    expect(isPathResourceLiteral('[Resource("res://a.tres")]')).toBe(false);
    expect(isPathResourceLiteral('ExtResource("1")')).toBe(false);
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

/** The id of each `ExtResource` read of `text`, in order. */
function extResourceIds(text: string): string[] {
  return valueReadsIn(text).flatMap((read) => (read.kind === 'ExtResource' ? [read.id] : []));
}

describe('the ExtResource reads of valueReadsIn', () => {
  it('reads the id of a whole-value reference', () => {
    expect(extResourceIds('ExtResource("1_glb")')).toEqual(['1_glb']);
  });

  it('reads every reference inside a container, in order, padded and integer ids included', () => {
    expect(extResourceIds('[ExtResource("a"), { "k": ExtResource ( "b" ) }, ExtResource(3)]')).toEqual([
      'a',
      'b',
      '3',
    ]);
  });

  it('skips a reference spelled inside a string, which the loader never resolves', () => {
    expect(extResourceIds('["ExtResource(\\"a\\")", &"ExtResource(\\"b\\")", ExtResource("c")]')).toEqual([
      'c',
    ]);
  });

  it('keeps reading after a string that ends in an escaped backslash', () => {
    expect(extResourceIds('["dir\\\\", ExtResource("a")]')).toEqual(['a']);
  });

  it('skips a SubResource and a malformed call', () => {
    expect(extResourceIds('[SubResource("a"), ExtResource(), MyExtResource("b")]')).toEqual([]);
  });

  it('gives an empty list for a value with no reference', () => {
    expect(extResourceIds('Vector3(1, 2, 3)')).toEqual([]);
  });
});

describe('resourceRefSpansByLine', () => {
  it('finds every reference in a text with its span, padded and integer forms included', () => {
    const text = 'a = [ExtResource("1_a"), SubResource ( "b" ), ExtResource(3)]';

    expect(resourceRefSpansByLine([text])[0]).toEqual([
      { kind: 'ExtResource', id: '1_a', start: 5, end: 23 },
      { kind: 'SubResource', id: 'b', start: 25, end: 44 },
      { kind: 'ExtResource', id: '3', start: 46, end: 60 },
    ]);
  });

  it('finds nothing in a text with no reference', () => {
    expect(resourceRefSpansByLine(['Vector3(1, 2, 3)'])).toEqual([[]]);
  });

  it('skips a reference inside a string that spans lines, which the loader never resolves', () => {
    const lines = ['text = "first', 'ExtResource(1) still text"', 'texture = ExtResource("2")'];

    expect(resourceRefSpansByLine(lines).map((spans) => spans.map((s) => s.id))).toEqual([[], [], ['2']]);
  });

  it('skips a reference in a comment, and a quote there opens no string', () => {
    const lines = ['; ExtResource("1") and a stray "', 'texture = ExtResource("2")'];

    expect(resourceRefSpansByLine(lines).map((spans) => spans.map((s) => s.id))).toEqual([[], ['2']]);
  });
});

describe('openResourceRef', () => {
  it('reads the kind and the id typed so far inside an open quote', () => {
    expect(openResourceRef('mesh = SubResource( "Box')).toEqual({ kind: 'SubResource', id: 'Box' });
  });

  it('reads an empty id right after the opening quote', () => {
    expect(openResourceRef('texture = ExtResource("')).toEqual({ kind: 'ExtResource', id: '' });
  });

  it('answers null once the quote is closed', () => {
    expect(openResourceRef('texture = ExtResource("1")')).toBeNull();
  });
});

describe('renameResourceRefs', () => {
  const tagged = (ref: { kind: string; id: string }) => `${ref.kind[0]}${ref.id}`;

  it('renames the id of both kinds, padded and integer ids included', () => {
    expect(renameResourceRefs('[ExtResource ( "a" ), SubResource(2)]', tagged)).toBe(
      '[ExtResource("Ea"), SubResource("S2")]'
    );
  });

  it('leaves a reference spelled inside a string, which the loader never resolves', () => {
    const text = '["ExtResource(\\"a\\")", &"SubResource(\\"b\\")"]';
    expect(renameResourceRefs(text, tagged)).toBe(text);
  });

  it('keeps a reference whose id stays as written', () => {
    expect(renameResourceRefs('[ExtResource ( 1 ), SubResource(2)]', (ref) => ref.id)).toBe(
      '[ExtResource ( 1 ), SubResource(2)]'
    );
  });

  it('returns a value with no reference unchanged', () => {
    expect(renameResourceRefs('Vector3(1, 2, 3)', tagged)).toBe('Vector3(1, 2, 3)');
  });
});

describe('valueReadsIn', () => {
  it('gives the ExtResource ids and Resource() literals in text order', () => {
    expect(valueReadsIn('[Resource("res://a.tres"), ExtResource("1"), Resource("res://b.tres")]')).toEqual([
      { kind: 'Resource', path: 'res://a.tres', uid: '' },
      { kind: 'ExtResource', id: '1' },
      { kind: 'Resource', path: 'res://b.tres', uid: '' },
    ]);
  });

  it('keeps the uid of a literal beside its path', () => {
    expect(valueReadsIn('Resource("uid://abc", "res://a.tres")')).toEqual([
      { kind: 'Resource', path: 'res://a.tres', uid: 'uid://abc' },
    ]);
  });

  it('gives the id of a SubResource beside an ExtResource, as Godot fails an undeclared one', () => {
    expect(valueReadsIn('[SubResource("x"), ExtResource("1")]')).toEqual([
      { kind: 'SubResource', id: 'x' },
      { kind: 'ExtResource', id: '1' },
    ]);
  });

  it.each([
    ['Resource("res://a.tres", "res://b.tres")', 'paths'],
    ['Resource("uid://a", "uid://b")', 'uids'],
  ])('gives a refused read for %s, which Godot does not parse, naming two %s', (literal, twice) => {
    expect(valueReadsIn(literal)).toEqual([{ kind: 'Refused', twice }]);
  });
});

describe('valueReadsAt', () => {
  it("gives a reference's id past the padding get_token skips, and a literal's closing parenthesis", () => {
    const text = '[ExtResource(\n"1"), Resource( "res://a.tres"\n)]';
    expect(valueReadsAt(text).map(({ printedAt }) => text.slice(printedAt, printedAt + 3))).toEqual([
      '"1"',
      ')]',
    ]);
  });
});

describe('literalReadsIn', () => {
  it('reads the path of each Resource literal in an Array, in order', () => {
    const value = '[Resource("res://a.ttf"), Resource ( "uid://b3x" , "res://b.fnt" )]';

    expect(literalReadsIn(value)).toEqual([
      { kind: 'Resource', path: 'res://a.ttf', uid: '' },
      { kind: 'Resource', path: 'res://b.fnt', uid: 'uid://b3x' },
    ]);
  });

  it('gives a null path for a literal that names only a uid, which nothing here resolves', () => {
    expect(literalReadsIn('Resource("uid://b3x")')).toEqual([
      { kind: 'Resource', path: null, uid: 'uid://b3x' },
    ]);
  });

  it('gives the Resource() literals and no ExtResource', () => {
    expect(literalReadsIn('[ExtResource("1"), Resource("uid://abc", "res://a.tres")]')).toEqual([
      { kind: 'Resource', path: 'res://a.tres', uid: 'uid://abc' },
    ]);
  });

  it('reads no path from a literal with two paths, which Godot refuses (variant_parser.cpp:1141-1152)', () => {
    expect(literalReadsIn('[Resource("res://a.ttf", "res://b.ttf")]')).toEqual([]);
  });

  it('reads nothing from a value that names no resource', () => {
    expect(literalReadsIn('Vector3(1, 2, 3)')).toEqual([]);
  });

  it('skips a literal in a comment and in a string, as the loader does', () => {
    const value =
      '[\n; Resource("res://gone.png")\n"Resource(\\"res://text.png\\")", Resource("res://a.png")]';

    expect(literalReadsIn(value)).toEqual([{ kind: 'Resource', path: 'res://a.png', uid: '' }]);
  });

  it('reads nothing from a literal with two paths, as Godot does not parse it', () => {
    expect(literalReadsIn('Resource("res://a.ttf", "res://b.ttf")')).toEqual([]);
  });
});
