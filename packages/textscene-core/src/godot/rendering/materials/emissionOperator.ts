/** How a BaseMaterial3D combines its emission colour and texture. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::EmissionOperator` (`scene/resources/material.h:317-320`), as the integers a
 * `.tscn` stores for `emission_operator`.
 */
export const EmissionOperator = {
  ADD: 0,
  MULTIPLY: 1,
} as const;

/** Each operator's name by the integer a `.tscn` stores, as a validator names it. */
export const EMISSION_OPERATOR_NAMES = enumNamesByValue(EmissionOperator);
