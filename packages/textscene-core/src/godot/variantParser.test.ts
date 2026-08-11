/**
 * The one spelling of `variant_parser.cpp`'s constructor-call literals.
 *
 * The padded cases are the point: they are what eleven hand-written copies
 * disagreed about, and what a linter and three parsers answered differently.
 */

import { describe, expect, it } from 'vitest';
import {
  NODE_PATH_LITERAL_ANYWHERE_RE,
  NODE_PATH_LITERAL_RE,
  RESOURCE_REF_RE,
  SUB_RESOURCE_REF_ANYWHERE_RE,
  SUB_RESOURCE_REF_BODY,
  nodePathLiteral,
  resourceRef,
} from './variantParser.js';

describe('nodePathLiteral', () => {
  it('reads the tight form Godot writes', () => {
    expect(nodePathLiteral('NodePath("../Body")')).toBe('../Body');
  });

  it.each([
    'NodePath ("../Body")',
    'NodePath( "../Body" )',
    'NodePath ( "../Body" )',
    'NodePath\t("../Body")',
  ])('reads the padded form Godot also loads: %s', (raw) => {
    // get_token discards any character <= 32 before a token
    // (variant_parser.cpp:415-417), so every one of these is one literal.
    expect(nodePathLiteral(raw)).toBe('../Body');
  });

  it('keeps an EMPTY path as an empty string, not as "not a NodePath"', () => {
    // An explicitly cleared key is a real serialised value, and collapsing it
    // into null is what let it take an ABSENT key's default.
    expect(nodePathLiteral('NodePath("")')).toBe('');
  });

  it('returns null for a value that is not a NodePath literal', () => {
    expect(nodePathLiteral('&"spin"')).toBeNull();
    expect(nodePathLiteral('')).toBeNull();
  });

  it('does not span two literals, the hole a greedy `.*` left', () => {
    expect(nodePathLiteral('NodePath("a") junk NodePath("b")')).toBeNull();
  });

  it('keeps whitespace INSIDE the quotes, which is part of the path', () => {
    expect(nodePathLiteral('NodePath(" a ")')).toBe(' a ');
  });
});

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
});

describe('the anchored and anywhere forms agree on whitespace', () => {
  // The divergence that motivated this module: the anchored copies were widened
  // to tolerate padding while the scanning copies were not, so a value the
  // linter passed was dropped by the parser that had to resolve it.
  const PADDED_NODE_PATH = 'NodePath ( "../Body" )';
  const PADDED_REF = 'SubResource ( "Curve3D_a1b" )';

  it('the NodePath scanner reads what the NodePath validator accepts', () => {
    expect(NODE_PATH_LITERAL_RE.test(PADDED_NODE_PATH)).toBe(true);
    expect(NODE_PATH_LITERAL_ANYWHERE_RE.exec(PADDED_NODE_PATH)?.[1]).toBe('../Body');
  });

  it('the SubResource scanner reads what the reference validator accepts', () => {
    expect(RESOURCE_REF_RE.test(PADDED_REF)).toBe(true);
    expect(SUB_RESOURCE_REF_ANYWHERE_RE.exec(PADDED_REF)?.[1]).toBe('Curve3D_a1b');
  });

  it('an assembled pattern inherits the same tolerance', () => {
    const tokens = `[&"Start", &"Idle", ${PADDED_REF}]`.match(
      new RegExp(`"[^"]*"|${SUB_RESOURCE_REF_BODY}`, 'g')
    );
    expect(tokens).toContain(PADDED_REF);
  });

  it('finds a literal embedded in a larger value, where the anchored form must not', () => {
    const embedded = 'Array[NodePath]([NodePath("a")])';
    expect(NODE_PATH_LITERAL_RE.test(embedded)).toBe(false);
    expect(NODE_PATH_LITERAL_ANYWHERE_RE.exec(embedded)?.[1]).toBe('a');
  });
});

describe('shared instances are stateless', () => {
  it('re-tests the same value without a `g` flag carrying lastIndex', () => {
    // A shared `g` regex would answer true, then false, then true.
    for (let i = 0; i < 3; i++) {
      expect(RESOURCE_REF_RE.test('SubResource("a")')).toBe(true);
      expect(NODE_PATH_LITERAL_RE.test('NodePath("a")')).toBe(true);
    }
  });
});
