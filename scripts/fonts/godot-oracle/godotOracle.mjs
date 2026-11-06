/**
 * Runs an oracle script headless in Godot, in the one empty project that every font oracle shares,
 * and parses the JSON the script prints. Godot must be on the path.
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_DIR = dirname(fileURLToPath(import.meta.url));

/** The prefix that marks the result line: Godot prints its banner and warnings on stdout too. */
const RESULT_PREFIX = 'JSON:';

/**
 * The value that `script` prints after `JSON:` when Godot runs it with `args` as user arguments.
 * `script` is a path to a `.gd` file that extends SceneTree.
 *
 * @canonical A script that runs a Godot font oracle
 */
export function runGodotOracle(script, args) {
  const output = execFileSync(
    'godot',
    ['--headless', '--path', PROJECT_DIR, '--script', resolve(script), '--', ...args],
    { encoding: 'utf8' }
  );
  return parseOracleOutput(output, script);
}

/** The JSON on the first line of `output` that starts with `JSON:`. */
function parseOracleOutput(output, script) {
  const line = output.split('\n').find((candidate) => candidate.startsWith(RESULT_PREFIX));
  if (line === undefined) throw new Error(`expected a ${RESULT_PREFIX} line from ${script}, got:\n${output}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}
