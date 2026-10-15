/** How a BaseMaterial3D combines its emission colour and texture. */

/**
 * `BaseMaterial3D::EmissionOperator` (`scene/resources/material.h:317-320`), as the integers a
 * `.tscn` stores for `emission_operator`.
 */
export const EmissionOperator = {
  ADD: 0,
  MULTIPLY: 1,
} as const;

/** The operator a material stores no `emission_operator` for (`material.h:610`). */
export const EMISSION_OPERATOR_DEFAULT = EmissionOperator.ADD;
