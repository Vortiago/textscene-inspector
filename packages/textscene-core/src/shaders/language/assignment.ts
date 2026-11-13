/**
 * `_validate_assign` (`shader_language.cpp:5531`): whether an expression can take a value, and
 * Godot's message when it cannot.
 */

import { isAssignOperator } from './operators.js';
import type { Expression } from './shaderTree.js';

/** Godot's message for an expression that cannot be assigned to, or nothing when it can. */
export function assignmentRefusal(target: Expression): string | undefined {
  switch (target.kind) {
    case 'operator':
      if (target.op === 'OP_INDEX') return assignmentRefusal(target.operands[0]!);
      // A chained assignment assigns to its right side.
      if (isAssignOperator(target.op)) return assignmentRefusal(target.operands[1]!);
      if (target.op === 'OP_CALL') return 'Assignment to function.';
      break;
    case 'member':
      if (target.hasDuplicates) return 'Swizzling assignment contains duplicates.';
      return assignmentRefusal(target.owner);
    case 'variable':
      return undefined;
    case 'constant':
      break;
  }
  return 'Assignment to constant expression.';
}
