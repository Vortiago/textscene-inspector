import type { BlockNode, FunctionNode, Statement } from '../shaderTree.js';

/** What a statement becomes, its own blocks already rewritten: one statement, or several in order. */
export type StatementRewrite = (statement: Statement) => Statement | readonly Statement[];

export function rewriteFunction(definition: FunctionNode, rewrite: StatementRewrite): FunctionNode {
  return { ...definition, body: rewriteBlock(definition.body, rewrite) };
}

function rewriteBlock(block: BlockNode, rewrite: StatementRewrite): BlockNode {
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
