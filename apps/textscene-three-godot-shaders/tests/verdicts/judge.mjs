/**
 * The judge of the transpiler's front end against Godot: for one shader text, Godot's verdict and
 * the transpiler's give one of three states, or a mismatch, which fails a test. The transpiler
 * may refuse what it does not transpile yet, but it must name the open row's owner.
 */

import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { transpileShadingLanguage } from '../../../../packages/textscene-core/src/shaders/language/transpile.ts';

/**
 * The owner in a refusal of a construct not transpiled yet, as `notTranspiled` and the overload
 * refusal write it (`shaders/language/instructions.ts`): the issue number in brackets after
 * `is not transpiled yet`.
 */
const NOT_TRANSPILED = /is not transpiled yet \((#\d+)\)/;

/**
 * The transpiler's verdict on `text`: `{ accepted: true }`, `{ accepted: false, message, line }`,
 * or the open row's `owner` with the refusal. Any other throw is a crash, kept as its text.
 */
export function transpilerVerdict(text) {
  try {
    transpileShadingLanguage(text);
    return { accepted: true };
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) return { crashed: String(error?.stack ?? error) };
    const message = error.message.replace(/^line \d+: /, '');
    const owner = NOT_TRANSPILED.exec(message)?.[1];
    return { accepted: false, message, line: error.line, ...(owner && { owner }) };
  }
}

/**
 * The state of one shader: `transpiled`, `refused as Godot refuses`, `not transpiled yet` with
 * the owner, or `mismatch` with the detail.
 */
export function judge(godot, transpiler) {
  if (transpiler.crashed) return mismatch(`the transpiler crashed: ${transpiler.crashed}`);
  if (transpiler.owner)
    return { state: 'not transpiled yet', owner: transpiler.owner, detail: transpiler.message };
  if (godot.accepted && transpiler.accepted) return { state: 'transpiled' };
  if (godot.accepted)
    return mismatch(`Godot accepts it, the transpiler refuses: ${describeVerdict(transpiler)}`);
  if (transpiler.accepted)
    return mismatch(`Godot refuses it (${describeVerdict(godot)}), the transpiler accepts`);
  if (godot.message === transpiler.message && godot.line === transpiler.line) {
    return { state: 'refused as Godot refuses' };
  }
  return mismatch(`Godot: ${describeVerdict(godot)}, the transpiler: ${describeVerdict(transpiler)}`);
}

const describeVerdict = ({ message, line }) => `line ${line}: ${message}`;

const mismatch = (detail) => ({ state: 'mismatch', detail });
