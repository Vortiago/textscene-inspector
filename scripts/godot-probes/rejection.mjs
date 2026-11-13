/**
 * Godot's reason for a probe it draws nothing for. Godot's front end prints its own message with
 * the line of the probe's shader. A text the front end accepts can still fail in the GPU
 * compiler, which prints a line of the whole GLSL Godot writes. That line moves by a few from one
 * run to the next, so the record keeps the message alone. The parse needs no engine.
 */

import { MAIN_SCRIPT, probeProjectFiles } from './godotProject.mjs';
import { runGodotScript } from './godotRun.mjs';

const LANGUAGE_ERROR = /SHADER ERROR: (.*)\n\s*at: .*\(:(\d+)\)/;

/** glslang's form: `ERROR: 0:<line>: <message>`, the first of which names the fault. */
const GLSL_ERROR = /^ERROR: \d+:\d+: (.*)$/m;

/** The stage that refuses, its message, and the probe's line where Godot's front end refuses. */
export function parseRejection(output) {
  const language = LANGUAGE_ERROR.exec(output);
  if (language) return { stage: 'shading language', message: language[1].trim(), line: Number(language[2]) };
  const glsl = GLSL_ERROR.exec(output);
  if (glsl) return { stage: 'GLSL', message: glsl[1].trim() };
  throw new Error(`expected Godot's shader error in its output, got:\n${output.slice(0, 2000)}`);
}

/** Godot's reason for `probe`, from a run of that probe alone. */
export function godotRejection(probe) {
  return parseRejection(runGodotScript(MAIN_SCRIPT, probeProjectFiles([probe])));
}
