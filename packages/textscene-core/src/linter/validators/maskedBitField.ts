/**
 * A `BitField` property whose setter keeps only the bits in a mask.
 *
 * `layerBitmask` is the sibling case and the contrast worth holding: there the
 * setter assigns straight through and only the inspector widget is 32 wide, so
 * an out-of-range mask WARNS. Here the setter writes `x = p_flags & MASK`, so
 * bits outside the mask are dropped on the way in and the stored value is not
 * the written one. `Grounding.enforced` names exactly that case ("a silently
 * dropped write"), which makes those bits the error tier.
 *
 * The distinction is not academic. `BREAK_TRIM_MASK` is
 * `BREAK_TRIM_INDENT | BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES`
 * (`servers/text/text_server.h:120`) = 224, so `autowrap_trim_flags = 4` — a
 * plausible confusion with the neighbouring `autowrap_mode` enum — stores 0 and
 * nothing anywhere reports it.
 *
 * Membership is not a range, which is why this cannot be a `v.int` with a max:
 * the legal set is the subsets of the mask, and 1 is as illegal as 4096 while
 * 224 is fine. A bound like `{ min: 0, max: 224 }` would accept every one of
 * the in-range non-subsets.
 *
 * `hinted` carries the second tier. A `PROPERTY_HINT_FLAGS` string enumerates
 * the bits the inspector offers, which is often NARROWER than the mask the
 * setter keeps: all three `autowrap_trim_flags` properties hint only
 * `BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES` (192) while
 * accepting 224. Bit 32 is therefore kept unaltered but unreachable from the
 * inspector, which is the warning tier by the same reading of a UI-control hint
 * that `layerBitmask` already applies to `PROPERTY_HINT_LAYERS_*`.
 */

import { propertyError } from './propertyError.js';
import { unrepresentableInt } from './intSlot.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import type { Severity } from '../types.js';
import { markIntSlot, readIntSlot, truncatedInt } from './intSlot.js';
import { formatCode, valueCode } from './v/codes.js';

/**
 * Bit arithmetic that survives the slot's own width.
 *
 * JS `&`/`|`/`~` coerce through ToInt32, and a `BitField<T>` is int64: a label
 * at bit 35 (`RenderingServer::ArrayFormat` has them) reduces to 0 under `|`,
 * and `num & mask` names a stored value the engine never holds once either
 * side passes 2^31. BigInt is exact over the whole slot.
 */
const outsideMask = (num: number, bits: number): boolean =>
  (BigInt(num) & ~BigInt(bits)) !== 0n;
const insideMask = (num: number, bits: number): number =>
  Number(BigInt(num) & BigInt(bits));
const bitIsSet = (bit: number, bits: number): boolean =>
  (BigInt(bit) & BigInt(bits)) !== 0n;

/** `LABEL (bit) | LABEL (bit)` for whichever of `labels` appear in `bits`. */
function describeBits(labels: Record<number, string>, bits: number): string {
  return Object.entries(labels)
    .filter(([bit]) => bitIsSet(Number(bit), bits))
    .map(([bit, label]) => `${label} (${bit})`)
    .join(' | ');
}

/** One bit set a value has to lie inside, and what it means when it does not. */
interface BitFieldArm {
  /** The OR of every bit this arm permits. */
  bits: number;
  severity: Severity;
  /** The diagnostic, given the value Godot reads from the literal. */
  message: (num: number) => string;
}

/**
 * The body both combinators below share: read the INT, refuse what the slot
 * cannot hold, then test each arm in turn.
 *
 * @param arms - tested in order, so the setter's own tier reports before the
 *   narrower one the inspector's flag list states. The widest set comes first
 *   and is the one `accepts` names, since it is every bit the slot carries.
 */
