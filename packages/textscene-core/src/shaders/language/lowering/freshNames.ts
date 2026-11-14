/**
 * The names a lowering declares: none the function already uses, so a lowered variable never
 * hides one of the function's own.
 */

import type { FunctionNode } from '../shaderTree.js';
import { everyExpression, everyStatement, statementExpressions } from '../treeWalk.js';

export class FreshNames {
  private readonly taken = new Set<string>();

  constructor(definition: FunctionNode) {
    for (const argument of definition.arguments) this.taken.add(argument.name);
    for (const statement of everyStatement(definition.body)) {
      if (statement.kind === 'declaration')
        for (const declarator of statement.declarators) this.taken.add(declarator.name);
      for (const expression of statementExpressions(statement))
        for (const part of everyExpression(expression))
          if (part.kind === 'variable') this.taken.add(part.name);
    }
  }

  /** `lowered_<base>_<n>` for the first `n` no name of the function takes. */
  next(base: string): string {
    for (let index = 1; ; index++) {
      const name = `lowered_${base}_${index}`;
      if (this.taken.has(name)) continue;
      this.taken.add(name);
      return name;
    }
  }
}
