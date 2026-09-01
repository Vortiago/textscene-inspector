/**
 * No INT-slot validator may be silent about a literal the slot cannot hold.
 *
 * The opposite of `nonFiniteScene.test.ts`: a FLOAT slot stores `inf` verbatim,
 * an INT slot cannot hold it. Measured on 4.6.3, `cast_shadow = inf` stores 0
 * against a default of 1 and `max_slides = inf` trips
 * `ERR_FAIL_COND(p_max_slides < 1)` (character_body_2d.cpp:614) — altered or
 * refused, which is ADR-0032's error tier.
 *
 * Population comes from the `intSlot` TAG, not from `accepts` prose. The
 * earlier `accepts` regex selected 492 of 542 slots, silently excluding every
 * layer mask (`layerBitmask` overwrites the tag) and every packed-int slot.
 */

import { describe, expect, it } from 'vitest';
import { probe, taggedIntSlots } from './testing/intSlotProbe.js';
import { collectValidators } from './testing/validatorClassification.js';
import './index.js'; // side-effect: every slice registers its validators

/** The four spellings Godot's tokenizer resolves (`variant_parser.cpp:701-707`). */
const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'] as const;

/**
 * A literal Godot reads and NO integer slot holds, at any width: `1e20` is past
 * int64 as well, and the FLOAT branch is undefined there (`variant.h:369-370`).
 */
const UNSTORABLE = ['1e20'] as const;

/** Everything an int slot must refuse, whatever its width. */
const REFUSED = [...NON_FINITE, ...UNSTORABLE];

/**
 * Past every 32-bit spelling, and therefore refusable only by a 32-bit slot.
 *
 * A `BitField<T>` is int64 and stores this exactly, so demanding a refusal of
 * every slot would force the bit fields to report on a value the engine keeps —
 * which is why the population below is split on the tag's `width` rather than
 * asserted uniformly.
 */
const PAST_32_BIT = '4294967296';

/**
 * Outside a BYTE, in both directions, and refusable only by a byte slot.
 *
 * A `PackedByteArray` element is read by `_parse_byte_array`
 * (`variant_parser.cpp:600`) into a `Vector<uint8_t>` (`:650`), so it converts
 * through `Variant::operator uint8_t()` (`variant.cpp:1519-1521`) rather than
 * through int32. Measured on 4.6.3, `PackedByteArray(-1, 0)` stores `[255, 0]`
 * and `PackedByteArray(300.5, 0)` stores `[44, 0]` — altered in both cases,
 * which is ADR-0032's error tier. `300.5` is the FLOAT branch
 * (`variant.h:369-370`), undefined outside [0, 255], and is here because a
 * width that only bounds INT literals reports it as a truncation instead.
 */
const PAST_BYTE = ['256', '-1', '300.5'] as const;

const intSlots = taggedIntSlots();

describe('a literal an INT slot cannot hold', () => {
  it('has int slots to ask about, so an empty registry cannot pass this', () => {
    expect(intSlots.length).toBeGreaterThan(500);
  });

  it('is declared by every validator whose own `accepts` reads as an int slot', () => {
    // The inverse of the old population, kept as a TRIPWIRE. `markIntSlot` is
    // applied by hand at seven slice sites, and a forgotten one drops out of
    // the sweep above in silence — the same failure the `accepts` regex had,
    // renamed. As a cross-check on the DECLARATION its misses are loud instead:
    // prose that reads integer-ish while the tag is absent fails here.
    // Anchored on the composite names: `accepts` LEADS with the slot's own
    // declared type, and now also names the sibling spelling Godot converts
    // into it — so an unanchored `Vector2i` matched every FLOAT Vector2 slot
    // and reported 111 of them as untagged int slots.
    const INT_PROSE = /integer|^enum |bit mask|layer mask|^Vector[234]i|^Rect2i|PackedInt32Array|int array/;
    // `collectValidators`, not `getRegisteredNodeTypes() x getOwnKeys()`: that
    // walk reaches ROOTS only, so ~400 leaf validators behind wildcard
    // dispatchers sat outside the tripwire — and a leaf is exactly where a
    // hand-applied `markIntSlot` goes missing. Being the walk the probe sweep
    // does NOT share is this check's whole job; it was sharing a different
    // blind spot instead.
    const untagged = collectValidators(
      // A wildcard DISPATCHER describes its family, not a slot — its leaves are
      // the int slots and carry the tag. `settings/#/*` says "bit masks" about
      // what it routes to. The filter is per-validator; the walk still descends
      // through the dispatcher to reach them.
      (validator) =>
        validator.leaves === undefined &&
        INT_PROSE.test(validator.accepts ?? '') &&
        !validator.intSlot
    )
      .map(({ label }) => label)
      .sort();
    expect(untagged).toEqual([]);
  });

  it('covers the shapes an `accepts` regex could not see', () => {
    // The three kinds the previous population missed, each named by the review
    // that found it: a layer mask (its `accepts` says "32-bit layer mask", not
    // "bit mask"), a packed-int array, and a packed stream inside a Dictionary.
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
    // Without this the sweep below is vacuous wherever `probe` guesses the
    // wrong shape: a bare `inf` handed to a PackedInt32Array validator is a
    // FORMAT error, which counts as "not silent" while testing nothing.
    //
    // A control value may still be out of RANGE — `CSGSphere3D.radial_segments`
    // has a floor of 3 — so the question is only whether the format branch
    // fired, which is what an `_FORMAT` code says.
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

  // Every (slot, spelling) pair, judged ONCE. The three assertions below read
  // different fields of the same answer; running the sweep per assertion meant
  // ~3x 540 x 6 validator calls for one question asked three ways.
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

    // Severity, not just presence: the truncation WARNING fires on `300.5` at a
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
    // The FLOAT branch is UB; see intSlot.ts. The message may name the literal only.
    const printsIt = judged
      .filter((j) => /-?2147483648|-?9223372036854775808|Infinity|NaN/.test(j.diagnostic?.message ?? ''))
      .map((j) => `${j.at} (${j.spelling})`)
      .sort();
    expect(printsIt).toEqual([]);
  });
});
