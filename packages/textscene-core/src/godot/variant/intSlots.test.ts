/**
 * The integer slots a literal reaches: the int32 narrowing, the rule and slot reads, and the
 * composite tuple reads. The reader they build on has its own tests in `intReader.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  readIntSlot,
  slotWidth,
  readSlotTuple,
  ruleCount,
  ruleInt,
  slotCount,
  slotInt,
  slotComponents,
  slotComponentsAltered,
  storedInt,
  storedVector2i,
} from './intSlots.js';
import { slotTupleRegex } from './number.js';

describe('storedInt — a capture the composite grammar already matched', () => {
  it('narrows to int32, so the previewer and the linter agree', () => {
    // `Vector2i` components are `int32_t` (vector2i.h:56-57). Without the
    // narrowing the renderer placed a node at 4.29e8 while the linter, reading
    // -1, stayed silent about it.
    expect(storedInt('4294967295')).toBe(-1);
    expect(storedInt('5.9')).toBe(5);
  });

  it('is null for a component no int32 can hold', () => {
    expect(storedInt('inf')).toBeNull();
    expect(storedInt('1e20')).toBeNull();
  });

  it('names the stored number of each probe component', () => {
    expect(storedInt('4294967295')).toBe(-1);
    expect(storedInt('2147483648')).toBe(-2147483648);
  });
});

describe('ruleInt and slotInt over a literal the file does not state', () => {
  it('gives the rule no number, so phase 1 alone reports the alteration', () => {
    expect(ruleInt('4294967296')).toBeNull();
    expect(ruleInt('4294967295')).toBe(-1);
  });

  it('gives the renderer the number Godot stores', () => {
    expect(slotInt('4294967296')).toBe(0);
    expect(slotInt('8589934593')).toBe(1);
  });

  it('reads a count the same two ways', () => {
    expect(ruleCount('4294967297')).toBeNull();
    expect(slotCount('4294967297')).toBe(1);
    expect(slotCount('-4294967297')).toBe(0);
  });

  it('reads a FLOAT outside the width as nothing in both', () => {
    expect(ruleInt('1e10')).toBeNull();
    expect(slotInt('1e10')).toBeNull();
  });
});

describe('ruleInt', () => {
  it('collapses both refusals to null, so a rule goes silent', () => {
    expect(ruleInt('8abc')).toBeNull();
    expect(ruleInt('inf')).toBeNull();
  });

  it('stands an absent key in for its default', () => {
    expect(ruleInt(undefined, 1)).toBe(1);
    expect(ruleInt(undefined)).toBeNull();
  });
});

describe('slotComponentsAltered — a composite in a FLOAT slot', () => {
  const parts = (literal: string): string[] =>
    /\(([^)]*)\)/
      .exec(literal)![1]!
      .split(',')
      .map((part) => part.trim());
  const altered = (literal: string, slot = 'Vector3'): boolean =>
    slotComponentsAltered(literal, slot, parts(literal));

  it('reports the non-finite the int spelling narrows, which no bound can see', () => {
    // `_parse_construct<int32_t>` accepts the identifier through `stor_fix`
    // (variant_parser.cpp:149-159, :577-586) and `_to_int<int32_t>` then converts the double
    // (variant.h:369-370), undefined outside int32, so the engine stores a number the file lacks.
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(altered(`Vector3i(${spelling}, 0, 0)`)).toBe(true);
    }
    // And the bound it defeats: NaN is below no minimum and above no maximum.
    const [x] = slotComponents('Vector3i(inf, 0, 0)', 'Vector3', parts('Vector3i(inf, 0, 0)'));
    expect(Number.isNaN(x)).toBe(true);
  });

  it('reports an INT component outside the band int32 round-trips', () => {
    expect(altered('Vector3i(4294967296, 0, 0)')).toBe(true);
    expect(altered('Vector3i(-3000000000, 0, 0)')).toBe(true);
  });

  it('is false for the legal non-finite FLOAT component, which is the whole point', () => {
    // Godot writes `inf`/`nan` into every real-typed composite and reloads them
    // (variant_parser.cpp:149-159), so the slot's own spelling alters nothing: the conflation this
    // predicate exists to break.
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(altered(`Vector3(${spelling}, 0, 0)`)).toBe(false);
    }
  });

  it('is false for an int spelling every component fits', () => {
    expect(altered('Vector3i(3, 4, 5)')).toBe(false);
    // Wrapping is a spelling Godot's own serialiser writes, not an alteration.
    expect(altered('Vector3i(4294967295, 0, 0)')).toBe(false);
    // Truncation toward zero is the `truncatedInt` warning's business, not this.
    expect(altered('Vector3i(1.5, 0, 0)')).toBe(false);
  });

  it('answers only for a spelling the slot converts', () => {
    expect(slotComponentsAltered('Vector2i(inf, 0)', 'Vector2', ['inf', '0'])).toBe(true);
    expect(slotComponentsAltered('Rect2i(inf, 0, 0, 0)', 'Rect2', ['inf', '0', '0', '0'])).toBe(true);
    // No conversion is declared between these, so the literal is a format
    // error the caller reports, never a narrowed component.
    expect(slotComponentsAltered('Transform2D(inf, 0)', 'Transform2D', ['inf', '0'])).toBe(false);
  });
});

describe('storedVector2i — a Vector2i slot literal', () => {
  it('stores the pair the canonical spelling states, truncating a float token', () => {
    expect(storedVector2i('Vector2i(600, 400)')).toEqual({ x: 600, y: 400 });
    // `_parse_construct<int32_t>` takes any number token and truncates it.
    expect(storedVector2i('Vector2i(2e1, 1.9)')).toEqual({ x: 20, y: 1 });
  });

  it('takes the padding the tokenizer discards (variant_parser.cpp:415-417)', () => {
    expect(storedVector2i('  Vector2i ( -3 , 4 ) ')).toEqual({ x: -3, y: 4 });
  });

  it('reads a converted Vector2 spelling through the double branch', () => {
    // Measured on 4.6.3: the Vector2 spelling of these digits has no int32 to land on, where the
    // Vector2i spelling wraps an int64 to (-1, 64).
    expect(storedVector2i('Vector2(1920, 1080)')).toEqual({ x: 1920, y: 1080 });
    expect(storedVector2i('Vector2(4294967295, 64)')).toBe('unstorable');
    expect(storedVector2i('Vector2i(4294967295, 64)')).toEqual({ x: -1, y: 64 });
  });

  it('refuses text no Vector2i slot takes', () => {
    expect(storedVector2i('Color(1, 1, 1, 1)')).toBe('malformed');
    expect(storedVector2i('Vector2i(1)')).toBe('malformed');
    expect(storedVector2i('Vector2i(inf, 0)')).toBe('malformed');
    expect(storedVector2i('')).toBe('malformed');
  });
});

describe('readSlotTuple — the one read of a composite in a FLOAT slot', () => {
  const VECTOR2 = slotTupleRegex('Vector2', 2);

  it('reads each component of a trimmed literal', () => {
    expect(readSlotTuple(' Vector2(1.5, -2) ', 'Vector2', VECTOR2)).toEqual({
      components: [1.5, -2],
      altered: false,
    });
  });

  it('answers null for a literal the grammar refuses', () => {
    expect(readSlotTuple('Vector2(1)', 'Vector2', VECTOR2)).toBeNull();
  });

  it('narrows a Vector2i spelling to the int32 pair Godot stores', () => {
    expect(readSlotTuple('Vector2i(4294967295, 0.5)', 'Vector2', VECTOR2)).toEqual({
      components: [-1, 0],
      altered: false,
    });
  });

  it('marks Vector2i(4294967296, 5) altered and reads the pair Godot stores', () => {
    // Godot 4.6.3 stores (0, 5): `_parse_construct<int32_t>` (variant_parser.cpp:723) narrows the
    // INT token through `T(_data._int)` (variant.h:367-368). Past the round-trip band the file no
    // longer states that number (ADR-0032): the linter withholds it and the renderer draws it.
    expect(readSlotTuple('Vector2i(4294967296, 5)', 'Vector2', VECTOR2)).toEqual({
      components: [0, 5],
      altered: true,
    });
  });

  it('reads the other probe pairs Godot stores', () => {
    const components = (literal: string): number[] => readSlotTuple(literal, 'Vector2', VECTOR2)!.components;
    expect(components('Vector2i(4294967295, 2147483648)')).toEqual([-1, -2147483648]);
    expect(components('Vector2i(8589934593, -4294967297)')).toEqual([1, -1]);
  });

  it('keeps a FLOAT token outside int32 unreadable', () => {
    // `T(_data._float)` is undefined there (variant.h:369-370), so no number is named.
    expect(readSlotTuple('Vector2i(1e10, 0.5)', 'Vector2', VECTOR2)!.components[0]).toBeNaN();
  });
});

describe('readIntSlot', () => {
  it('returns both readings of one literal, and null for text outside the grammar', () => {
    expect(readIntSlot('5.5')).toEqual({ asFloat: 5.5, stored: 5 });
    expect(readIntSlot('nope')).toEqual({ asFloat: null, stored: null });
  });

  it('reads at the width the slot ceiling implies, so an unsigned ceiling is reachable', () => {
    expect(readIntSlot('4294967295.0', 4294967295).stored).toBe(4294967295);
    expect(Number.isNaN(readIntSlot('4294967295.0', 255).stored)).toBe(true);
  });
});

describe('slotWidth', () => {
  it('reads unsigned only from a ceiling no int32 can hold', () => {
    expect(slotWidth(4294967295)).toBe('uint32');
    expect(slotWidth(2147483647)).toBe('int32');
    expect(slotWidth(undefined)).toBe('int32');
    expect(slotWidth(null)).toBe('int32');
  });
});
