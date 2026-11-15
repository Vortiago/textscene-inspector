/**
 * Asks Godot's Expression class for each text, as the shader preprocessor runs it
 * (shader_preprocessor.cpp:494): parse with no input names, then execute with no inputs and no base.
 */

import { runGodotScriptToExit } from '../godot-probes/godotRun.mjs';
import { DUMP_GDSCRIPT } from '../../apps/textscene-three-godot-shaders/tests/expressions/dump.mjs';

const TEXTS_FILE = 'expressions.json';
const LINE = /^EXPRESSION (\d+) (value|parse|execute) (.*)$/;

const MAIN_SCRIPT = `extends Node
${DUMP_GDSCRIPT}
func answer(text: String) -> String:
	var expression := Expression.new()
	if expression.parse(text, PackedStringArray()) != OK:
		return "parse " + JSON.stringify(expression.get_error_text())
	var value = expression.execute([], null, false)
	if expression.has_execute_failed():
		return "execute " + JSON.stringify(expression.get_error_text())
	return "value " + JSON.stringify(dump(value))

func _ready():
	var texts: Array = JSON.parse_string(FileAccess.get_file_as_string("res://${TEXTS_FILE}"))
	for index in texts.size():
		print("EXPRESSION %d %s" % [index, answer(texts[index])])
	get_tree().quit()
`;

/** Each answer of `stdout`, by the index of its text. Throws on a text Godot did not answer. */
export function parseExpressionOutput(stdout, count) {
  const answers = new Array(count);
  for (const line of stdout.split('\n')) {
    const match = LINE.exec(line);
    if (match) answers[Number(match[1])] = { verdict: match[2], text: JSON.parse(match[3]) };
  }
  const missing = [...answers.keys()].filter((index) => answers[index] === undefined);
  if (missing.length > 0)
    throw new Error(`expected an answer to every expression, found none for ${missing.join(', ')}`);
  return answers;
}

/** Godot's answers to the texts from `first` on, up to the first text that ends Godot. */
async function runFrom(texts, first) {
  const rest = texts.slice(first);
  const { status, stdout, stderr } = await runGodotScriptToExit(MAIN_SCRIPT, {
    [TEXTS_FILE]: JSON.stringify(rest),
  });
  const answered = stdout.split('\n').filter((line) => LINE.test(line)).length;
  if (status === 0) return { answers: parseExpressionOutput(stdout, rest.length) };
  if (!stdout.includes('handle_crash: Program crashed'))
    throw new Error(`godot exited with ${status}:\n${stderr}`);
  return { answers: parseExpressionOutput(stdout, answered), crashed: first + answered };
}

/**
 * Godot's `{ verdict, text }` for each of `texts`, in order. A text that crashes Godot, such as an
 * int64 division that raises SIGFPE, answers `crash`, and the run goes on from the next text.
 */
export async function runExpressionsInGodot(texts) {
  const answers = [];
  while (answers.length < texts.length) {
    const run = await runFrom(texts, answers.length);
    answers.push(...run.answers);
    if (run.crashed !== undefined) answers.push({ verdict: 'crash', text: '' });
  }
  return answers;
}
