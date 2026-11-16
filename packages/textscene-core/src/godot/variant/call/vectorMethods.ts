import type { VariantTypeName } from '../value/variant.js';
import type { MethodPort } from './methodPort.js';
import { VECTOR2_METHODS } from './vector2Methods.js';

/** The methods of the vector types, by type. */
export const VECTOR_METHODS: Readonly<
  Partial<Record<VariantTypeName, Readonly<Record<string, MethodPort>>>>
> = {
  VECTOR2: VECTOR2_METHODS,
};
