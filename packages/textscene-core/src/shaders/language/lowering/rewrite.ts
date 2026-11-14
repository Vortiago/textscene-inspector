/**
 * A lowering's walk: every block of a function rebuilt from the inside out, each statement
 * replaced by the statements a rewrite gives for it.
 */

import type { BlockNode, FunctionNode, Statement } from '../shaderTree.js';

/** What a statement becomes, its own blocks already rewritten. */
export type StatementRewrite = (statement: Statement) => readonly Statement[];

export function rewriteFunction(definition: FunctionNode, rewrite: StatementRewrite): FunctionNode {
  return { ...definition, body: rewriteBlock(definition.body, rewrite) };
}

export function rewriteBlock(block: BlockNode, rewrite: StatementRewrite): BlockNode {
  return {
    ...block,
    statements: block.statements.flatMap((statement) => rewrite(withBlocksRewritten(statement, rewrite))),
  };
}

function withBlocksRewritten(statement: Statement, rewrite: StatementRewrite): Statement {
  if (statement.kind === 'block') return rewriteBlock(statement, rewrite);
  if (statement.kind !== 'control flow') return statement;
  return { ...statement, blocks: statement.blocks.map((block) => rewriteBlock(block, rewrite)) };
}
