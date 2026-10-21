/**
 * Finds the `Array[T]` or `Dictionary[K, V]` prefix Godot's text writer puts on a resource
 * property's value, through the class's base chain, from the generated typed collection table.
 */

import { findInClassChain } from './classBaseTypes.js';
import { TYPED_COLLECTION_PROPERTIES } from './typedCollectionProperties.generated.js';

/** The prefix for `className`'s `property`, or undefined for an untyped one. */
export function typedCollectionPrefix(className: string, property: string): string | undefined {
  return findInClassChain(className, (type) => {
    if (!Object.hasOwn(TYPED_COLLECTION_PROPERTIES, type)) return undefined;
    const slots = TYPED_COLLECTION_PROPERTIES[type]!;
    return Object.hasOwn(slots, property) ? slots[property] : undefined;
  });
}
