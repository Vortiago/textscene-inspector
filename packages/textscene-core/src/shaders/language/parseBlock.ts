/**
 * Godot's `_parse_block` (`shader_language.cpp:7960`): the statements of a function body, with
 * Godot's messages and its quirks. A `case` runs up to its `break` or `return`, or to the next
 * label or the `}`: a last case without `break` takes the `}` of its `switch` as its own, and the
 * `switch` then takes the token after it.
 */

import { godotIntegerConstant } from './godotNumber.js';
import { keywordInstruction } from './instructions.js';
import type { ExpressionParser } from './parseExpression.js';
import { parseDeclaration } from './parseDeclaration.js';
import { type BlockKind, BlockScope } from './scope.js';
import type { Argument, BlockNode, ControlFlowNode, Expression, Flow, Statement } from './shaderTree.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';

/** What a block may hold: `break` and `continue` allowed or not, and one statement or many. */
interface BlockRules {
  readonly isJustOne: boolean;
  readonly canBreak: boolean;
  readonly canContinue: boolean;
}

const BODY: BlockRules = { isJustOne: false, canBreak: false, canContinue: false };
const LOOP_BODY: BlockRules = { isJustOne: true, canBreak: true, canContinue: true };
const CASE_BODY: BlockRules = { isJustOne: false, canBreak: true, canContinue: false };
const FOR_PART: BlockRules = { isJustOne: true, canBreak: false, canContinue: false };

/** The scope a statement is read in: the innermost block. Written only by `StatementParser`. */
export interface ScopeHolder {
  current: BlockScope;
}

export class StatementParser {
  constructor(
    private readonly tokens: TokenCursor,
    private readonly expressions: ExpressionParser,
    private readonly holder: ScopeHolder,
    private readonly isStruct: (name: string) => boolean,
    private readonly returnType: () => string
  ) {}

  /** A function's body after its `{`, in a scope that sees its arguments. */
  body(args: readonly Argument[], position: SourcePosition): BlockNode {
    return this.block(new BlockScope(undefined, 'plain', args), position, BODY);
  }

  /** The statements of a new block of `kind` inside the current one. */
  private nested(kind: BlockKind, position: SourcePosition, rules: BlockRules): BlockNode {
    return this.block(new BlockScope(this.holder.current, kind), position, rules);
  }

  private block(scope: BlockScope, position: SourcePosition, rules: BlockRules): BlockNode {
    const outer = this.holder.current;
    this.holder.current = scope;
    try {
      const statements: Statement[] = [];
      this.statementsInto(statements, rules);
      return { kind: 'block', statements, position };
    } finally {
      this.holder.current = outer;
    }
  }

  /** Statements into `statements` until the block ends, one when `isJustOne`. */
  private statementsInto(statements: Statement[], rules: BlockRules): void {
    for (;;) {
      const mark = this.tokens.mark();
      const token = this.tokens.next();
      const scope = this.holder.current;
      if (scope.kind === 'switch' && !/^TK_(CF_CASE|CF_DEFAULT|CURLY_BRACKET_CLOSE)$/.test(token.type)) {
        this.tokens.fail("A switch may only contain 'case' and 'default' blocks.");
      }
      if (token.type === 'TK_CURLY_BRACKET_CLOSE') {
        if (rules.isJustOne) this.tokens.fail("Expected a '}'.");
        return;
      }
      const outcome = this.statement(token, mark, rules, statements);
      if (outcome === 'block ends') return;
      if (rules.isJustOne) return;
    }
  }

