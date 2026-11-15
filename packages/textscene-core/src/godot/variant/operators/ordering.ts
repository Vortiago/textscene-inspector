/** The comparison evaluators of variant_op.h: Less, LessEqual, Greater and GreaterEqual of each type. */

import { isStringLess } from '../../string/stringOrder.js';
import type { Variant } from '../value/variant.js';
import { COMPONENT_VECTORS, VECTOR_ORDER } from './componentVectors.js';

export type Comparison = 'OP_LESS' | 'OP_LESS_EQUAL' | 'OP_GREATER' | 'OP_GREATER_EQUAL';

/** A comparison Godot makes on memory addresses, which no port can repeat. */
export class UnportableComparison extends Error {}

type Less<T> = (a: T, b: T) => boolean;

// String and Array define <=, > and >= from < alone (ustring.cpp:389, array.cpp:181).
function fromLess<T>(comparison: Comparison, a: T, b: T, less: Less<T>): boolean {
  switch (comparison) {
    case 'OP_LESS':
      return less(a, b);
    case 'OP_LESS_EQUAL':
      return !less(b, a);
    case 'OP_GREATER':
      return less(b, a);
    case 'OP_GREATER_EQUAL':
      return !less(a, b);
  }
}

function native(comparison: Comparison, a: number | bigint, b: number | bigint): boolean {
  switch (comparison) {
    case 'OP_LESS':
      return a < b;
    case 'OP_LESS_EQUAL':
      return a <= b;
    case 'OP_GREATER':
      return a > b;
    case 'OP_GREATER_EQUAL':
      return a >= b;
  }
}

// Array::operator< (array.cpp:166) compares elements with Variant::operator<, then the lengths.
function isArrayLess(a: readonly Variant[], b: readonly Variant[], less: Less<Variant>): boolean {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (less(a[index]!, b[index]!)) return true;
    if (less(b[index]!, a[index]!)) return false;
  }
  return a.length < b.length;
}

/** `a op b` for two values of the registered pair. `variantLess` is `Variant::operator<`. */
export function compare(comparison: Comparison, a: Variant, b: Variant, variantLess: Less<Variant>): boolean {
  const vector = COMPONENT_VECTORS[a.type];
  if (vector) return VECTOR_ORDER[comparison](vector, a.value as never, b.value as never);
  switch (a.type) {
    case 'STRING':
      return fromLess(comparison, a.value, b.value as string, isStringLess);
    case 'STRING_NAME':
      throw new UnportableComparison('StringName orders by the address of its interned text');
    case 'ARRAY':
      return fromLess(comparison, a.value, b.value as readonly Variant[], (x, y) =>
        isArrayLess(x, y, variantLess)
      );
    case 'BOOL':
      return native(comparison, Number(a.value), Number(b.value));
    default: {
      const x = a.value as number | bigint;
      const y = b.value as number | bigint;
      return typeof x === typeof y ? native(comparison, x, y) : native(comparison, Number(x), Number(y));
    }
  }
}
