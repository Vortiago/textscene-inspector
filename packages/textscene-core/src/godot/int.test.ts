/**
 * Variant to fixed-width integer, against the two `_to_int` branches.
 *
 * The values here are what Godot 4.6.3 stores, measured on x86_64 where the
 * conversion is defined, and derived from `variant.h:360-377` +
 * `ustring.cpp:2616-2678` where it is not. Both are cited beside the case.
 */

import { describe, expect, it } from 'vitest';
import { parseGodotInt, ruleInt, storedInt } from './int.js';

describe('an INT-typed literal', () => {
  // `token_text.as_int()` (variant_parser.cpp:489) yields an int64, and
  // `T(_data._int)` (variant.h:367-368) is an integral conversion: it wraps,
  // in both directions, on every platform Godot ships.
  it('reads the opposite spelling of a pattern the slot holds', () => {
    // The band is every 32-bit pattern spelled BOTH ways, because Godot's
    // getters write either signedness for the same bits.
    expect(parseGodotInt('3000000000')).toBe(-1294967296);
    expect(parseGodotInt('-1', 'uint32')).toBe(4294967295);
  });

  it('refuses a value outside that band, in either direction', () => {
    // Nothing serialises these, and the engine wraps them to a number the file
    // does not state — the alteration ADR-0032 calls an error.
    expect(parseGodotInt('4294967296')).toBeNaN();
    expect(parseGodotInt('-3000000000')).toBeNaN();
  });

  it('wraps the unsigned spelling Godot writes for a negative', () => {
    // Measured: `Node2D.visibility_layer = -1` is written back as 4294967295.
    expect(parseGodotInt('4294967295')).toBe(-1);
    expect(parseGodotInt('4294967295', 'uint32')).toBe(4294967295);
  });

  it('is stored as-is by an int64 slot', () => {
    // `BitField<T>` is int64, so a bit field narrowed to int32 reported a
    // different number from the one the engine holds.
    expect(parseGodotInt('4294967297', 'int64')).toBe(4294967297);
    expect(parseGodotInt('-1', 'int64')).toBe(-1);
  });

  it('is unnameable past the safe-integer range', () => {
    // A reader limit, not an engine fact: `String::to_int` saturates at
    // INT64_MAX (ustring.cpp:2650-2658) and the conversion still wraps, but a
    // JS double past 2^53 is not the int64 the file states, so its low bits
    // are not ours to name.
    expect(parseGodotInt('99999999999999999999')).toBeNaN();
  });
});

describe('a FLOAT-typed literal', () => {
  // `T(_data._float)` (variant.h:369-370) is undefined when the truncated
  // value is outside T's range, so the storable band is the SLOT's, not int32's.
  it('truncates toward zero inside the slot', () => {
    expect(parseGodotInt('5.9')).toBe(5);
    expect(parseGodotInt('-5.9')).toBe(-5);
    expect(parseGodotInt('2e1')).toBe(20);
  });

  it('reaches the ceiling a uint32 slot declares', () => {
    // `PROPERTY_HINT_RANGE("0,4294967295,1")` on the particle `seed` names this
    // as the ceiling, and `uint32_t(4294967295.0)` converts it without UB.
    // Read at int32 it was refused at its own declared maximum.
    expect(parseGodotInt('4294967295.0', 'uint32')).toBe(4294967295);
    expect(parseGodotInt('4e9', 'uint32')).toBe(4000000000);
  });

  it('is refused outside the slot, in either direction', () => {
    expect(parseGodotInt('3e9')).toBeNaN(); // past int32
    expect(parseGodotInt('-1.0', 'uint32')).toBeNaN(); // uint32_t(-1.0) is the UB one
    expect(parseGodotInt('1e20')).toBeNaN();
  });

  it('is never representable when non-finite', () => {
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(parseGodotInt(spelling)).toBeNaN();
      expect(parseGodotInt(spelling, 'uint32')).toBeNaN();
    }
  });
});

describe('text outside the grammar', () => {
  it('reads as null, distinct from an unstorable value', () => {
    expect(parseGodotInt('8abc')).toBeNull();
    expect(parseGodotInt('0x10')).toBeNull();
    expect(parseGodotInt('')).toBeNull();
  });
});

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
