import type { VariantTypeName } from '../value/variant.js';
import { VECTOR2I_METHODS, VECTOR3I_METHODS, VECTOR4I_METHODS } from './intVectorMethods.js';
import type { MethodPort } from './methodPort.js';
import { VECTOR2_METHODS } from './vector2Methods.js';
import { VECTOR3_METHODS } from './vector3Methods.js';
import { VECTOR4_METHODS } from './vector4Methods.js';

/** The methods of the vector types, by type. */
export const VECTOR_METHODS: Readonly<
  Partial<Record<VariantTypeName, Readonly<Record<string, MethodPort>>>>
> = {
  VECTOR2: VECTOR2_METHODS,
  VECTOR2I: VECTOR2I_METHODS,
  VECTOR3: VECTOR3_METHODS,
  VECTOR3I: VECTOR3I_METHODS,
  VECTOR4: VECTOR4_METHODS,
  VECTOR4I: VECTOR4I_METHODS,
};
