/**
 * No int-slot validator may be silent about a literal the slot cannot hold. A float
 * slot stores `inf` (`nonFiniteScene.test.ts`), an int slot cannot. Measured on 4.6.3,
 * `cast_shadow = inf` stores 0 against a default of 1 and `max_slides = inf` trips
 * `ERR_FAIL_COND(p_max_slides < 1)` (character_body_2d.cpp:614): ADR-0032's error tier.
 */

import { describe, expect, it } from 'vitest';
import { probe, taggedIntSlots } from './testing/intSlotProbe.js';
import { everyValidatorLabel } from './registryPopulation.js';
import './index.js'; // side-effect: every slice registers its validators

/** The four spellings Godot's tokenizer resolves (`variant_parser.cpp:701-707`). */
const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'] as const;

/**
 * A literal Godot reads and no integer slot holds, at any width: `1e20` is past
 * int64 as well, and the float branch is undefined there (`variant.h:369-370`).
 */
const UNSTORABLE = ['1e20'] as const;

/** Everything an int slot must refuse, whatever its width. */
const REFUSED = [...NON_FINITE, ...UNSTORABLE];

/**
 * Past every 32-bit spelling, so refusable only by a 32-bit slot. A `BitField<T>` is
 * int64 and stores this exactly, so the population below is split on the tag's `width`.
 */
const PAST_32_BIT = '4294967296';

/**
 * Outside a byte, both ways: `_parse_byte_array` (`variant_parser.cpp:600`) reads into a
 * `Vector<uint8_t>` (`:650`) through `Variant::operator uint8_t()` (`variant.cpp:1519-1521`).
 * Measured on 4.6.3, `PackedByteArray(-1, 0)` stores `[255, 0]` and `(300.5, 0)` stores
 * `[44, 0]`. `300.5` takes the float branch (`variant.h:369-370`), undefined outside [0, 255].
 */
const PAST_BYTE = ['256', '-1', '300.5'] as const;

// The population is the `intSlot` tag, not `accepts` prose, which misses every layer
// mask (`layerBitmask` overwrites the tag) and every packed-int slot.
const intSlots = taggedIntSlots();

