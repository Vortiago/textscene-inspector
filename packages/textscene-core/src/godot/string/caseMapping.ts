import { LOWER_CASE_RUNS, UPPER_CASE_RUNS, type CaseRun } from './caseTables.generated';

/** The mapped code of `code` in a table of runs, or `code` itself where no run holds it. */
function mapped(runs: readonly CaseRun[], code: number): number {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [first, count, step, delta] = runs[middle]!;
    if (code < first) high = middle - 1;
    else if (code > first + (count - 1) * step) low = middle + 1;
    else return (code - first) % step === 0 ? code + delta : code;
  }
  return code;
}

/**
 * `_find_upper` (ucaps.h:2981): the simple upper case of a code point.
 *
 * @canonical The upper case of a code point as Godot maps it
 */
export const findUpper = (code: number): number => mapped(UPPER_CASE_RUNS, code);

/**
 * `_find_lower` (ucaps.h:3001): the simple lower case of a code point.
 *
 * @canonical The lower case of a code point as Godot maps it
 */
export const findLower = (code: number): number => mapped(LOWER_CASE_RUNS, code);
