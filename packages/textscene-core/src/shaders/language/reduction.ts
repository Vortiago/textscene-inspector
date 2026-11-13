/**
 * The reduction loop of `_parse_expression` (`shader_language.cpp:7501`): the flat list of
 * operands and operators becomes one tree, the operator of lowest priority first, leftmost first.
 * Each operator is typed by its row of the instruction table, with Godot's messages.
 */

import { assignmentRefusal } from './assignment.js';
import { signatureInstruction } from './instructions.js';
import { OPERATOR_RULES, isAssignOperator, operatorText } from './operators.js';
import type { SourcePosition } from './shadingLanguageError.js';
import type { Expression, OperatorNode } from './shaderTree.js';

export type Entry =
  | { readonly isOperator: false; readonly node: Expression }
  | { readonly isOperator: true; readonly op: string; readonly position: SourcePosition };

/** Fails with Godot's message at the token Godot reports. */
export type Fail = (message: string) => never;

/** The one tree of `entries`, which this empties as it reduces. */
export function reducedEntries(entries: Entry[], fail: Fail): Expression {
  while (entries.length > 1) {
    const next = nextOperator(entries);
    const arity = OPERATOR_RULES.get(entryOperator(entries[next]!))!.arity;
    if (arity === 'unary') reduceUnary(entries, next, fail);
    else if (arity === 'ternary') reduceTernary(entries, next, fail);
    else reduceBinary(entries, next, fail);
  }
  return nodeOf(entries[0]!, fail);
}

/** The leftmost operator of the lowest priority (`shader_language.cpp:7646`). */
function nextOperator(entries: readonly Entry[]): number {
  let next = -1;
  let lowest = Infinity;
  entries.forEach((entry, index) => {
    if (!entry.isOperator) return;
    const priority = OPERATOR_RULES.get(entry.op)!.priority;
    if (priority < lowest) {
      next = index;
      lowest = priority;
    }
  });
  return next;
}

/** Each unary operator from the operand back to `next`, the nearest first (`shader_language.cpp:7670`). */
function reduceUnary(entries: Entry[], next: number, fail: Fail): void {
  let operandIndex = next;
  while (entries[operandIndex]!.isOperator) {
    operandIndex += 1;
    if (operandIndex === entries.length) fail('Unexpected end of expression.');
  }
  for (let index = operandIndex - 1; index >= next; index -= 1) {
    const entry = entries[index]!;
    const op = entryOperator(entry);
    const operand = nodeOf(entries[index + 1]!, fail);
    if (op === 'OP_INCREMENT' || op === 'OP_DECREMENT') failOnRefusal(assignmentRefusal(operand), fail);
    const node = operatorNode(op, [operand], positionOf(entry));
    if (!node) fail(`Invalid arguments to unary operator '${operatorText(op)}': ${typeList([operand])}.`);
    entries.splice(index, 2, { isOperator: false, node });
  }
}

/** `condition ? then : else`, from the five entries around `next` (`shader_language.cpp:7708`). */
function reduceTernary(entries: Entry[], next: number, fail: Fail): void {
  if (next < 1 || next >= entries.length - 1) fail('Parser bug.');
  const separator = entries[next + 2];
  if (!separator?.isOperator || separator.op !== 'OP_SELECT_ELSE')
    fail("Missing matching ':' for select operator.");
  const operands = [entries[next - 1], entries[next + 1], entries[next + 3]].map((entry) =>
    nodeOf(entry, fail)
  );
  const node = operatorNode('OP_SELECT_IF', operands, operands[0]!.position);
  if (!node) fail(`Invalid argument to ternary operator: '${typeList(operands)}'.`);
  entries.splice(next - 1, 5, { isOperator: false, node });
}

function reduceBinary(entries: Entry[], next: number, fail: Fail): void {
  if (next < 1 || next >= entries.length - 1 || entries[next - 1]!.isOperator) fail('Parser bug.');
  const op = entryOperator(entries[next]!);
  const left = nodeOf(entries[next - 1]!, fail);
  if (isAssignOperator(op)) failOnRefusal(assignmentRefusal(left), fail);
  // Unary operators reduce first, so no operator follows a binary one in a list Godot builds.
  const right = nodeOf(entries[next + 1]!, fail);
  const node = operatorNode(op, [left, right], left.position);
  if (!node) fail(`Invalid arguments to operator '${operatorText(op)}': '${typeList([left, right])}'.`);
  entries.splice(next - 1, 3, { isOperator: false, node });
}

/** The node of `op` over `operands`, typed by its row, or nothing when Godot has no such row. */
function operatorNode(
  op: string,
  operands: Expression[],
  position: SourcePosition
): OperatorNode | undefined {
  const row = signatureInstruction(
    op,
    operands.map((operand) => operand.type)
  );
  if (!row) return undefined;
  return { kind: 'operator', type: row.returns!, op, row, operands, position };
}

const typeList = (operands: readonly Expression[]) => operands.map((operand) => operand.type).join(', ');

function failOnRefusal(refusal: string | undefined, fail: Fail): void {
  if (refusal !== undefined) fail(refusal);
}

function entryOperator(entry: Entry): string {
  if (!entry.isOperator) throw new Error('expected an operator entry, found an operand');
  return entry.op;
}

const positionOf = (entry: Entry) => (entry.isOperator ? entry.position : entry.node.position);

/** The operand of `entry`. Godot reads an operator's empty node here, which it reports as a parser bug. */
function nodeOf(entry: Entry | undefined, fail: Fail): Expression {
  return entry === undefined || entry.isOperator ? fail('Parser bug.') : entry.node;
}