  /** One statement into `statements`, and whether it ends the block it stands in. */
  private statement(token: Token, mark: number, rules: BlockRules, statements: Statement[]): Outcome {
    if (this.startsDeclaration(token)) {
      statements.push(
        parseDeclaration(token, this.tokens, this.expressions, this.holder.current, this.isStruct)
      );
      return this.checkForInit(true);
    }
    switch (token.type) {
      case 'TK_CURLY_BRACKET_OPEN':
        statements.push(this.nested('plain', token.position, { ...rules, isJustOne: false }));
        return this.checkForInit(false);
      case 'TK_CF_IF':
        statements.push(this.ifStatement(token, rules));
        return this.checkForInit(false);
      case 'TK_CF_SWITCH':
        statements.push(this.switchStatement(token));
        return this.checkForInit(false);
      case 'TK_CF_CASE':
      case 'TK_CF_DEFAULT':
        return this.label(token, mark, statements);
      case 'TK_CF_DO':
      case 'TK_CF_WHILE':
        statements.push(this.whileStatement(token));
        return this.checkForInit(false);
      case 'TK_CF_FOR':
        statements.push(this.forStatement(token));
        return this.checkForInit(false);
      case 'TK_CF_RETURN':
        statements.push(this.returnStatement(token));
        return this.endsCase();
      case 'TK_CF_DISCARD':
        statements.push(this.simpleFlow(token, 'FLOW_OP_DISCARD', 'discard'));
        return this.checkForInit(false);
      case 'TK_CF_BREAK':
        if (!rules.canBreak)
          this.tokens.fail("'break' is not allowed outside of a loop or 'switch' statement.");
        statements.push(this.simpleFlow(token, 'FLOW_OP_BREAK', 'break'));
        return this.endsCase();
      case 'TK_CF_CONTINUE':
        if (!rules.canContinue) this.tokens.fail("'continue' is not allowed outside of a loop.");
        statements.push(this.simpleFlow(token, 'FLOW_OP_CONTINUE', 'continue'));
        return this.checkForInit(false);
    }
    this.tokens.reset(mark);
    return this.expressionStatement(statements);
  }

  /** `const`, a precision, a value type or a struct's name starts a declaration. */
  private startsDeclaration(token: Token): boolean {
    if (token.type === 'TK_CONST' || token.type.startsWith('TK_PRECISION_')) return true;
    if (token.type === 'TK_IDENTIFIER') return this.isStruct(token.text!);
    return keywordInstruction(token.type)?.family === 'data type' && token.type !== 'TK_TYPE_VOID';
  }

  /** A `for` initialiser must declare a variable (`shader_language.cpp:9073`). */
  private checkForInit(isDeclaration: boolean): Outcome {
    if (this.holder.current.kind === 'for init' && !isDeclaration)
      this.tokens.fail('The left expression is expected to be a variable declaration.');
    return 'goes on';
  }

  /** A `break` or `return` inside a `case` or `default` ends that label's block. */
  private endsCase(): Outcome {
    const scope = this.holder.current;
    return scope.isInside('case') || scope.isInside('default') ? 'block ends' : this.checkForInit(false);
  }

