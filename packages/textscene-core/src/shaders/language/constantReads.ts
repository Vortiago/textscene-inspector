/**
 * The reads of `const` locals, which glslang folds to the value of the declaration: Godot writes
 * a `const` local as a GLSL `const`, so `v[k]` with `const int k = 5;` is an index glslang checks.
 */

import type { GlslangFolding } from './glslangFolding.js';
import type { BlockNode, Expression, Statement } from './shaderTree.js';
import { everyExpression, statementBlocks, statementExpressions } from './treeWalk.js';

/** The lanes of each `const` local a block holds so far, by name, or nothing for another local. */
type ConstantScope = Map<string, readonly (number | boolean)[] | undefined>;

/** Binds in `folding` each read of a `const` local of a value type in `body` to its folded value. */
export function bindConstantReads(body: BlockNode, folding: GlslangFolding): void {
  bindBlock(body, new Map(), folding);
}

function bindBlock(block: BlockNode, outer: ConstantScope, folding: GlslangFolding): void {
  const scope: ConstantScope = new Map(outer);
  for (const statement of block.statements) bindStatement(statement, scope, folding);
}

function bindStatement(statement: Statement, scope: ConstantScope, folding: GlslangFolding): void {
  if (statement.kind === 'declaration') {
    for (const declarator of statement.declarators) {
      if (declarator.value) bindReads(declarator.value, scope, folding);
      const isFolded = statement.isConst && declarator.arraySize === undefined && declarator.value;
      scope.set(declarator.name, isFolded ? folding.lanesOf(declarator.value!) : undefined);
    }
    return;
  }
  for (const expression of statementExpressions(statement)) bindReads(expression, scope, folding);
  // A `for` keeps its initialiser's names for its conditions, steps and body.
  if (statement.kind === 'control flow' && statement.flow === 'FLOW_OP_FOR') {
    const inner: ConstantScope = new Map(scope);
    for (const part of statement.blocks)
      for (const each of part.statements) bindStatement(each, inner, folding);
    return;
  }
  for (const inner of statementBlocks(statement)) bindBlock(inner, scope, folding);
}

function bindReads(expression: Expression, scope: ConstantScope, folding: GlslangFolding): void {
  for (const part of everyExpression(expression)) {
    if (part.kind !== 'variable') continue;
    const lanes = scope.get(part.name);
    if (lanes) folding.bindConstant(part, lanes);
  }
}