describe('a literal an INT slot cannot hold', () => {
  it('has int slots to ask about, so an empty registry cannot pass this', () => {
    expect(intSlots.length).toBeGreaterThan(500);
  });

  it('is declared by every validator whose own `accepts` reads as an int slot', () => {
    // A tripwire on the declaration: `markIntSlot` is applied by hand, so prose that
    // reads integer-ish without the tag fails here. Anchored: `accepts` leads with the
    // slot's own type and also names the sibling spelling Godot converts, so an
    // unanchored `Vector2i` would match every float Vector2 slot.
    const INT_PROSE = /integer|^enum |bit mask|layer mask|^Vector[234]i|^Rect2i|PackedInt32Array|int array/;
    // A wildcard dispatcher describes its family, not a slot: its leaves are
    // the int slots and carry the tag. `settings/#/*` says "bit masks" about
    // what it routes to. The filter is per-validator; the walk still descends
    // through the dispatcher to reach them.
    const untagged = everyValidatorLabel(
      (validator) =>
        validator.leaves === undefined &&
        INT_PROSE.test(validator.accepts ?? '') &&
        !validator.intSlot,
      { atLeast: 2000 }
    );
    expect(untagged).toEqual([]);
  });

  it('covers the shapes an `accepts` regex could not see', () => {
    // Three kinds a prose population misses: a layer mask (its `accepts` says
    // "32-bit layer mask", not "bit mask"), a packed-int array, and a packed
    // stream inside a Dictionary.
    const covered = new Set(intSlots.map(({ at }) => at));
    for (const slot of [
      'CanvasItem.light_mask',
      'VisualInstance3D.layers',
      'SoftBody3D.pinned_points',
      'GridMap.data',
      'Polygon2D.polygons',
      'SplitContainer.split_offsets',
      'CodeEdit.line_length_guidelines',
    ]) {
      expect(covered).toContain(slot);
    }
  });

  it('reaches every slot with a literal of the SHAPE that slot reads', () => {
    // Without this the sweep is vacuous where `probe` guesses the wrong shape: a bare
    // `inf` handed to a PackedInt32Array validator is a format error. A control may be
    // out of range (`CSGSphere3D.radial_segments` has a floor of 3), so only an
    // `_FORMAT` code counts.
    const unreadable = intSlots
      .map(({ at, key, validator }) => {
        const control = probe(validator.accepts ?? '', '1');
        return { at, probe: control, code: validator(key, control, 1)?.code ?? '' };
      })
      .filter(({ code }) => code.endsWith('_FORMAT'))
      .map(({ at, probe: text }) => `${at} cannot read ${text}`)
      .sort();
    expect(unreadable).toEqual([]);
  });

  // Every (slot, spelling) pair, judged once: the assertions below read different
  // fields of the same answer.
  const judged = intSlots.flatMap(({ at, key, validator }) =>
    REFUSED.map((spelling) => ({
      at,
      spelling,
      diagnostic: validator(key, probe(validator.accepts!, spelling), 1),
    }))
  );

  it.each(REFUSED)('is reported by every int validator (%s)', (spelling) => {
    const silent = judged
      .filter((j) => j.spelling === spelling && j.diagnostic === null)
      .map((j) => j.at)
      .sort();
    expect(silent).toEqual([]);
  });

  it('is reported by every 32-bit slot, past the widest 32-bit spelling', () => {
    const narrow = intSlots.filter(({ validator }) => validator.intSlot!.width !== 'int64');
    // Anti-vacuity: tagging every slot int64 would empty this and leave it green.
    expect(narrow.length).toBeGreaterThan(500);

    const silent = narrow
      .filter(
        ({ key, validator }) => validator(key, probe(validator.accepts!, PAST_32_BIT), 1) === null
      )
      .map(({ at }) => at)
      .sort();
    expect(silent).toEqual([]);
  });

  it.each(PAST_BYTE)('is an error from every byte slot, outside a byte (%s)', (spelling) => {
    const bytes = intSlots.filter(({ validator }) => validator.intSlot!.width === 'uint8');
    // Anti-vacuity: a byte slot left at the int32 default would empty this and
    // leave it green, which is the exact defect it exists to catch.
    expect(bytes.length).toBeGreaterThan(0);

    // Severity, not just presence: the truncation warning fires on `300.5` at a
    // width whose band admits 300, and a warning naming a stored 300 is both the
    // wrong tier and a number Godot does not hold.
    const notRefused = bytes
      .filter(
        ({ key, validator }) =>
          validator(key, probe(validator.accepts!, spelling), 1)?.severity !== 'error'
      )
      .map(({ at }) => at)
      .sort();
    expect(notRefused).toEqual([]);
  });

  it('is not called unstorable by an int64 slot, which holds it exactly', () => {
    const wide = intSlots.filter(({ validator }) => validator.intSlot!.width === 'int64');
    expect(wide.length).toBeGreaterThan(0);

    const refused = wide
      .filter(({ key, validator }) =>
        validator(key, probe(validator.accepts!, PAST_32_BIT), 1)?.message.includes(
          'cannot be stored in an integer slot'
        )
      )
      .map(({ at }) => at)
      .sort();
    expect(refused).toEqual([]);
  });

  it('reports it as an ERROR, never as a hint-tier warning', () => {
    // The setter alters or refuses the write; a hint warning would be the
    // wrong tier for a value the engine changes.
    const wrongTier = judged
      .filter((j) => j.diagnostic !== null && j.diagnostic.severity !== 'error')
      .map((j) => `${j.at} (${j.spelling}) is ${j.diagnostic!.severity}`)
      .sort();
    expect(wrongTier).toEqual([]);
  });

  it('never prints the stored number, which no two platforms agree on', () => {
    // The float branch is undefined behaviour (intSlot.ts), so the message may name
    // the literal only.
    const printsIt = judged
      .filter((j) => /-?2147483648|-?9223372036854775808|Infinity|NaN/.test(j.diagnostic?.message ?? ''))
      .map((j) => `${j.at} (${j.spelling})`)
      .sort();
    expect(printsIt).toEqual([]);
  });
});
