/** Written only by `identityKey`. A WeakMap frees the number of an object that is collected. */
const keys = new WeakMap<object, number>();
let nextKey = 0;

/**
 * A number for `object` that holds while the object lives, for a string key over objects. Two
 * objects of equal content take two keys, so a reload that parses a new object takes a new key.
 */
export function identityKey(object: object): number {
  let key = keys.get(object);
  if (key === undefined) {
    key = nextKey++;
    keys.set(object, key);
  }
  return key;
}
