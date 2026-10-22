/**
 * Variant text to a stored integer, against the two `_to_int` branches of `parseGodotInt`.
 *
 * The values here are what Godot 4.6.3 stores, measured on x86_64 where the
 * conversion is defined, and derived from `variant.h:360-377` +
 * `ustring.cpp:2616-2678` where it is not. Both are cited beside the case.
 */

import { describe, expect, it } from 'vitest';
import { isAlteredInt, parseGodotInt } from './intReader.js';

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
