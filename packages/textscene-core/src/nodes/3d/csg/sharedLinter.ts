/**
 * The `CSGShape3D` validators every CSG type inherits — the linter counterpart of
 * `sharedParser.ts`'s `finishCsgShapeParse`, so the properties that helper reads for
 * all seven types are format-checked for all seven rather than for whichever one
 * last needed them.
 *
 * `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), so the
 * GeometryInstance3D half comes from `../shared/geometryInstance3dLinter.ts`
 * rather than being transcribed again here.
 */

import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { geometryInstance3dValidators } from '../shared/geometryInstance3dLinter.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

export const csgShapeValidators: Record<string, PropertyValidator> = {
  operation: v.enumInt('operation', 0, 2, OPERATION),
  ...geometryInstance3dValidators,
};
