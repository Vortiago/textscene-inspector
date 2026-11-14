/**
 * Godot's verdict on whole shader texts: a main script sets each text as a `Shader`'s code, which
 * compiles it at once, and prints a marker before each one. Godot prints the first error of a
 * shader it refuses between two markers, so the parse of the output reads each verdict.
 */

import { inChunksAtOnce, printedField, runGodotScript } from './godotRun.mjs';

const MARKER = 'VERDICT ';
const DONE = 'VERDICTS DONE';

/**
 * The texts go in one JSON file: a `.gdshader` file in the project would be read as a resource
 * too, and a `Shader` set from a string compiles the same way. The markers go to standard error,
 * as Godot's errors do, so the two keep their order: `xvfb-run` joins standard error to standard
 * output (`/usr/bin/xvfb-run:184`).
 */
const VERDICT_SCRIPT = `extends Node

func _ready() -> void:
	var texts: Array = JSON.parse_string(FileAccess.get_file_as_string("res://shaders.json"))
	printerr("GODOT ", Engine.get_version_info().string)
	for index in texts.size():
		printerr("${MARKER}", index)
		var shader := Shader.new()
		shader.code = texts[index]
		shader.get_rid()
	printerr("${DONE}")
	get_tree().quit()
`;

/**
 * Godot's version, and its verdict on each of `texts` in order: `{ accepted: true }` or its
 * message and line. The texts run in chunks at once, and every run must name the same Godot.
 */
export async function godotVerdicts(texts) {
  const runs = await inChunksAtOnce(texts, async (chunk) => {
    const output = await runGodotScript(VERDICT_SCRIPT, { 'shaders.json': JSON.stringify(chunk) });
    return { godot: printedField(output, 'GODOT '), verdicts: parseVerdictOutput(output, chunk.length) };
  });
  const [{ godot }] = runs;
  const other = runs.find((run) => run.godot !== godot);
  if (other) throw new Error(`expected one Godot, got ${godot} and ${other.godot}`);
  return { godot, verdicts: runs.flatMap((run) => run.verdicts) };
}

/**
 * The verdicts of `count` shaders in Godot's output. Godot prints `SHADER ERROR: <message>`
 * and on the next line `at: (null) (:<line>)` for the first error of a shader it refuses.
 */
export function parseVerdictOutput(output, count) {
  if (!output.includes(DONE)) {
    throw new Error(`expected "${DONE}" after ${count} shaders in Godot's output, found none`);
  }
  const blocks = output.split(DONE)[0].split(MARKER).slice(1);
  if (blocks.length !== count) throw new Error(`expected ${count} verdicts from Godot, got ${blocks.length}`);
  return blocks.map(verdictOf);
}

/**
 * Godot's error on a shader set from a string: its message, which may hold several lines, as the
 * candidates of an overload do, then the empty path and the line.
 */
const SHADER_ERROR = /SHADER ERROR: ([\s\S]*?)\n\s*at: .*\(:(\d+)\)/;

function verdictOf(block) {
  const error = SHADER_ERROR.exec(block);
  if (!error && block.includes('SHADER ERROR')) {
    throw new Error(`expected "at: (null) (:<line>)" after Godot's shader error, got:\n${block}`);
  }
  if (!error) return { accepted: true };
  return { accepted: false, message: error[1].trim(), line: Number(error[2]) };
}

/** A verdict as a record holds it: `accepted`, or `line <n>: <Godot's message>`. */
export function verdictText(verdict) {
  return verdict.accepted ? 'accepted' : `line ${verdict.line}: ${verdict.message}`;
}

/** The verdict that `verdictText` wrote. */
export function verdictOfText(text) {
  if (text === 'accepted') return { accepted: true };
  const match = /^line (\d+): (.*)$/s.exec(text);
  if (!match) throw new Error(`expected "accepted" or "line <n>: <message>", got ${text}`);
  return { accepted: false, message: match[2], line: Number(match[1]) };
}

/** A verdict record: Godot's version and each case's verdict by its id. */
export function verdictRecord(godot, ids, verdicts) {
  const cases = Object.fromEntries(ids.map((id, index) => [id, verdictText(verdicts[index])]));
  return { godot, cases };
}
