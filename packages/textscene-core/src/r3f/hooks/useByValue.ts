/** Keeps one identity for a value that a render builds again with the same contents. */

import { useRef } from 'react';

/**
 * `value`, or the value of an earlier render while `isSame` says the two are equal, so a memo or an
 * effect keyed on the answer sees one identity. `isSame` takes every value `value` can be.
 *
 * @canonical Keep the previous value while it is equal by value
 */
export function useByValue<T>(value: T, isSame: (a: T, b: T) => boolean): T {
  const previous = useRef(value);
  if (value !== previous.current && !isSame(previous.current, value)) previous.current = value;
  return previous.current;
}
