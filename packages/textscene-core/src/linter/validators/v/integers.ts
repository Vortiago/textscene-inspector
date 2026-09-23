/**
 * Integer combinators, including the enum ones. Every int slot reports
 * `_to_int`'s truncation of a fractional literal and its BOOL-to-1/0 mapping
 * with the same `storedNotWritten` warning, after its own bounds.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import {
  markIntSlot,
  slotWidth,
} from '../intSlot.js';
import {
  createEnumValidator,
  createNumericRangeValidator,
} from '../commonValidators.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import {
  accepts,
  endSeverity,
  ground,
  type EndedGrounding,
  type Grounding,
} from './grounding.js';
import type { IntOpts } from './options.js';


export const integerCombinators = {
  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    // One width for the read and the tag, or they disagree on every slot whose
    // ceiling exceeds INT32_MAX.
    const width = opts.width ?? slotWidth(opts.max);
    return markIntSlot(ground(
      accepts(
        createNumericRangeValidator({
          propertyName: name,
          min: opts.min ?? null,
          max: opts.max ?? null,
          width,
          enforcedMin: opts.enforcedMin,
          enforcedMax: opts.enforcedMax,
          parseAsInt: true,
          message: opts.message,
          errorCodeFormat: formatCode(name),
          errorCodeValue: valueCode(name),
          minSeverity: endSeverity(opts, 'min'),
          maxSeverity: endSeverity(opts, 'max'),
        }),
        numericRange('integer', opts.min, opts.max, opts)
      ),
      opts,
      { min: opts.min, max: opts.max, enforcedMin: opts.enforcedMin, enforcedMax: opts.enforcedMax }
    ), width);
  },

  /** Positive integer (`>= 1`); `message` replaces the range wording. */
  positiveInt(name: string, message?: string, opts: Grounding = {}): PropertyValidator {
    return integerCombinators.int(name, { ...opts, min: 1, ...(message ? { message } : {}) });
  },

  /** Integer enum, such as `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>,
    opts: EndedGrounding = {}
  ): PropertyValidator {
    // Only the labels inside the window, or the message names a constant the
    // bound rejects: `labels` is the engine's whole enum, and min/max the window
    // one class's hint opens onto it. Integer-like keys iterate ascending.
    const names = Object.entries(labels)
      .filter(([value]) => Number(value) >= min && Number(value) <= max)
      .map(([, label]) => label)
      .join('/');
    // The ends travel positionally here, and `endSeverity` compares the tiers by
    // value, so they are folded back in or a reachable warning band errors.
    const ended = { ...opts, min, max };
    return markIntSlot(ground(
      accepts(
        createEnumValidator(
          name,
          min,
          max,
          labels,
          formatCode(name),
          valueCode(name),
          endSeverity(ended, 'min'),
          endSeverity(ended, 'max'),
          undefined,
          opts.enforcedMin,
          opts.enforcedMax
        ),
        `enum ${min}-${max} (${names})`
      ),
      opts,
      { min, max, enforcedMin: opts.enforcedMin, enforcedMax: opts.enforcedMax }
    ));
  },

  /**
   * Integer enum whose hint leaves a gap, since a `PROPERTY_HINT_ENUM` label can
   * carry its own `:value`: `v.enumSet('system_menu_id', {0: 'NONE',
   * 2: 'APPLICATION_MENU_ID', …})`. The labels are the bound, with no separate
   * min/max as {@link enumInt} has.
   */
  enumSet(name: string, labels: Record<number, string>, opts: Grounding = {}): PropertyValidator {
    const values = Object.keys(labels)
      .map(Number)
      .sort((a, b) => a - b);
    const min = values[0]!;
    const max = values[values.length - 1]!;
    const names = Object.values(labels).join('/');
    return markIntSlot(ground(
      accepts(
        createEnumValidator(
          name,
          min,
          max,
          labels,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min'),
          endSeverity(opts, 'max'),
          new Set(values)
        ),
        `enum ${values.join('/')} (${names})`
      ),
      opts,
      { min, max, values }
    ));
  },

  /** A bound-free integer slot: `int` with no range. */
  lenientInt(name: string): PropertyValidator {
    return integerCombinators.int(name);
  },

  /**
   * `int` under the name its call sites use: it narrows through `readIntSlot`
   * before the bound check, so `frame = 4294967295` is judged as the -1 the
   * setter's guard receives.
   */
  strictInt(name: string, opts: IntOpts = {}): PropertyValidator {
    return integerCombinators.int(name, opts);
  },

  /** `int` with a floor of 0, for frame indices and similar counts. */
  strictNonNegativeInt(name: string, opts: Grounding = {}): PropertyValidator {
    return integerCombinators.int(name, { ...opts, min: 0 });
  },
};
