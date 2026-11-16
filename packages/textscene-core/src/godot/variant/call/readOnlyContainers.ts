import { NIL, type Variant } from '../value/variant.js';

/** Written only by `makeReadOnly`, for `make_read_only` of an Array or a Dictionary. Never cleared. */
const readOnlyContainers = new WeakSet<object>();

/** `Array::make_read_only` (array.cpp:924) and `Dictionary::make_read_only`, on the container's elements. */
export const makeReadOnly = (elements: readonly unknown[]): void => void readOnlyContainers.add(elements);

export const isReadOnly = (elements: readonly unknown[]): boolean => readOnlyContainers.has(elements);

/** A method that changes a container: `failed` on a read-only one (array.cpp:110, dictionary.cpp:246). */
export const unlessReadOnly =
  <B extends { readonly value: readonly unknown[] }, A extends unknown[]>(
    body: (base: B, ...rest: A) => Variant,
    failed: Variant = NIL
  ) =>
  (base: B, ...rest: A): Variant =>
    isReadOnly(base.value) ? failed : body(base, ...rest);