  /** `if (c) s` with an optional `else s` (`shader_language.cpp:8433`). */
  private ifStatement(token: Token, rules: BlockRules): ControlFlowNode {
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected a '(' after 'if'.");
    const condition = this.expressions.expression();
    if (condition.type !== 'bool') this.tokens.fail('Expected a boolean expression.');
    if (this.tokens.next().type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
    const branchRules = { ...rules, isJustOne: true };
    const blocks = [this.nested('plain', this.tokens.lastPosition(), branchRules)];
    const mark = this.tokens.mark();
    if (this.tokens.next().type === 'TK_CF_ELSE')
      blocks.push(this.nested('plain', this.tokens.lastPosition(), branchRules));
    else this.tokens.reset(mark);
    return flowNode('FLOW_OP_IF', [condition], blocks, token.position);
  }

  /** `switch (a) { ... }`: a block of labels only (`shader_language.cpp:8489`). */
  private switchStatement(token: Token): ControlFlowNode {
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected a '(' after 'switch'.");
    const value = this.expressions.expression();
    if (value.type !== 'int' && value.type !== 'uint')
      this.tokens.fail('Expected an integer or unsigned integer expression.');
    if (this.tokens.next().type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
    if (this.tokens.next().type !== 'TK_CURLY_BRACKET_OPEN')
      this.tokens.fail("Expected a '{' after 'switch'.");
    const scope = new SwitchScope(this.holder.current, value.type);
    const labels: Statement[] = [];
    const outer = this.holder.current;
    this.holder.current = scope;
    try {
      const first = this.tokens.peek().type;
      if (first !== 'TK_CF_CASE' && first !== 'TK_CF_DEFAULT') {
        this.tokens.next();
        this.tokens.fail("Expected a 'case' or 'default'.");
      }
      let hasDefault = first === 'TK_CF_DEFAULT';
      for (;;) {
        this.statementsInto(labels, { isJustOne: true, canBreak: true, canContinue: false });
        const mark = this.tokens.mark();
        const next = this.tokens.next().type;
        if (next === 'TK_CF_DEFAULT') {
          if (hasDefault) this.tokens.fail('Default case must be defined only once.');
          hasDefault = true;
        }
        if (next !== 'TK_CF_CASE' && next !== 'TK_CF_DEFAULT') break;
        this.tokens.reset(mark);
      }
    } finally {
      this.holder.current = outer;
    }
    const block: BlockNode = { kind: 'block', statements: labels, position: token.position };
    return flowNode('FLOW_OP_SWITCH', [value], [block], token.position);
  }

  /**
   * `case n:` or `default:` in a `switch` block, which ends that block's one statement. Met
   * inside a label's block, it ends that block and is read again by the `switch`.
   */
  private label(token: Token, mark: number, statements: Statement[]): Outcome {
    const scope = this.holder.current;
    const word = token.type === 'TK_CF_CASE' ? 'case' : 'default';
    // Only a `case` block gives the label back: in a `default` block a label is refused.
    if (scope.kind === 'case') {
      this.tokens.reset(mark);
      return 'block ends';
    }
    if (!(scope instanceof SwitchScope))
      this.tokens.fail(`'${word}' must be placed within a 'switch' block.`);
    const expressions = word === 'case' ? [this.caseLabel(scope)] : [];
    if (this.tokens.next().type !== 'TK_COLON') this.tokens.fail("Expected a ':'.");
    const body = this.nested(word, token.position, CASE_BODY);
    statements.push(
      flowNode(word === 'case' ? 'FLOW_OP_CASE' : 'FLOW_OP_DEFAULT', expressions, [body], token.position)
    );
    return 'block ends';
  }

  /** A case label: an integer constant of the switch's type, once each (`shader_language.cpp:8574`). */
  private caseLabel(scope: SwitchScope): Expression {
    let token = this.tokens.next();
    const sign = token.type === 'TK_OP_SUB' ? -1 : 1;
    if (sign === -1) token = this.tokens.next();
    const expected = scope.valueType === 'uint' ? 'TK_UINT_CONSTANT' : 'TK_INT_CONSTANT';
    const message =
      scope.valueType === 'uint' ? 'Expected an unsigned integer constant.' : 'Expected an integer constant.';
    if (token.type === 'TK_IDENTIFIER') return this.constantLabel(scope, token, message);
    if (token.type !== 'TK_INT_CONSTANT' && token.type !== 'TK_UINT_CONSTANT') this.tokens.fail(message);
    if (token.type !== expected) this.tokens.fail(message);
    const literal = godotIntegerConstant(token.text!);
    const value = scope.valueType === 'uint' ? literal >>> 0 : (literal * sign) | 0;
    scope.addLabel(value, this.tokens);
    return { kind: 'constant', type: scope.valueType, values: [value], position: token.position };
  }

  /** A `const` local of the switch's type as a label. */
  private constantLabel(scope: SwitchScope, token: Token, message: string): Expression {
    const found = this.holder.current.find(token.text!, false);
    if (!found) this.tokens.fail(`Undefined identifier '${token.text}' in a case label.`);
    if (found.kind !== 'local' || !found.isConst || found.type !== scope.valueType || !found.values)
      this.tokens.fail(message);
    const value = found.values[0] as number;
    scope.addLabel(value, this.tokens);
    return { kind: 'constant', type: scope.valueType, values: [value], position: token.position };
  }

  /** `while (c) s` and `do s while (c);` (`shader_language.cpp:8723`). Godot leaves `c` untyped. */
  private whileStatement(token: Token): ControlFlowNode {
    const isDo = token.type === 'TK_CF_DO';
    const body = isDo ? this.nested('plain', token.position, LOOP_BODY) : undefined;
    if (isDo && this.tokens.next().type !== 'TK_CF_WHILE') this.tokens.fail("Expected a 'while' after 'do'.");
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected a '(' after 'while'.");
    const condition = this.expressions.expression();
    if (this.tokens.next().type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
    if (isDo) {
      if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
      return flowNode('FLOW_OP_DO', [condition], [body!], token.position);
    }
    const loopBody = this.nested('plain', this.tokens.lastPosition(), LOOP_BODY);
    return flowNode('FLOW_OP_WHILE', [condition], [loopBody], token.position);
  }

  /**
   * `for (init; conditions; steps) s` (`shader_language.cpp:8789`): the conditions and steps
   * stand in the initialiser's scope, and so does the body.
   */
  private forStatement(token: Token): ControlFlowNode {
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected a '(' after 'for'.");
    const outer = this.holder.current;
    const initScope = new BlockScope(outer, 'for init');
    const init = this.block(initScope, this.tokens.lastPosition(), FOR_PART);
    this.holder.current = initScope;
    try {
      const conditions = this.forPart('for condition');
      const steps = this.forPart('for step');
      const body = this.nested('plain', this.tokens.lastPosition(), LOOP_BODY);
      return flowNode('FLOW_OP_FOR', [], [init, conditions, steps, body], token.position);
    } finally {
      this.holder.current = outer;
    }
  }

  /** The conditions or the steps of a `for`, separated by `,`. */
  private forPart(kind: 'for condition' | 'for step'): BlockNode {
    const scope = new BlockScope(this.holder.current, kind);
    const position = this.tokens.lastPosition();
    const outer = this.holder.current;
    this.holder.current = scope;
    try {
      const statements: Expression[] = [];
      for (;;) {
        const expression =
          kind === 'for step' ? this.expressions.forStepExpression() : this.expressions.expression();
        statements.push(expression);
        const isCondition = expression.type === 'bool' || isEmpty(expression);
        const token = this.tokens.next();
        if (kind === 'for condition') {
          if (!isCondition)
            this.tokens.fail('The middle expression is expected to have a boolean data type.');
          if (token.type === 'TK_COMMA') {
            this.requireNextExpression('TK_SEMICOLON');
            continue;
          }
          if (token.type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ',' or ';'.");
        } else {
          if (token.type === 'TK_COMMA') {
            this.requireNextExpression('TK_PARENTHESIS_CLOSE');
            continue;
          }
          if (token.type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ',' or ')'.");
        }
        return { kind: 'block', statements, position };
      }
    } finally {
      this.holder.current = outer;
    }
  }

  /** After a `,` in a `for`, an expression must follow, not the end of the part. */
  private requireNextExpression(end: string): void {
    const token = this.tokens.peek();
    if (token.type === end) this.tokens.fail(`Expected expression, found: '${end.replace(/^TK_/, '')}'.`);
  }

  /** `return`, with an expression of the function's type (`shader_language.cpp:8852`). */
  private returnStatement(token: Token): ControlFlowNode {
    const returnType = this.returnType();
    const mark = this.tokens.mark();
    if (this.tokens.next().type === 'TK_SEMICOLON') {
      if (returnType !== 'void')
        this.tokens.fail(`Expected 'return' with an expression of type '${returnType}'.`);
      return flowNode('FLOW_OP_RETURN', [], [], token.position);
    }
    if (returnType === 'void') this.tokens.fail("'void' function cannot return a value.");
    this.tokens.reset(mark);
    const expression = this.expressions.expression();
    if (expression.type !== returnType || isArray(expression))
      this.tokens.fail(`Expected return with an expression of type '${returnType}'.`);
    if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';' after 'return'.");
    return flowNode('FLOW_OP_RETURN', [expression], [], token.position);
  }

  /** `break;`, `continue;` or `discard;`. */
  private simpleFlow(token: Token, flow: Flow, word: string): ControlFlowNode {
    if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail(`Expected a ';' after '${word}'.`);
    return flowNode(flow, [], [], token.position);
  }

  /** An expression and its `;` (`shader_language.cpp:9016`). */
  private expressionStatement(statements: Statement[]): Outcome {
    const expression = this.expressions.expression();
    statements.push(expression);
    if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
    if (this.holder.current.kind === 'for init' && !isEmpty(expression))
      this.tokens.fail('The left expression is expected to be a variable declaration.');
    return 'goes on';
  }
}

type Outcome = 'goes on' | 'block ends';

/** A `switch` block: the type of its value and the labels read so far. */
class SwitchScope extends BlockScope {
  constructor(
    parent: BlockScope,
    readonly valueType: string
  ) {
    super(parent, 'switch');
  }

  addLabel(value: number, tokens: TokenCursor): void {
    if (this.labels.has(value)) tokens.fail(`Duplicated case label: ${value}.`);
    this.labels.add(value);
  }
}

const flowNode = (
  flow: Flow,
  expressions: readonly Expression[],
  blocks: readonly BlockNode[],
  position: SourcePosition
): ControlFlowNode => ({ kind: 'control flow', flow, expressions, blocks, position });

const isEmpty = (expression: Expression) => expression.kind === 'operator' && expression.op === 'OP_EMPTY';

/** Whether a returned value is an array, which a function of a value type cannot return. */
const isArray = (expression: Expression) =>
  (expression.kind === 'variable' || expression.kind === 'field') && (expression.arraySize ?? 0) > 0;
