/** Written only by `makeReadOnly`, for `make_read_only` of an Array or a Dictionary. Never cleared. */
const readOnlyContainers = new WeakSet<object>();

/** `Array::make_read_only` (array.cpp:924) and `Dictionary::make_read_only`, on the container's elements. */
export const makeReadOnly = (elements: readonly unknown[]): void => void readOnlyContainers.add(elements);

export const isReadOnly = (elements: readonly unknown[]): boolean => readOnlyContainers.has(elements);
