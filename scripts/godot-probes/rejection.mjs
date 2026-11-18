import { MAIN_SCRIPT, probeIncludeFiles, probeProjectFiles } from './godotProject.mjs';
import { probeShader, probeSourceLineOffset } from './probeShader.mjs';
import { runGodotScriptToExit } from './godotRun.mjs';
import { godotVerdicts, SHADER_ERROR, shaderErrorOf } from './shaderVerdicts.mjs';

/** Godot's crash handler: `Program crashed with signal <n>`, before its backtrace. */
const CRASH = /Program crashed with signal (\d+)/;

/** glslang's form: `ERROR: 0:<line>: <message>`, the first of which names the fault. */
const GLSL_ERROR = /^ERROR: \d+:\d+: (.*)$/m;

/** A crash comes first: Godot ends before it reaches any later stage. */
export function parseRejection(output) {
  const crash = CRASH.exec(output);
  if (crash) return { stage: 'Godot', message: `Godot ends with signal ${crash[1]}` };
  const language = SHADER_ERROR.exec(output);
  if (language) return { stage: 'shading language', ...shaderErrorOf(language) };
  const glsl = GLSL_ERROR.exec(output);
  if (glsl) return { stage: 'GLSL', message: glsl[1].trim() };
  throw new Error(`expected Godot's shader error in its output, got:\n${output.slice(0, 2000)}`);
}

/** Godot may crash and print its report on standard output. Any other failed run throws. */
export async function godotRejection(probe) {
  const { status, stdout, stderr } = await runGodotScriptToExit(MAIN_SCRIPT, probeProjectFiles([probe]));
  if (status !== 0 && !CRASH.test(stdout)) throw new Error(`godot exited with ${status}:\n${stderr}`);
  const rejection = parseRejection(stdout);
  return rejection.line === undefined ? rejection : inProbeSource(probe, rejection);
}

/** The refusal's line in the probe's source, or in the probe's include that Godot names. */
function inProbeSource(probe, { file, line, ...refusal }) {
  if (isIncludeOf(probe, file)) return { ...refusal, file, line };
  return { ...refusal, line: line - probeSourceLineOffset(probe) };
}

const isIncludeOf = (probe, file) =>
  file !== undefined && Object.keys(probe.includes ?? {}).some((name) => file === `res://${name}`);

/** A probe the front end accepts is left out: only a run of it alone shows its reason. */
export async function frontEndRejections(probes) {
  const { verdicts } = await godotVerdicts(probes.map(probeShader), probeIncludeFiles(probes));
  return new Map(
    probes.flatMap((probe, index) => {
      const verdict = verdicts[index];
      if (verdict.accepted) return [];
      const { message, line, file } = verdict;
      return [[probe.name, inProbeSource(probe, { stage: 'shading language', message, line, file })]];
    })
  );
}
