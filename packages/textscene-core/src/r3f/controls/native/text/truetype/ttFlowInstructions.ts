/**
 * The TrueType instructions that steer the instruction pointer (`ttinterp.c`, `Ins_IF` to
 * `Ins_IDEF` and `Ins_UNKNOWN`): conditions, jumps, and the function and instruction definitions
 * the font and control value programs make and the programs call. Each takes the stack index `a`
 * of its first argument.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  CALL_STACK_SIZE,
  CodeRange,
  type Definition,
  type DefinitionTable,
  type ExecContext,
} from './ttExecContext';
import { OPCODE_LENGTH } from './ttOpcodes';

const OPCODE_IF = 0x58;
const OPCODE_ELSE = 0x1b;
const OPCODE_EIF = 0x59;
const OPCODE_FDEF = 0x2c;
const OPCODE_ENDF = 0x2d;
const OPCODE_IDEF = 0x89;
/** The largest number an FDEF may give a function, and an IDEF an opcode. */
const MAX_FUNCTION_NUMBER = 0xffff;
const MAX_OPCODE = 0xff;

/**
 * `SkipCode`: moves past the running instruction and reads the next one, without running it.
 * False, with the error set, at the end of the code or for a count past it.
 */
function skipCode(exc: ExecContext): boolean {
  exc.ip += exc.length;
  if (exc.ip >= exc.code.length) return exc.fail('Code_Overflow');
  exc.opcode = exc.code[exc.ip]!;
  exc.length = OPCODE_LENGTH[exc.opcode]!;
  if (exc.length < 0) {
    if (exc.ip + 1 >= exc.code.length) return exc.fail('Code_Overflow');
    exc.length = 2 - exc.length * exc.code[exc.ip + 1]!;
  }
  return true;
}

/** IF: a false condition skips to the matching ELSE or EIF. */
export function ifTrue(exc: ExecContext, a: number): void {
  if (exc.stack[a] !== 0) return;
  let depth = 1;
  for (;;) {
    if (!skipCode(exc)) return;
    if (exc.opcode === OPCODE_IF) depth++;
    else if (exc.opcode === OPCODE_ELSE && depth === 1) return;
    else if (exc.opcode === OPCODE_EIF && --depth === 0) return;
  }
}

/** ELSE, reached by running the IF branch: skips to the matching EIF. */
export function otherwise(exc: ExecContext): void {
  let depth = 1;
  while (depth !== 0) {
    if (!skipCode(exc)) return;
    if (exc.opcode === OPCODE_IF) depth++;
    else if (exc.opcode === OPCODE_EIF) depth--;
  }
}

/** JMPR: a jump by a byte offset, which may not leave the running function or loop for too long. */
export function jumpRelative(exc: ExecContext, a: number): void {
  const offset = exc.stack[a]!;
  if (offset === 0 && exc.args === 0) {
    exc.fail('Bad_Argument');
    return;
  }
  exc.ip += offset;
  const call = exc.callTop > 0 ? exc.callStack[exc.callTop - 1]! : null;
  if (exc.ip < 0 || (call && exc.ip > call.definition.end)) {
    exc.fail('Bad_Argument');
    return;
  }
  exc.length = 0;
  if (offset < 0 && ++exc.negativeJumpCount > exc.maxNegativeJumpCount) exc.fail('Execution_Too_Long');
}

/** JROT: JMPR when the condition above the offset is true. */
export function jumpRelativeOnTrue(exc: ExecContext, a: number): void {
  if (exc.stack[a + 1] !== 0) jumpRelative(exc, a);
}

/** JROF: JMPR when the condition above the offset is false. */
export function jumpRelativeOnFalse(exc: ExecContext, a: number): void {
  if (exc.stack[a + 1] === 0) jumpRelative(exc, a);
}

/**
 * Skips a definition's body to its ENDF and records where it ends. A definition inside another
 * is an error.
 */
function skipDefinitionBody(exc: ExecContext, definition: Definition): void {
  while (skipCode(exc)) {
    if (exc.opcode === OPCODE_FDEF || exc.opcode === OPCODE_IDEF) {
      exc.fail('Nested_DEFS');
      return;
    }
    if (exc.opcode === OPCODE_ENDF) {
      definition.end = exc.ip;
      return;
    }
  }
}

/** The first record in use that `matches`, or null. Indexed: CALL runs it on every call. */
function findDefinition(
  { records, count }: DefinitionTable,
  matches: (definition: Definition) => boolean
): Definition | null {
  for (let index = 0; index < count; index++) if (matches(records[index]!)) return records[index]!;
  return null;
}

/** The record in use that `number` names, or the next free one. Null with no room left. */
function definitionSlot(table: DefinitionTable, number: number): Definition | null {
  const found = findDefinition(table, (definition) => definition.opcode === number);
  if (found) return found;
  return table.count < table.records.length ? table.records[table.count]! : null;
}

/**
 * Starts `definition` at its first byte, with the instruction after the running one to return to.
 * `remainingCalls` counts the runs a LOOPCALL asks for.
 */