function bitField(
  name: string,
  opts: {
    labels: Record<number, string>;
    arms: readonly [BitFieldArm, ...BitFieldArm[]];
    grounding: { kind: 'enforced' | 'hinted'; cite: string };
  }
): PropertyValidator {
  const validator = accepts((key, value, line) => {
    // `readIntSlot`, not `IS_VALID_INT_RE`: that regex describes
    // `String::is_valid_int()`, which is the grammar of an index inside a
    // property KEY, not of a Variant literal. A bit-field slot is an INT, so
    // Godot reads any number token and converts — `justification_flags = 3.0`
    // and `= 2e1` are files it loads, and a format error on either reported on
    // a scene the engine opens. The `${num}` an arm interpolates is the STORED
    // int, which is what every message here should have said. It also hands
    // back the double the int came from, which the truncation tier needs.
    // `'int64'`: the slot is `BitField<T>`, which is int64_t. Read as int32 it
    // reported 4294967295 as -1 and refused 2^32 + 1 outright, so a value the
    // engine keeps intact drew an error saying the engine does not hold it.
    const read = readIntSlot(value, undefined, 'int64');
    const num = read.stored;
    if (num === null) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an integer, got: "${value}"`,
        formatCode(name)
      );
    }
    // A non-finite READS but does not FIT, and every bit test below is false
    // for NaN, so without this the slot said nothing at all.
    const refused = unrepresentableInt(name, key, value, line, valueCode(name), num, 'int64');
    if (refused) return refused;
    for (const arm of opts.arms) {
      // `num > arm.bits` first only as a cheap reject: a value whose bits all
      // lie inside the set cannot exceed it. `outsideMask` is what catches the
      // in-range non-subsets a max bound would wave through, and it is exact at
      // every width the slot holds.
      if (num < 0 || num > arm.bits || outsideMask(num, arm.bits)) {
        return propertyError(key, line, arm.message(num), valueCode(name), arm.severity);
      }
    }
    // Last, after every arm: a value that is both fractional and outside the
    // mask has the arm's diagnostic to report, and that outranks this one.
    return truncatedInt(name, key, value, line, valueCode(name), read);
  }, `bit mask of ${describeBits(opts.labels, opts.arms[0].bits)}`);

  validator.grounding = opts.grounding;
  // An INT slot: a bit field refuses a literal the tokenizer reads.
  return markIntSlot(validator, 'int64');
}

export interface MaskedBitFieldOptions {
  /**
   * `file:line` of the setter that applies the mask. Pass a literal, not a
   * variable, so `rangeAdvisoryGrounding`'s scrape can see it.
   */
  enforced: string;
  /**
   * Bit value to constant name, for the generated sheet's Accepts column, e.g.
   * `{ 32: 'BREAK_TRIM_INDENT' }`. Naming the constants is what tells a reader
   * which numbers are legal without opening Godot's headers.
   */
  labels: Record<number, string>;
  /**
   * The subset the property's `PROPERTY_HINT_FLAGS` actually enumerates, when
   * it is narrower than the mask. Omit where the hint lists every kept bit.
   * The citation belongs at the call site's comment, matching how every other
   * two-tier validator here records its warning arm.
   */
  hintedBits?: number;
}

/**
 * @param mask - the OR of every bit the setter keeps. Written as a literal sum
 *   of the engine's constants at the call site, never as a magic number.
 */
export function maskedBitField(
  name: string,
  mask: number,
  opts: MaskedBitFieldOptions
): PropertyValidator {
  const describe = (bits: number): string => describeBits(opts.labels, bits);
  const allNames = describe(mask);
  const { hintedBits } = opts;

  const maskArm: BitFieldArm = {
    bits: mask,
    severity: 'error',
    // The stored value for a negative spelling and a wide one alike.
    // `parseGodotInt` has already refused anything past 2^53, where the double
    // stops being the integer the file spells.
    message: (num) =>
      `Property '${name}' accepts only the bits ${allNames}; ${num} sets bits outside the mask, which Godot drops on assignment (Godot stores ${insideMask(num, mask)})`,
  };
  const arms: [BitFieldArm, ...BitFieldArm[]] = [maskArm];
  if (hintedBits !== undefined) {
    arms.push({
      bits: hintedBits,
      severity: 'warning',
      message: (num) =>
        `Property '${name}' sets ${describe(Number(BigInt(num) & ~BigInt(hintedBits)))}, which the engine keeps but the inspector's flag list does not offer (it lists only ${describe(hintedBits)})`,
    });
  }

  return bitField(name, {
    labels: opts.labels,
    arms,
    // The error branch is the stronger claim, so it carries the tag; a narrower
    // `hintedBits` cites its ADD_PROPERTY in the comment at the call site.
    grounding: { kind: 'enforced', cite: opts.enforced },
  });
}

export interface HintedBitFieldOptions {
  /** `file:line` of the `ADD_PROPERTY` whose PROPERTY_HINT_FLAGS lists the bits. */
  hinted: string;
  /** Bit value to constant name, for the message and the sheet's Accepts column. */
  labels: Record<number, string>;
}

/**
 * A `BitField` whose setter keeps EVERY bit, where only the inspector's flag
 * list is narrower.
 *
 * This is `maskedBitField`'s warning arm standing alone, and the two differ in
 * exactly the way ADR-0032 separates the tiers: there the setter writes
 * `p_flags & MASK`, so a bit outside the mask is DROPPED and the stored value is
 * not the written one (error). Here the setter bare-assigns, so an unlisted bit
 * is kept unaltered and is merely unreachable from the inspector (warning).
 *
 * A min/max bound cannot substitute, and not only for elegance: the hinted set
 * is often SPARSE. `Label.justification_flags` offers {1, 2, 8, 32, 64, 128}
 * (`label.cpp:1437`) while `JUSTIFICATION_TRIM_EDGE_SPACES = 4` and
 * `JUSTIFICATION_CONSTRAIN_ELLIPSIS = 16` exist and load fine
 * (`servers/text/text_server.h:78-88`), so `{ min: 0, max: 255 }` would wave
 * through the two values a reader most needs told about.
 */
export function hintedBitField(name: string, opts: HintedBitFieldOptions): PropertyValidator {
  // OR-ed as BigInt: JS `|` coerces to int32, and this file's slot is int64, so
  // a label at or past bit 31 turned the whole set negative and every legal
  // value then failed the subset test.
  const hintedBits = Number(
    Object.keys(opts.labels).reduce((acc, bit) => acc | BigInt(bit), 0n)
  );
  const allNames = describeBits(opts.labels, hintedBits);

  return bitField(name, {
    labels: opts.labels,
    arms: [
      {
        bits: hintedBits,
        severity: 'warning',
        message: () =>
          `Property '${name}' sets a bit the inspector's flag list does not offer; it lists only ${allNames}. Godot keeps the value, so this loads and runs, but the value is unreachable from the editor`,
      },
    ],
    grounding: { kind: 'hinted', cite: opts.hinted },
  });
}
