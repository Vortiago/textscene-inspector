/**
 * Shared property-order check for the `Range` family (`HSlider`/`VSlider` in
 * this codebase — mirrors `shared/range.ts`'s split: the Range math lives
 * once here, each concrete slice's own `linter.ts` wraps it into its own
 * registered `LintRule`, the `shared/slider.ts`/per-slice `parser.ts` pattern
 * for lint code).
 *
 * `Range::set_min`/`set_max`/`set_page` (`scene/gui/range.cpp:211-226`,
 * `:228-241`, `:254-266`) each end by calling `set_value(shared->val)`,
 * re-clamping the CURRENT `value` against whatever `min`/`max`/`page` are at
 * that moment (`_calc_value`, `:182-200`). `min_value`, `max_value`, `page`
 * and `value` are all independently `.tscn`-serializable
 * (`range.cpp:405,406,408,409`), so a `value` line authored before any of
 * them risks being clamped against the struct defaults (`min=0.0`,
 * `max=100.0`, `page=0.0` — `range.h:39-43`) rather than the scene's own
 * bounds, and a LATER `min_value`/`max_value`/`page` line cannot recover the
 * original intent — it only re-clamps whatever already survived the first
 * clamp. See `hslider/linter.test.ts` for the traced-by-hand numeric example
 * and ADR-0035.
 */

import { targetsBeforeLatestTrigger } from '../../../../linter/propertyOrder.js';

/** The three setters that each re-clamp `value` as a side effect. */
const RANGE_VALUE_TRIGGERS = ['min_value', 'max_value', 'page'] as const;

/**
 * Data-only: which trigger keys are positioned AFTER `value` (the ones that
 * re-clamp it against bounds `value`'s own setter may have missed), or `null`
 * when there is no hazard.
 *
 * Deliberately returns data, not a `Diagnostic` — the `ruleCoverage` meta-guard
 * (`linter/ruleCoverage.test.ts`) scrapes each `severity`/`ruleName` literal
 * pair directly out of its owning `nodes/**\/linter.ts` FILE, so the
 * `Diagnostic` object literal must live in the concrete slice's own
 * `linter.ts` (`hslider/linter.ts`, `vslider/linter.ts`) — only the reusable
 * ORDER ARITHMETIC lives here, mirroring `shared/range.ts`'s split between
 * shared math and each slice's own parser/component wiring.
 */
export function rangeOrderHazard(properties: Record<string, string>): readonly string[] | null {
  if (!('value' in properties)) return null;

  const wiped = targetsBeforeLatestTrigger(properties, ['value'], RANGE_VALUE_TRIGGERS);
  if (wiped.length === 0) return null;

  const keys = Object.keys(properties);
  const valueIndex = keys.indexOf('value');
  // Name only the triggers that actually run AFTER `value` — the ones that
  // re-clamp it — not every present trigger (one authored before `value` too
  // already ran harmlessly against the not-yet-corrupted value).
  return RANGE_VALUE_TRIGGERS.filter((trigger) => {
    const index = keys.indexOf(trigger);
    return index !== -1 && index > valueIndex;
  });
}
