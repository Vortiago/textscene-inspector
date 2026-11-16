import { printedField, requireGodotVersion, runGodotScriptToExit } from '../godot-probes/godotRun.mjs';
import { DUMP_GDSCRIPT } from '../../apps/textscene-three-godot-shaders/tests/expressions/dump.mjs';

const TEXTS_FILE = 'expressions.json';

/** The files of the project the expressions run in, which a `Resource(...)` text can load. */
export const PROJECT_FILES = [
  'res://project.godot',
  'res://main.tscn',
  'res://main.gd',
  `res://${TEXTS_FILE}`,
];
const LINE = /^EXPRESSION (\d+) (value|parse|execute) (.*)$/;

const MAIN_SCRIPT = `extends Node
${DUMP_GDSCRIPT}
func answer(text: String) -> String:
	var expression := Expression.new()
	if expression.parse(text, PackedStringArray()) != OK:
		return "parse " + JSON.stringify(expression.get_error_text())
	var value = expression.execute([], null, false)
	if expression.has_execute_failed():
		return "execute " + JSON.stringify({"error": expression.get_error_text(), "left": dump(value)})
	return "value " + JSON.stringify(dump(value))

func _ready():
	var texts: Array = JSON.parse_string(FileAccess.get_file_as_string("res://${TEXTS_FILE}"))
	print("GODOT ", Engine.get_version_info().string)
	for index in texts.size():
		var answered := answer(texts[index])
		# A newline first: printraw leaves the line it writes open.
		print("\nEXPRESSION %d %s" % [index, answered])
	get_tree().quit()
`;

// A failed execute still returns its value (expression.cpp:1507), so the answer keeps what it leaves.
const answerOf = (verdict, printed) =>
  verdict === 'execute' ? { verdict, text: printed.error, left: printed.left } : { verdict, text: printed };

/** Each answer of `stdout`, by the index of its text. Throws on a text Godot did not answer. */
export function parseExpressionOutput(stdout, count) {
  const answers = new Array(count);
  for (const line of stdout.split('\n')) {
    const match = LINE.exec(line);
    if (match) answers[Number(match[1])] = answerOf(match[2], JSON.parse(match[3]));
  }
  const missing = [...answers.keys()].filter((index) => answers[index] === undefined);
  if (missing.length > 0)
    throw new Error(`expected an answer to every expression, found none for ${missing.join(', ')}`);
  return answers;
}

// One Godot run answers at most this many texts, so it ends inside the engine's 300 s timeout.
const TEXTS_PER_RUN = 3000;

/** Godot's answers to a batch of texts from `first` on, up to the first text that ends Godot. */
async function runFrom(texts, first) {
  const rest = texts.slice(first, first + TEXTS_PER_RUN);
  const { status, stdout, stderr } = await runGodotScriptToExit(MAIN_SCRIPT, {
    [TEXTS_FILE]: JSON.stringify(rest),
  });
  const answered = stdout.split('\n').filter((line) => LINE.test(line)).length;
  const godot = printedField(stdout, 'GODOT ');
  requireGodotVersion(godot);
  if (status === 0) return { godot, answers: parseExpressionOutput(stdout, rest.length) };
  if (!stdout.includes('handle_crash: Program crashed'))
    throw new Error(`godot exited with ${status} at ${JSON.stringify(rest[answered])}:\n${stderr}`);
  return { godot, answers: parseExpressionOutput(stdout, answered), crashed: first + answered };
}

/** A text that crashes Godot, such as an int64 division that raises SIGFPE, answers `crash`. */
async function askGodot(texts) {
  const answers = [];
  let godot;
  while (answers.length < texts.length) {
    const run = await runFrom(texts, answers.length);
    godot = run.godot;
    answers.push(...run.answers);
    if (run.crashed !== undefined) answers.push({ verdict: 'crash', text: '' });
  }
  return { godot, answers };
}

/** Godot's `{ verdict, text }` for each of `texts`, in order. */
export async function runExpressionsInGodot(texts) {
  return (await askGodot(texts)).answers;
}

/** The `expressions` family of `pnpm godot:probes`: Godot's version and its answer to each case, by id. */
export async function expressionRecord(cases) {
  const { godot, answers } = await askGodot(cases.map((each) => each.text));
  return { godot, cases: Object.fromEntries(cases.map((each, index) => [each.id, answers[index]])) };
}
