/**
 * Variant to fixed-width integer, against the two `_to_int` branches.
 *
 * The values here are what Godot 4.6.3 stores, measured on x86_64 where the
 * conversion is defined, and derived from `variant.h:360-377` +
 * `ustring.cpp:2616-2678` where it is not. Both are cited beside the case.
 */

import { describe, expect, it } from 'vitest';
import {
  parseGodotInt,
  readSlotTuple,
  ruleCount,
  ruleInt,
  slotCount,
  slotInt,
  slotComponents,
  slotComponentsAltered,
  storedInt,
  storedVector2i,
} from './int.js';
import { isAlteredInt } from './intReader.js';
import { slotTupleRegex } from './number.js';

describe('an INT-typed literal', () => {
  // `token_text.as_int()` (variant_parser.cpp:489) yields an int64, and
  // `T(_data._int)` (variant.h:367-368) is an integral conversion: it wraps,
  // in both directions, on every platform Godot ships.
  it('reads the opposite spelling of a pattern the slot holds', () => {
    // The band is every 32-bit pattern spelled both ways, because Godot's
    // getters write either signedness for the same bits.
    expect(parseGodotInt('3000000000')).toBe(-1294967296);
    expect(parseGodotInt('-1', 'uint32')).toBe(4294967295);
  });

  it('wraps a value outside that band to the number Godot stores', () => {
    // Measured on 4.6.3 (`Node2D.position` after load): `Vector2i(4294967296, 5)` is (0, 5).
    expect(parseGodotInt('4294967296')).toBe(0);
    expect(parseGodotInt('-3000000000')).toBe(1294967296);
    expect(parseGodotInt('8589934593')).toBe(1);
    expect(parseGodotInt('-4294967297')).toBe(-1);
  });

  it('names the stored number of each probe component', () => {
    expect(storedInt('4294967295')).toBe(-1);
    expect(storedInt('2147483648')).toBe(-2147483648);
  });

  it('is an alteration outside the band the slot round-trips, and not inside it', () => {
    // The linter asks whether the file states the stored number (ADR-0032), apart from what is stored.
    expect(isAlteredInt(4294967296, '4294967296', 'int32')).toBe(true);
    expect(isAlteredInt(-3000000000, '-3000000000', 'int32')).toBe(true);
    expect(isAlteredInt(4294967295, '4294967295', 'int32')).toBe(false);
    expect(isAlteredInt(-1, '-1', 'uint32')).toBe(false);
    expect(isAlteredInt(4294967297, '4294967297', 'int64')).toBe(false);
  });

  it('is an alteration for a FLOAT outside the range, which stays unreadable', () => {
    expect(isAlteredInt(3e9, '3e9', 'int32')).toBe(true);
    expect(isAlteredInt(5.5, '5.5', 'int32')).toBe(false);
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
  // value is outside T's range, so the storable band is the slot's, not int32's.
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

describe('a byte slot', () => {
  /*
   * `_parse_byte_array` (variant_parser.cpp:600) pushes each element into a `Vector<uint8_t>` (:650),
   * through `Variant::operator uint8_t()` (variant.cpp:1519-1521). Measured on 4.6.3, element to
   * byte: 300 → 44, -1 → 255, 300.5 → 44, 1000000000 → 0, 1.5 → 1, -0.5 → 0, -1.5 → 255, 2e3 → 208.
   */
  it('holds the byte range and truncates a fraction inside it', () => {
    expect(parseGodotInt('0', 'uint8')).toBe(0);
    expect(parseGodotInt('255', 'uint8')).toBe(255);
    expect(parseGodotInt('1.5', 'uint8')).toBe(1); // uint8_t(1.5) is defined
    // The band applies to the truncated value: measured, -0.5 stores 0 while
    // -1.5 stores 255, so the first is defined and the second is not.
    expect(parseGodotInt('-0.5', 'uint8')).toBe(0);
  });

  it('wraps an INT literal outside a byte, in either direction', () => {
    expect(parseGodotInt('256', 'uint8')).toBe(0);
    expect(parseGodotInt('300', 'uint8')).toBe(44);
    expect(parseGodotInt('1000000000', 'uint8')).toBe(0);
    expect(parseGodotInt('-1', 'uint8')).toBe(255);
  });

  it('calls every INT literal outside a byte an alteration', () => {
    // No opposite-spelling band here: the writer emits `itos` off a
    // `const uint8_t *` (variant_parser.cpp:2408), so no Godot-written file
    // holds a negative byte and 255 is an alteration of -1, not its spelling.
    for (const spelling of ['256', '300', '1000000000', '-1']) {
      expect(isAlteredInt(Number(spelling), spelling, 'uint8')).toBe(true);
    }
    expect(isAlteredInt(255, '255', 'uint8')).toBe(false);
  });

  it('refuses a FLOAT literal outside a byte, where the conversion is undefined', () => {
    expect(parseGodotInt('300.5', 'uint8')).toBeNaN();
    expect(parseGodotInt('-1.5', 'uint8')).toBeNaN();
    expect(parseGodotInt('2e3', 'uint8')).toBeNaN();
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
