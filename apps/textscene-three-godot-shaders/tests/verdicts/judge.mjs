import { ShadingLanguageError } from '../../../../packages/textscene-core/src/shaders/language/shadingLanguageError.ts';
import { parsedShader } from '../../../../packages/textscene-core/src/shaders/language/parseShader.ts';
import { transpileParsedShader } from '../../../../packages/textscene-core/src/shaders/language/transpile.ts';
import { transpileParsedSky } from '../../../../packages/textscene-core/src/shaders/sky/transpileSky.ts';

/** The entry of each shader type that links into a template of Godot's, as a user calls it. */
const TEMPLATE_ENTRIES = { sky: (parsed) => transpileParsedSky(parsed, '') };

/** A throw other than a refusal is a crash, kept as its text. */
export function transpilerVerdict(text) {
  try {
    const parsed = parsedShader(text);
    const entry = TEMPLATE_ENTRIES[parsed.tree.shaderType] ?? transpileParsedShader;
    entry(parsed);
    return { accepted: true };
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) return { crashed: String(error?.stack ?? error) };
    const { reason: message, line, owner } = error;
    return { accepted: false, message, line, ...(owner && { owner }) };
  }
}

/** `transpiled`, `refused as Godot refuses`, `not transpiled yet` with the owner, or `mismatch`. */
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
