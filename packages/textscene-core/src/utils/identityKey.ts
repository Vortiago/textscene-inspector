import { perObject } from './perObject';

/** Written only by `identityKey`, once per new object. It never resets. */
let nextKey = 0;

/**
 * A number for each object that holds while the object lives, for a string key over objects. Two
 * objects of equal content take two keys, so a reload that parses a new object takes a new key.
 */
export const identityKey = perObject<object, number>(() => nextKey++);
