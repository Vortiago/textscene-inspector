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

import { CALL_STACK_SIZE, CodeRange, type Definition, type ExecContext } from './ttExecContext';
import { OPCODE_LENGTH } from './ttOpcodes';

const OPCODE_IF = 0x58;
const OPCODE_ELSE = 0x1b;
const OPCODE_EIF = 0x59;
const OPCODE_FDEF = 0x2c;
const OPCODE_ENDF = 0x2d;
const OPCODE_IDEF = 0x89;

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

/** The first of the `count` records that `matches`, or null. Indexed: CALL runs it on every call. */
function findDefinition(
  definitions: Definition[],
  count: number,
  matches: (definition: Definition) => boolean
): Definition | null {
  for (let index = 0; index < count; index++) if (matches(definitions[index]!)) return definitions[index]!;
  return null;
}

/** The record of `number` among the first `count`, or the next free one; null with no room left. */
function definitionSlot(definitions: Definition[], count: number, number: number): Definition | null {
  const found = findDefinition(definitions, count, (definition) => definition.opcode === number);
  if (found) return found;
  return count < definitions.length ? definitions[count]! : null;
}

/**
 * Starts `definition` at its first byte, with the instruction after the running one to return to.
 * `remainingCalls` counts the runs a LOOPCALL asks for.
 */
function call(exc: ExecContext, definition: Definition, remainingCalls: number): void {
  exc.callStack[exc.callTop++] = {
    callerRange: exc.curRange,
    callerIp: exc.ip + 1,
    remainingCalls,
    definition,
  };
  exc.gotoCodeRange(definition.range, definition.start);
}

/** FDEF: defines a function, numbered up to 16 bits, that only the font and control value programs may define. */
export function defineFunction(exc: ExecContext, a: number): void {
  if (exc.iniRange === CodeRange.GLYPH) {
    exc.fail('DEF_In_Glyf_Bytecode');
    return;
  }
  const number = exc.stack[a]!;
  const definition = definitionSlot(exc.functionDefinitions, exc.functionCount, number);
  if (!definition) {
    exc.fail('Too_Many_Function_Defs');
    return;
  }
  if (definition === exc.functionDefinitions[exc.functionCount]) exc.functionCount++;
  if (number < 0 || number > 0xffff) {
    exc.fail('Too_Many_Function_Defs');
    return;
  }
  Object.assign(definition, { range: exc.curRange, opcode: number, start: exc.ip + 1, isActive: true });
  exc.maxFunction = Math.max(exc.maxFunction, number);
  skipDefinitionBody(exc, definition);
}

/** IDEF: defines what an opcode the interpreter does not know does. */
export function defineInstruction(exc: ExecContext, a: number): void {
  if (exc.iniRange === CodeRange.GLYPH) {
    exc.fail('DEF_In_Glyf_Bytecode');
    return;
  }
  const opcode = exc.stack[a]!;
  const definition = definitionSlot(exc.instructionDefinitions, exc.instructionCount, opcode);
  if (!definition) {
    exc.fail('Too_Many_Instruction_Defs');
    return;
  }
  if (definition === exc.instructionDefinitions[exc.instructionCount]) exc.instructionCount++;
  if (opcode < 0 || opcode > 0xff) {
    exc.fail('Too_Many_Instruction_Defs');
    return;
  }
  Object.assign(definition, { range: exc.curRange, opcode, start: exc.ip + 1, isActive: true });
  skipDefinitionBody(exc, definition);
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
  if (number < 0 || number > exc.maxFunction || exc.functionDefinitions.length === 0) return null;
  const isInOrder =
    exc.maxFunction + 1 === exc.functionCount && exc.functionDefinitions[number]!.opcode === number;
  const definition = isInOrder
    ? exc.functionDefinitions[number]!
    : findDefinition(exc.functionDefinitions, exc.functionCount, (record) => record.opcode === number);
  return definition?.isActive ? definition : null;
}

/** CALL: runs a function once. */
export function callFunction(exc: ExecContext, a: number): void {
  const definition = definedFunction(exc, exc.stack[a]!);
  if (!definition) exc.fail('Invalid_Reference');
  else if (exc.callTop >= CALL_STACK_SIZE) exc.fail('Stack_Overflow');
  else call(exc, definition, 1);
}

/** LOOPCALL: runs a function the count below its number of times, and counts every run against the loop limit. */
export function loopCallFunction(exc: ExecContext, a: number): void {
  const definition = definedFunction(exc, exc.stack[a + 1]!);
  const count = exc.stack[a]!;
  if (!definition) exc.fail('Invalid_Reference');
  else if (exc.callTop >= CALL_STACK_SIZE) exc.fail('Stack_Overflow');
  else if (count > 0) {
    call(exc, definition, count);
    exc.loopCallCount += count;
    if (exc.loopCallCount > exc.maxLoopCallCount) exc.fail('Execution_Too_Long');
  }
}

/**
 * `Ins_UNKNOWN`: an opcode with no instruction runs its IDEF, or is an error. The run loop's own
 * IDEF search after an Invalid_Opcode finds nothing this one has not, so it has no port.
 */
export function unknownOpcode(exc: ExecContext): void {
  const definition = findDefinition(
    exc.instructionDefinitions,
    exc.instructionCount,
    (record) => (record.opcode & 0xff) === exc.opcode && record.isActive
  );
  if (!definition) exc.fail('Invalid_Opcode');
  else if (exc.callTop >= CALL_STACK_SIZE) exc.fail('Stack_Overflow');
  else call(exc, definition, 1);
}
