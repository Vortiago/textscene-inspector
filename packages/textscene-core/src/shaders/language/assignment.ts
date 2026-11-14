/**
 * Writes in the tree: `_validate_assign` (`shader_language.cpp:5531`), whether an expression can
 * take a value and Godot's message when it cannot, and which variable each write targets.
 */

import { isAssignOperator } from './operators.js';
import type { BlockNode, Expression } from './shaderTree.js';
import { everyExpressionIn, subExpressions } from './treeWalk.js';

/** The `++` and `--` operators: whether each adds or takes one, and whether it gives the new value. */
export const STEPS: Readonly<Record<string, { readonly operator: string; readonly givesNew: boolean }>> = {
  OP_INCREMENT: { operator: 'OP_ADD', givesNew: true },
  OP_DECREMENT: { operator: 'OP_SUB', givesNew: true },
  OP_POST_INCREMENT: { operator: 'OP_ADD', givesNew: false },
  OP_POST_DECREMENT: { operator: 'OP_SUB', givesNew: false },
};

/** Whether `op` writes its first operand: an assignment, or `++` or `--` either side. */
export const isWriteOperator = (op: string): boolean => isAssignOperator(op) || op in STEPS;

/** The place `expression` itself writes, or nothing for an expression that writes no place. */
function writtenTarget(expression: Expression): Expression | undefined {
  if (expression.kind === 'whole assign') return expression.target;
  if (expression.kind === 'operator' && isWriteOperator(expression.op)) return expression.operands[0];
  return undefined;
}

// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const writing = new WeakMap<Expression, boolean>();

/** Whether `expression` writes a variable: an assignment or a step anywhere in it, found once per node. */
export function writes(expression: Expression): boolean {
  let isWriting = writing.get(expression);
  if (isWriting === undefined) {
    isWriting = writtenTarget(expression) !== undefined || subExpressions(expression).some(writes);
    writing.set(expression, isWriting);
  }
  return isWriting;
}

/** The variables a block writes: the name at the root of each target it assigns or steps. */
export function writtenNames(block: BlockNode): Set<string> {
  const names = new Set<string>();
  for (const part of everyExpressionIn(block)) {
    const target = writtenTarget(part);
    if (target) names.add(rootName(target));
  }
  return names;
}

/** The variable a place is part of: `a` of `a.x[1]`. */
function rootName(target: Expression): string {
  switch (target.kind) {
    case 'variable':
      return target.name;
    case 'member':
    case 'field':
      return rootName(target.owner);
    case 'array element':
      return rootName(target.array);
    case 'operator':
      return rootName(target.operands[target.op === 'OP_INDEX' ? 0 : 1]!);
    default:
      throw new Error(`expected a place to write, got a ${target.kind}`);
  }
}

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
      return target.isConst ? 'Constants cannot be modified.' : undefined;
    case 'array element':
      return assignmentRefusal(target.array);
    case 'field':
      return assignmentRefusal(target.owner);
    default:
      break;
  }
  return 'Assignment to constant expression.';
}
