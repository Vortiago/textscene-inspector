/** Keeps one identity for a value that a render builds again with the same contents. */

import { useRef } from 'react';

/**
 * `value`, or the value of an earlier render while `isSame` says the two are equal, so a memo or an
 * effect keyed on the answer sees one identity. `isSame` takes every value `value` can be.
 *
 * @canonical Keep the previous value while it is equal by value
 */
export function useByValue<T>(value: T, isSame: (a: T, b: T) => boolean): T {
  const kept = useRef({ input: value, output: value });
  // An input seen last render is not compared again, so a costly `isSame` runs once for each new value.
  if (value !== kept.current.input) {
    const output = isSame(kept.current.output, value) ? kept.current.output : value;
    kept.current = { input: value, output };
  }
  return kept.current.output;
}
