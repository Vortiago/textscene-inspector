/**
 * No INT-slot validator may be silent about a fractional literal.
 *
 * `_to_int` truncates on the way INTO the setter (`variant.h:369-370`), so
 * `hframes = 5.5` stores 5 and the value the engine holds is not the value the
 * file states. ADR-0032 gives that its own tier, and `storedNotWritten` is the one
 * implementation of it — but it is applied by each combinator by hand, so a
 * hand-rolled int slot drops out of the tier in silence. Both bit-field
 * combinators and `GridMap.cell_octant_size` did.
 *
 * Population comes from the `intSlot` TAG, the same set `nonFiniteInts.test.ts`
 * sweeps.
 */

import { describe, expect, it } from 'vitest';
import { probe, taggedIntSlots } from './testing/intSlotProbe.js';
import './index.js'; // side-effect: every slice registers its validators

/**
 * Integers to look for one the slot ACCEPTS, so the fractional probe below
 * differs from it in nothing but the fraction.
 *
 * A bit field is why this is a search rather than a constant: its legal set is
 * the subsets of a mask, so `1` is illegal where `192` is fine, and a probe of
 * `1.5` draws the mask's own error and hides the silence being tested for.
 */
const BASES = [1, 0, 2, 3, 4, 8, 16, 32, 64, 96, 128, 192, 224, 255, 100, 1000, 2048];

/** The slots a base can be found for, paired with it. */
const probed = taggedIntSlots().flatMap(({ at, key, validator }) => {
  const accepts = validator.accepts ?? '';
  const base = BASES.find((n) => validator(key, probe(accepts, String(n)), 1) === null);
  return base === undefined ? [] : [{ at, key, validator, accepts, base }];
});

describe('a fractional literal in an INT slot', () => {
  it('has slots to ask about, so an empty registry cannot pass this', () => {
    expect(probed.length).toBeGreaterThan(500);
  });

  it('is reported by every int slot, as a warning naming the stored int', () => {
    const silent = probed
      .filter(({ key, validator, accepts, base }) =>
        validator(key, probe(accepts, `${base}.5`), 1) === null
      )
      .map(({ at, base }) => `${at} (accepts ${base}, silent on ${base}.5)`)
      .sort();
    expect(silent).toEqual([]);
  });

  it('warns rather than errors, and never as a format failure', () => {
    // The tokenizer reads `5.5` perfectly well (`variant_parser.cpp:443-448`
    // types it FLOAT), so a `_FORMAT` code here tells a reader the file is
    // unparseable when the engine opens it without complaint.
    const wrong = probed
      .flatMap(({ at, key, validator, accepts, base }) => {
        const d = validator(key, probe(accepts, `${base}.5`), 1);
        if (!d) return [];
        return d.severity === 'warning' && !d.code?.endsWith('_FORMAT')
          ? []
          : [`${at} -> ${d.severity} ${d.code}`];
      })
      .sort();
    expect(wrong).toEqual([]);
  });
});
