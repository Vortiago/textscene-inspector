/**
 * Shared property-order check for the `Range` family, which each slice's `linter.ts` wraps in a
 * `LintRule`. `Range::set_min`/`set_max`/`set_page` (`scene/gui/range.cpp:211-226`, `:228-241`,
 * `:254-266`) each end with `set_value(shared->val)`, re-clamping the current `value` (`_calc_value`,
 * `:182-200`). ADR-0035 and `hslider/linter.test.ts` trace an example by hand.
 */

import { targetsBeforeLatestTrigger } from '../../../../linter/propertyOrder.js';

/**
 * The setters that re-clamp `value`. All four keys serialise (`range.cpp:405,406,408,409`), so a
 * `value` clamped against the struct defaults (`min=0.0`, `max=100.0`, `page=0.0`, `range.h:39-43`)
 * stays lost: a later bound only re-clamps what survived.
 */
const RANGE_VALUE_TRIGGERS = ['min_value', 'max_value', 'page'] as const;

/**
 * The trigger keys after `value`, which re-clamp it, or `null` without a hazard. It returns data,
 * not a `Diagnostic`: `ruleCoverage` (`linter/ruleCoverage.test.ts`) scrapes each `severity`/`ruleName`
 * pair from its slice's `nodes/**\/linter.ts` file, so the literal lives in `hslider/linter.ts`
 * and `vslider/linter.ts`.
 */
export function rangeOrderHazard(properties: Record<string, string>): readonly string[] | null {
  if (!('value' in properties)) return null;

  const wiped = targetsBeforeLatestTrigger(properties, ['value'], RANGE_VALUE_TRIGGERS);
  if (wiped.length === 0) return null;

  const keys = Object.keys(properties);
  const valueIndex = keys.indexOf('value');
  // Name only the triggers after `value`: one authored before it ran against the value
  // harmlessly.
  return RANGE_VALUE_TRIGGERS.filter((trigger) => {
    const index = keys.indexOf(trigger);
    return index !== -1 && index > valueIndex;
  });
}
