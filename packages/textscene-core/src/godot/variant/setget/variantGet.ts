import { builtinMethodHash } from '../call/builtinMethod.js';
import { doubleToInt64 } from '../cInteger.js';
import { findEntry } from '../compare.js';
import { NIL, variant, type Variant } from '../value/variant.js';
import { indexedElement } from './indexedElements.js';
import { memberOf } from './namedMembers.js';

/** What a get leaves: its value, and whether Godot calls it valid. A failed get still leaves a value. */
export interface GetResult {
  readonly value: Variant;
  readonly isValid: boolean;
}

const valid = (value: Variant): GetResult => ({ value, isValid: true });
const INVALID: GetResult = { value: NIL, isValid: false };

/**
 * `Variant::get_named` (variant_setget.cpp:266): a member, a Dictionary entry, or a bound builtin method.
 *
 * @canonical The member a Variant reads by name
 */
export function getNamed(base: Variant, name: string): GetResult {
  const member = memberOf(base, name);
  if (member) return valid(member);
  switch (base.type) {
    case 'OBJECT':
      return { value: variant('STRING', 'Instance base is null.'), isValid: false };
    case 'DICTIONARY': {
      const entry = findEntry(base.value, variant('STRING_NAME', name));
      return entry ? valid(entry.value) : INVALID;
    }
    default:
      return builtinMethodHash(base.type, name) === undefined
        ? INVALID
        : valid(variant('CALLABLE', { method: name, base }));
  }
}

/**
 * `Variant::get` (variant_setget.cpp:1234): a Dictionary by key, any other type by a name or an int.
 *
 * @canonical The element a Variant reads at an index
 */
export function variantGet(base: Variant, index: Variant): GetResult {
  if (base.type === 'DICTIONARY') {
    const entry = findEntry(base.value, index);
    return entry ? valid(entry.value) : INVALID;
  }
  if (base.type === 'OBJECT') return INVALID;
  switch (index.type) {
    case 'STRING':
    case 'STRING_NAME':
      return getNamed(base, index.value);
    case 'INT':
    case 'FLOAT': {
      const element = indexedElement(base, index.type === 'INT' ? index.value : doubleToInt64(index.value));
      return element ? valid(element) : INVALID;
    }
    default:
      return INVALID;
  }
}
