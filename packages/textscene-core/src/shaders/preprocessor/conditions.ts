import { runExpression, UnportedExpression } from '../../godot/expression/execute.js';
import { GodotCrash } from '../../godot/variant/cInteger.js';
import { booleanize } from '../../godot/variant/compare.js';
import type { UtilityHost } from '../../godot/variant/utility/utilityHost.js';
import { UnsupportedObject } from '../../godot/variant/objects/makeObject.js';
import { UnportableUtility } from '../../godot/variant/utility/unportableUtility.js';
import { UnportableComparison } from '../../godot/variant/operators/ordering.js';
import { instruction, notTranspiled } from '../language/instructions.js';
import { ShadingLanguageError, type SourcePosition } from '../language/shadingLanguageError.js';
import { type Defines, expandMacros, findMatch } from './macros.js';
import { END, isCharSpace, isCharWord } from './preprocessorChars.js';
import { PreprocessorError } from './preprocessorError.js';

const DEFINED = 'defined';

const expected = (what: string, line: number) => new PreprocessorError(`Expected a '${what}'.`, line);
const unexpected = (text: string, at: number, line: number) =>
  new PreprocessorError(`Unexpected token: '${String.fromCodePoint(text.codePointAt(at)!)}'.`, line);

/** What a condition reads: the macros, and the host whose generator `seed` sets for the rest of the run. */
export interface ConditionScope {
  readonly defines: Defines;
  readonly host: UtilityHost;
}

/** The truth of an `#if` or `#elif` condition (shader_preprocessor.cpp:596). */
export function isConditionTrue(condition: string, { defines, host }: ConditionScope, line: number): boolean {
  if (condition === '') throw new PreprocessorError('Missing condition.', line);
  const expanded = expandMacros(expandDefined(condition, defines, line), defines, line);
  const result = runExpression(expanded, host);
  if ('parseError' in result) throw new PreprocessorError(result.parseError, line);
  // A failed execution counts as true when it leaves a value, as `1 / 0` leaves an error text.
  if (result.value.type === 'NIL') throw new PreprocessorError('Condition evaluation error.', line);
  return booleanize(result.value);
}

/** The refusal of a condition the Expression port cannot answer as Godot does. Other errors pass through. */
export function conditionRefusal(
  error: unknown,
  name: 'if' | 'elif',
  directive: string,
  position: SourcePosition
): unknown {
  const row = instruction(`#${name}`)!;
  if (error instanceof UnportedExpression || error instanceof UnportableUtility)
    return notTranspiled(row, position, `${directive}: ${error.message}`);
  if (error instanceof UnsupportedObject)
    return notTranspiled({ ...row, owner: error.owner }, position, `${directive}: ${error.message}`);
  if (error instanceof UnportableComparison) return new ShadingLanguageError(error.message, position);
  if (error instanceof GodotCrash)
    return new ShadingLanguageError(`Godot crashes on ${directive}: ${error.message}`, position);
  return error;
}

function checkBrackets(text: string, line: number): void {
  let opened = 0;
  let closed = 0;
  for (const char of text) {
    if (char === '(') opened += 1;
    else if (char === ')') closed += 1;
  }
  if (opened > closed) throw expected(')', line);
  if (closed > opened) throw expected('(', line);
}

/** `expand_condition` (shader_preprocessor.cpp:874): `defined NAME` and `defined(NAME)` as true or false. */
function expandDefined(condition: string, defines: Defines, line: number): string {
  checkBrackets(condition, line);
  let result = condition;
  let searchFrom = 0;
  // Godot sets the end once outside the loop, so a later `defined` at the text's end reuses it.
  let end = 0;
  for (
    let match = findMatch(result, DEFINED, searchFrom);
    match;
    match = findMatch(result, DEFINED, searchFrom)
  ) {
    const { index } = match;
    const operand = definedOperand(result, index + DEFINED.length, line);
    if (operand.end !== undefined) end = operand.end;
    const text = result;
    result = result.slice(0, index) + (defines.has(operand.name) ? 'true' : 'false');
    searchFrom = result.length;
    if (end > 0) result += text.slice(end);
  }
  return result;
}

interface DefinedOperand {
  readonly name: string;
  // Nothing where Godot leaves `index_end` as it was.
  readonly end: number | undefined;
}

// The scan of shader_preprocessor.cpp:912-976, from the character after `defined`.
function definedOperand(text: string, from: number, line: number): DefinedOperand {
  let isBracketOpen = false;
  let hasWord = false;
  let isWordComplete = false;
  let name = '';
  let end: number | undefined;
  let afterBracket: number | undefined;
  for (let at = from; at <= text.length; at += 1) {
    const char = text[at] ?? END;
    if (char === END) {
      if (hasWord) isWordComplete = true;
      break;
    }
    const isSpace = isCharSpace(char);
    if (isWordComplete) {
      if (char === ')') continue;
      if (char === '|' || char === '&') {
        if (isBracketOpen) throw unexpected(text, at, line);
        break;
      }
      if (!isSpace) throw unexpected(text, at, line);
    } else if (isSpace) {
      if (hasWord && !isBracketOpen) {
        end = at;
        isWordComplete = true;
      }
    } else if (char === '(') {
      if (isBracketOpen) throw unexpected(text, at, line);
      isBracketOpen = true;
    } else if (char === ')') {
      if (isBracketOpen) {
        if (!hasWord) throw unexpected(text, at, line);
        isBracketOpen = false;
        afterBracket = at + 1;
      } else {
        end = at;
      }
      isWordComplete = true;
    } else if (isCharWord(char)) {
      name += char;
      hasWord = true;
    } else {
      throw unexpected(text, at, line);
    }
  }
  if (!isWordComplete) throw new PreprocessorError('Invalid macro name.', line);
  if (isBracketOpen) throw expected(')', line);
  return { name, end: afterBracket ?? end };
}
