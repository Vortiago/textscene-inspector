import { inChunksAtOnce, oneGodot, printedField, runGodotScript } from './godotRun.mjs';

const MARKER = 'VERDICT ';
const DONE = 'VERDICTS DONE';

/** Errors go to standard error so `xvfb-run` keeps their order with the markers (`/usr/bin/xvfb-run:184`). */
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

/** The texts run in chunks at once, and every run must name the same Godot. */
export async function godotVerdicts(texts, includes = {}) {
  const runs = await inChunksAtOnce(texts, async (chunk) => {
    const output = await runGodotScript(VERDICT_SCRIPT, {
      'shaders.json': JSON.stringify(chunk),
      ...includes,
    });
    return { godot: printedField(output, 'GODOT '), verdicts: parseVerdictOutput(output, chunk.length) };
  });
  const { godot } = oneGodot(runs);
  return { godot, verdicts: runs.flatMap((run) => run.verdicts) };
}

/** Godot prints `SHADER ERROR: <message>`, then `at: (null) (<file>:<line>)`, for a shader's first error. */
export function parseVerdictOutput(output, count) {
  if (!output.includes(DONE)) {
    throw new Error(`expected "${DONE}" after ${count} shaders in Godot's output, found none`);
  }
  const blocks = output.split(DONE)[0].split(MARKER).slice(1);
  if (blocks.length !== count) throw new Error(`expected ${count} verdicts from Godot, got ${blocks.length}`);
  return blocks.map(verdictOf);
}

/** The message may span lines. The file is empty for a string, an include's path inside it (:1588). */
export const SHADER_ERROR = /SHADER ERROR: ([\s\S]*?)\n\s*at: \(null\) \((\S*):(\d+)\)/;

/** The message, line and file of a match of `SHADER_ERROR`, with no file for the shader itself. */
export function shaderErrorOf([, message, file, line]) {
  return { message: message.trim(), line: Number(line), ...(file && { file }) };
}

function verdictOf(block) {
  const error = SHADER_ERROR.exec(block);
  if (!error && block.includes('SHADER ERROR')) {
    throw new Error(`expected "at: (null) (<file>:<line>)" after Godot's shader error, got:\n${block}`);
  }
  if (!error) return { accepted: true };
  return { accepted: false, ...shaderErrorOf(error) };
}

/** A verdict as a record holds it: `accepted`, or `line <n>[ in <file>]: <Godot's message>`. */
export function verdictText(verdict) {
  if (verdict.accepted) return 'accepted';
  return `line ${verdict.line}${verdict.file ? ` in ${verdict.file}` : ''}: ${verdict.message}`;
}

/** The verdict that `verdictText` wrote. */
export function verdictOfText(text) {
  if (text === 'accepted') return { accepted: true };
  const match = /^line (\d+)(?: in (\S+))?: (.*)$/s.exec(text);
  if (!match) throw new Error(`expected "accepted" or "line <n>: <message>", got ${text}`);
  return { accepted: false, message: match[3], line: Number(match[1]), ...(match[2] && { file: match[2] }) };
}

/** A verdict record: Godot's version and each case's verdict by its id. */
export function verdictRecord(godot, ids, verdicts) {
  const cases = Object.fromEntries(ids.map((id, index) => [id, verdictText(verdicts[index])]));
  return { godot, cases };
}
