/**
 * No INT-slot validator may be silent about a fractional literal. `_to_int`
 * truncates on the way into the setter (`variant.h:369-370`), so `hframes = 5.5`
 * stores 5. Each combinator applies `storedNotWritten` by hand, so this sweeps
 * every slot tagged `intSlot`, the same set `nonFiniteInts.test.ts` sweeps.
 */

import { describe, expect, it } from 'vitest';
import { probe, taggedIntSlots } from './testing/intSlotProbe.js';
import './index.js'; // side-effect: every slice registers its validators

/**
 * Integers to search for one the slot accepts, so the fractional probe differs
 * from it only in the fraction. A search, not a constant: a bit field accepts
 * only subsets of its mask, so `1.5` can draw the mask's own error instead.
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
    // The tokenizer reads `5.5` (`variant_parser.cpp:443-448` types it FLOAT),
    // so a `_FORMAT` code calls a file unparseable that the engine opens.
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
