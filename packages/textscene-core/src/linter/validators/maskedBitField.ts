/**
 * `BitField` validators. A setter that writes `x = p_flags & MASK` drops bits
 * outside the mask, the error tier, where `layerBitmask` only warns. Membership
 * is not a range: `BREAK_TRIM_MASK` is 224 (`servers/text/text_server.h:120`),
 * so `autowrap_trim_flags = 4` stores 0 though `{ max: 224 }` would pass it.
 */

import { propertyError } from './propertyError.js';
import { unrepresentableInt } from './intSlot.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import type { Severity } from '../types.js';
import { markIntSlot, readIntSlot, storedNotWritten } from './intSlot.js';
import { formatCode, valueCode } from './v/codes.js';

/**
 * Bit arithmetic that survives the slot's own width. JS `&`/`|`/`~` coerce
 * through ToInt32, and a `BitField<T>` is int64 with labels up to bit 35
 * (`RenderingServer::ArrayFormat`). BigInt is exact over the whole slot.
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
    // `readIntSlot`, not `IS_VALID_INT_RE`, the grammar of an index inside a key:
    // Godot reads any number token into an INT slot, so `justification_flags =
    // 3.0` and `= 2e1` load. `'int64'`, since `BitField<T>` is int64_t and keeps
    // 4294967295 and 2^32 + 1 intact.
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
    // A non-finite reads but does not fit, and every bit test below is false
    // for NaN.
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
    // Last, after every arm: a value that is both stored differently and
    // outside the mask has the arm's diagnostic, and that outranks this one.
    return storedNotWritten(name, key, value, line, valueCode(name), read);
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
   * Bit value to constant name, for the generated sheet's Accepts column, such
   * as `{ 32: 'BREAK_TRIM_INDENT' }`.
   */
  labels: Record<number, string>;
  /**
   * The subset the property's `PROPERTY_HINT_FLAGS` enumerates, when narrower
   * than the mask: `autowrap_trim_flags` hints 192 and keeps 224, so bit 32
   * warns as unreachable from the inspector. Cite it in the call site's comment.
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
 * A `BitField` whose setter keeps every bit, where only the inspector's flag
 * list is narrower: `maskedBitField`'s warning arm alone. The hinted set can be
 * sparse: `Label.justification_flags` offers {1, 2, 8, 32, 64, 128} (`label.cpp:1437`),
 * though 4 and 16 exist and load (`servers/text/text_server.h:78-88`).
 */
export function hintedBitField(name: string, opts: HintedBitFieldOptions): PropertyValidator {
  // OR-ed as BigInt: JS `|` coerces to int32, which turns a label at or past
  // bit 31 negative.
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
