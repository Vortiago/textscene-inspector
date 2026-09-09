/**
 * Integer combinators, including the enum one.
 *
 * They no longer differ on how strict the PARSE is. One engine behaviour gets
 * one verdict: `_to_int` truncates a fractional literal and maps a BOOL to 1/0,
 * and every int slot says so with the same `storedNotWritten` warning, after its
 * own bounds. `strictInt` earns its name on a different axis — it judges the NARROWED int, which is what a
 * setter's `ERR_FAIL_INDEX` receives — and `lenientInt` is just a bound-free
 * `int`.
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
    // ONE declaration for the read and the tag. Deriving them separately —
    // `slotWidth(max)` for the read, a defaulted `'int32'` for the tag —
    // disagrees on every slot whose ceiling exceeds INT32_MAX.
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

  /** Integer enum, e.g. `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>,
    opts: EndedGrounding = {}
  ): PropertyValidator {
    // The labels are the point: `enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)`
    // tells a reader what each number means without opening Godot's docs.
    // Integer-like keys already iterate ascending, so no sort is needed.
    //
    // Only the ones INSIDE the window: `labels` is the engine's whole enum,
    // while min/max is the window one class's hint opens onto it, and a message
    // that names a constant the bound rejects reads as a contradiction. Passing
    // a trimmed copy per class would be a second table to keep in step instead.
    const names = Object.entries(labels)
      .filter(([value]) => Number(value) >= min && Number(value) <= max)
      .map(([, label]) => label)
      .join('/');
    // The ends travel POSITIONALLY here while every other combinator takes them
    // in `opts`, and `endSeverity` compares the two tiers by value — so without
    // them folded back in it sees no hint end at all and calls a reachable
    // warning band an error.
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
   * Integer enum whose hint leaves a GAP: `v.enumSet('system_menu_id', {0: 'NONE',
   * 2: 'APPLICATION_MENU_ID', …})`.
   *
   * `PROPERTY_HINT_ENUM` lets a label carry its own `:value`, and a class that
   * uses them can offer a subset of a contiguous engine enum. The labels ARE the
   * bound here — every key is offered and nothing between them is — so unlike
   * {@link enumInt} there is no min/max to state separately.
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
   * An integer judged as the stored int32, which is what `int` does: it narrows
   * through `readIntSlot` before the bound check, so `frame = 4294967295` is
   * judged as the -1 the setter's guard receives. The name survives for its call
   * sites; the read is `int`'s.
   */
  strictInt(name: string, opts: IntOpts = {}): PropertyValidator {
    return integerCombinators.int(name, opts);
  },

  /** `int` with a floor of 0, for frame indices and similar counts. */
  strictNonNegativeInt(name: string, opts: Grounding = {}): PropertyValidator {
    return integerCombinators.int(name, { ...opts, min: 0 });
  },
};