function call(exc: ExecContext, definition: Definition, remainingCalls: number): void {
  const record = exc.callStack[exc.callTop++]!;
  record.callerRange = exc.curRange;
  record.callerIp = exc.ip + 1;
  record.remainingCalls = remainingCalls;
  record.definition = definition;
  exc.gotoCodeRange(definition.range, definition.start);
}

/**
 * `Ins_FDEF` and `Ins_IDEF`: the record of `number` in `table`, active from the byte after the
 * running instruction. FreeType counts a new record before it checks the number, so a number past
 * `maxNumber` still takes one. Null, with the error set, in a glyph program, with no room left or
 * for a number past `maxNumber`.
 */
function define(
  exc: ExecContext,
  table: DefinitionTable,
  number: number,
  maxNumber: number,
  error: string
): Definition | null {
  if (exc.iniRange === CodeRange.GLYPH) {
    exc.fail('DEF_In_Glyf_Bytecode');
    return null;
  }
  const definition = definitionSlot(table, number);
  if (!definition) {
    exc.fail(error);
    return null;
  }
  if (definition === table.records[table.count]) table.count++;
  if (number < 0 || number > maxNumber) {
    exc.fail(error);
    return null;
  }
  definition.range = exc.curRange;
  definition.opcode = number;
  definition.start = exc.ip + 1;
  definition.isActive = true;
  return definition;
}

/** FDEF: defines a function, which only the font and control value programs may define. */
export function defineFunction(exc: ExecContext, a: number): void {
  const number = exc.stack[a]!;
  const definition = define(
    exc,
    exc.functionDefinitions,
    number,
    MAX_FUNCTION_NUMBER,
    'Too_Many_Function_Defs'
  );
  if (!definition) return;
  exc.maxFunction = Math.max(exc.maxFunction, number);
  skipDefinitionBody(exc, definition);
}

/** IDEF: defines what an opcode the interpreter does not know does. */
export function defineInstruction(exc: ExecContext, a: number): void {
  const definition = define(
    exc,
    exc.instructionDefinitions,
    exc.stack[a]!,
    MAX_OPCODE,
    'Too_Many_Instruction_Defs'
  );
  if (definition) skipDefinitionBody(exc, definition);
}

/** ENDF: runs the function again while its LOOPCALL count lasts, then returns to the caller. */
export function endFunction(exc: ExecContext): void {
  if (exc.callTop <= 0) {
    exc.fail('ENDF_In_Exec_Stream');
    return;
  }
  const record = exc.callStack[--exc.callTop]!;
  if (--record.remainingCalls > 0) {
    exc.callTop++;
    exc.ip = record.definition.start;
    exc.length = 0;
    return;
  }
  // The return address of a CALL that ends its range lies just past it, which is valid.
  exc.gotoCodeRange(record.callerRange, record.callerIp);
}

/**
 * The active function numbered `number`. Fonts number their functions from 0 in order, so the
 * record at `number` is tried before a search.
 */
function definedFunction(exc: ExecContext, number: number): Definition | null {
  const { functionDefinitions } = exc;
  const { records } = functionDefinitions;
  if (number < 0 || number > exc.maxFunction || records.length === 0) return null;
  const isInOrder = exc.maxFunction + 1 === functionDefinitions.count && records[number]!.opcode === number;
  const definition = isInOrder
    ? records[number]!
    : findDefinition(functionDefinitions, (record) => record.opcode === number);
  return definition?.isActive ? definition : null;
}

/** Whether the call stack has room for a call, else false with Stack_Overflow set. */
function hasCallRoom(exc: ExecContext): boolean {
  return exc.callTop < CALL_STACK_SIZE || exc.fail('Stack_Overflow');
}

/** The function a CALL or LOOPCALL runs, or null, with the error set, for none or a full call stack. */
function callableFunction(exc: ExecContext, number: number): Definition | null {
  const definition = definedFunction(exc, number);
  if (!definition) {
    exc.fail('Invalid_Reference');
    return null;
  }
  return hasCallRoom(exc) ? definition : null;
}

/** CALL: runs a function once. */
export function callFunction(exc: ExecContext, a: number): void {
  const definition = callableFunction(exc, exc.stack[a]!);
  if (definition) call(exc, definition, 1);
}

/**
 * LOOPCALL: runs a function the count below its number of times, and counts every run against the
 * loop limit. A count of 0 or less runs nothing, but a full call stack is still an error.
 */
export function loopCallFunction(exc: ExecContext, a: number): void {
  const definition = callableFunction(exc, exc.stack[a + 1]!);
  const count = exc.stack[a]!;
  if (!definition || count <= 0) return;
  call(exc, definition, count);
  exc.loopCallCount += count;
  if (exc.loopCallCount > exc.maxLoopCallCount) exc.fail('Execution_Too_Long');
}

/**
 * `Ins_UNKNOWN`: an opcode with no instruction runs its IDEF, or is an error. The run loop's own
 * IDEF search after an Invalid_Opcode finds nothing this one has not, so it has no port.
 */
export function unknownOpcode(exc: ExecContext): void {
  const definition = findDefinition(
    exc.instructionDefinitions,
    (record) => (record.opcode & 0xff) === exc.opcode && record.isActive
  );
  if (!definition) exc.fail('Invalid_Opcode');
  else if (hasCallRoom(exc)) call(exc, definition, 1);
}
