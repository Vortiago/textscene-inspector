/**
 * The judge of the transpiler's front end against Godot: for one shader text, Godot's verdict and
 * the transpiler's give one of three states, or a mismatch, which fails a test. The transpiler
 * may refuse what it does not translate yet, but it must name the open row's owner.
 */

import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { translateShadingLanguage } from '../../../../packages/textscene-core/src/shaders/language/translate.ts';

/**
 * The owner in a refusal of a construct not translated yet, as `notTranslated` and the overload
 * refusal write it (`shaders/language/instructions.ts`): `'sin' is not translated yet (#1825)`.
 */
const NOT_TRANSLATED = /is not translated yet \((#\d+)\)/;

/**
 * The transpiler's verdict on `text`: `{ accepted: true }`, `{ accepted: false, message, line }`,
 * or the open row's `owner` with the refusal. Any other throw is a crash, kept as its text.
 */
export function transpilerVerdict(text) {
  try {
    translateShadingLanguage(text);
    return { accepted: true };
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) return { crashed: String(error?.stack ?? error) };
    const message = error.message.replace(/^line \d+: /, '');
    const owner = NOT_TRANSLATED.exec(message)?.[1];
    return { accepted: false, message, line: error.line, ...(owner && { owner }) };
  }
}

/**
 * The state of one shader: `translated`, `refused as Godot refuses`, `not translated yet` with
 * the owner, or `mismatch` with the detail.
 */
export function judge(godot, transpiler) {
  if (transpiler.crashed) return mismatch(`the transpiler crashed: ${transpiler.crashed}`);
  if (transpiler.owner)
    return { state: 'not translated yet', owner: transpiler.owner, detail: transpiler.message };
  if (godot.accepted && transpiler.accepted) return { state: 'translated' };
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
