import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';

/** The number a FLOAT, an INT or a BOOL value holds. */
export const numberOf = (value: VariantValue): number => Number((value as { value: unknown }).value);

export const isTrue = (value: VariantValue): boolean => (value as { value: unknown }).value === true;

/** The two components of a vector value. */
export function pairOf(value: VariantValue): { x: number; y: number } {
  const [x, y] = (value as { value: readonly number[] }).value;
  return { x: x!, y: y! };
}

/** A `real_t` value, as a `float` field holds it. */
export const realValue = (value: number): VariantValue => ({ type: T.FLOAT, value: f(value) });

export const intValue = (value: number): VariantValue => ({ type: T.INT, value: Math.trunc(value) });

export const boolValue = (value: boolean): VariantValue => ({ type: T.BOOL, value });
