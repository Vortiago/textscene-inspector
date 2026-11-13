/**
 * Godot's reason for a probe it draws nothing for. Godot's front end prints its own message with
 * the line of the probe's shader, which the record keeps as a line of the probe's source. A text the front end accepts can still fail in the GPU
 * compiler, which prints a line of the whole GLSL Godot writes. That line moves by a few from one
 * run to the next, so the record keeps the message alone. A shader can also end Godot itself,
 * which prints the signal. The parse needs no engine.
 */

import { MAIN_SCRIPT, probeProjectFiles } from './godotProject.mjs';
import { probeSourceLineOffset } from './probeShader.mjs';
import { runGodotScriptToExit } from './godotRun.mjs';

/** Godot's crash handler: `Program crashed with signal <n>`, before its backtrace. */
const CRASH = /Program crashed with signal (\d+)/;

/** The front end's form: the message, then the shader's path, which may be empty, and its line. */
const LANGUAGE_ERROR = /SHADER ERROR: (.*)\n\s*at: .*\(\S*:(\d+)\)/;

/** glslang's form: `ERROR: 0:<line>: <message>`, the first of which names the fault. */
const GLSL_ERROR = /^ERROR: \d+:\d+: (.*)$/m;

/**
 * The stage that refuses, its message, and the probe's line where Godot's front end refuses. A
 * crash comes first: Godot ends before it reaches any later stage.
 */
export function parseRejection(output) {
  const crash = CRASH.exec(output);
  if (crash) return { stage: 'Godot', message: `Godot ends with signal ${crash[1]}` };
  const language = LANGUAGE_ERROR.exec(output);
  if (language) return { stage: 'shading language', message: language[1].trim(), line: Number(language[2]) };
  const glsl = GLSL_ERROR.exec(output);
  if (glsl) return { stage: 'GLSL', message: glsl[1].trim() };
  throw new Error(`expected Godot's shader error in its output, got:\n${output.slice(0, 2000)}`);
}

/**
 * Godot's reason for `probe`, from a run of that probe alone. A run may end Godot, which prints
 * its crash report on standard output. Any other failed run throws.
 */
export function godotRejection(probe) {
  const { status, stdout, stderr } = runGodotScriptToExit(MAIN_SCRIPT, probeProjectFiles([probe]));
  if (status !== 0 && !CRASH.test(stdout)) throw new Error(`godot exited with ${status}:\n${stderr}`);
  const rejection = parseRejection(stdout);
  if (rejection.line === undefined) return rejection;
  return { ...rejection, line: rejection.line - probeSourceLineOffset(probe) };
}
