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
  isNilLiteral,
  nodePathLiteral,
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

  // `variant.cpp:746-749`: `case NODE_PATH: valid[] = { STRING, NIL }`, and
  // `Variant::operator NodePath()` (`:2001`) builds the path from the STRING —
  // so a bare `"../Body"` in a NodePath slot loads as the same path. A
  // StringName is not in that list.
  it('reads a bare quoted string as the path the slot converts it to', () => {
    expect(nodePathLiteral('"../Body"')).toBe('../Body');
    expect(nodePathLiteral('""')).toBe('');
    expect(nodePathLiteral(' "Body" ')).toBe('Body');
    expect(nodePathLiteral('"a" junk "b"')).toBeNull();
  });

  it('does not span two literals, the hole a greedy `.*` left', () => {
    expect(nodePathLiteral('NodePath("a") junk NodePath("b")')).toBeNull();
  });

  it('keeps whitespace INSIDE the quotes, which is part of the path', () => {
    expect(nodePathLiteral('NodePath(" a ")')).toBe(' a ');
  });
});

describe('the anchored and anywhere forms agree on whitespace', () => {
  // The divergence that motivated this module: the anchored copies were widened
  // to tolerate padding while the scanning copies were not, so a value the
  // linter passed was dropped by the parser that had to resolve it.
  const PADDED_NODE_PATH = 'NodePath ( "../Body" )';

  it('the NodePath scanner reads what the NodePath validator accepts', () => {
    expect(NODE_PATH_LITERAL_RE.test(PADDED_NODE_PATH)).toBe(true);
    expect(NODE_PATH_LITERAL_ANYWHERE_RE.exec(PADDED_NODE_PATH)?.[1]).toBe('../Body');
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
      expect(NODE_PATH_LITERAL_RE.test('NodePath("a")')).toBe(true);
    }
  });
});

describe('the NIL literal', () => {
  it('takes both spellings the parser reads through one arm', () => {
    // `variant_parser.cpp:699` — `} else if (id == "null" || id == "nil") {`
    expect(isNilLiteral('null')).toBe(true);
    expect(isNilLiteral('nil')).toBe(true);
  });

  it('tolerates the padding the tokenizer discards', () => {
    expect(isNilLiteral('  null ')).toBe(true);
    expect(isNilLiteral('\tnil')).toBe(true);
  });

  it('is a WHOLE value, so a composite argument is still a parse error', () => {
    // `stor_fix` (`variant_parser.cpp:149-159`) knows only inf/-inf/inf_neg/nan,
    // so `Vector2(nil, 0)` is a real ERR_PARSE_ERROR and must not read as NIL.
    expect(isNilLiteral('Vector2(nil, 0)')).toBe(false);
    expect(isNilLiteral('nil,')).toBe(false);
    expect(isNilLiteral('nullptr')).toBe(false);
    expect(isNilLiteral('nils')).toBe(false);
    expect(isNilLiteral('NULL')).toBe(false);
    expect(isNilLiteral('')).toBe(false);
  });
});
