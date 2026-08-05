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
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

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
  const upper = name.toUpperCase();
  const describe = (bits: number): string =>
    Object.entries(opts.labels)
      .filter(([bit]) => (Number(bit) & bits) !== 0)
      .map(([bit, label]) => `${label} (${bit})`)
      .join(' | ');
  const allNames = describe(mask);

  const validator = accepts((key, value, line) => {
    if (!/^[+-]?\d+$/.test(value.trim())) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an integer, got: "${value}"`,
        `INVALID_${upper}_FORMAT`
      );
    }
    const num = Number(value);
    // `num > mask` first: a value whose bits all lie inside the mask cannot
    // exceed it, so this rejects everything too wide before `&` reaches the
    // 32-bit signed range where it would wrap and give a wrong answer. Below
    // that point `num & ~mask` is exact, and it is the check that catches the
    // in-range non-subsets a max bound would wave through.
    if (num < 0 || num > mask || (num & ~mask) !== 0) {
      // Godot's field is int64_t, so naming the stored value is only honest
      // where JS's 32-bit `&` agrees with it.
      const stored = num >= 0 && num <= 0xffffffff ? ` (Godot stores ${num & mask})` : '';
      return propertyError(
        key,
        line,
        `Property '${name}' accepts only the bits ${allNames}; ${num} sets bits outside the mask, which Godot drops on assignment${stored}`,
        `INVALID_${upper}_VALUE`
      );
    }
    if (opts.hintedBits !== undefined && (num & ~opts.hintedBits) !== 0) {
      return propertyError(
        key,
        line,
        `Property '${name}' sets ${describe(num & ~opts.hintedBits)}, which the engine keeps but the inspector's flag list does not offer (it lists only ${describe(opts.hintedBits)})`,
        `INVALID_${upper}_VALUE`,
        'warning'
      );
    }
    return null;
  }, `bit mask of ${allNames}`);

  // The error branch is the stronger claim, so it carries the tag; a narrower
  // `hintedBits` cites its ADD_PROPERTY in the comment at the call site.
  validator.grounding = { kind: 'enforced', cite: opts.enforced };
  return validator;
}
