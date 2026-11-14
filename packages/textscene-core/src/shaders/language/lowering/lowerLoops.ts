/**
 * Each loop as `while (true)`, which TSL's `Loop` writes, with its condition as an
 * `if (!c) break;`. A `for` and a `do` keep a flag, so `continue` still runs the steps and tests
 * the condition as GLSL runs them.
 */

import { ShadingLanguageError } from '../shadingLanguageError.js';
import type { BlockNode, ControlFlowNode, Expression, FunctionNode, Statement } from '../shaderTree.js';
import type { FreshNames } from './freshNames.js';
import {
  assign,
  block,
  boolean,
  breakUnless,
  declaration,
  ifStatement,
  loop,
  not,
  variable,
} from './nodes.js';
import { rewriteFunction } from './rewrite.js';

export function lowerLoops(definition: FunctionNode, names: FreshNames): FunctionNode {
  return rewriteFunction(definition, (statement) => {
    if (statement.kind !== 'control flow') return [statement];
    if (statement.flow === 'FLOW_OP_WHILE') return [whileLoop(statement)];
    if (statement.flow === 'FLOW_OP_DO') return [doLoop(statement, names)];
    if (statement.flow === 'FLOW_OP_FOR') return [forLoop(statement, names)];
    return [statement];
  });
}

/** `while (c) s` as `while (true) { if (!c) break; s }`. */
function whileLoop(statement: ControlFlowNode): Statement {
  const [condition] = statement.expressions;
  return loop([breakUnless(boolCondition(condition!)), ...statement.blocks], statement.position);
}

/** `do s while (c);` as `{ bool first = true; while (true) { if (!first) { if (!c) break; } first = false; s } }`. */
function doLoop(statement: ControlFlowNode, names: FreshNames): Statement {
  const [condition] = statement.expressions;
  const first = firstFlag(names, statement);
  const body = [
    first.unlessFirst([breakUnless(boolCondition(condition!))]),
    first.clear,
    ...statement.blocks,
  ];
  return block([first.declaration, loop(body, statement.position)], statement.position);
}

/**
 * `for (init; c; steps) s` as `{ init; while (true) { if (!c) break; s } }`, with a flag that
 * runs the steps on each pass after the first. Every condition runs, and the last one decides.
 */
function forLoop(statement: ControlFlowNode, names: FreshNames): Statement {
  const [init, conditions, steps, body] = statement.blocks as [BlockNode, BlockNode, BlockNode, BlockNode];
  const position = statement.position;
  const tests = conditions.statements.filter((condition) => !isEmpty(condition)) as Expression[];
  const last = tests.at(-1);
  const test = [...tests.slice(0, -1), ...(last ? [breakUnless(last)] : [])];
  const stepStatements = steps.statements.filter((step) => !isEmpty(step));
  const initStatements = init.statements.filter((part) => !isEmpty(part));
  if (stepStatements.length === 0)
    return block([...initStatements, loop([...test, body], position)], position);
  const first = firstFlag(names, statement);
  const pass = [first.unlessFirst(stepStatements), first.clear, ...test, body];
  return block([...initStatements, first.declaration, loop(pass, position)], position);
}

/** The flag that holds on a loop's first pass: its declaration, its clearing and the guard it keeps. */
function firstFlag(names: FreshNames, statement: ControlFlowNode) {
  const position = statement.position;
  const name = names.next('first');
  const read = variable(name, 'bool', position);
  return {
    declaration: declaration(name, 'bool', boolean(true, position), position),
    clear: assign(read, boolean(false, position)),
    unlessFirst: (statements: readonly Statement[]) => ifStatement(not(read), statements, position),
  };
}

/** A `while` or `do` condition, which Godot leaves untyped and GLSL takes only as a `bool`. */
function boolCondition(condition: Expression): Expression {
  if (condition.type === 'bool') return condition;
  throw new ShadingLanguageError(
    `Godot writes a loop condition of type '${condition.type}', which the GPU compiler refuses.`,
    condition.position
  );
}

const isEmpty = (statement: Statement) => statement.kind === 'operator' && statement.op === 'OP_EMPTY';
