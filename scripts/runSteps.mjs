/**
 * Runs build steps in order with one environment, and exits with the first failing step's
 * status. `build-deploy.mjs` and `build-pages.mjs` build the two site editions with it.
 */
import { spawnSync } from 'node:child_process';

/**
 * @param {string} tag - the log prefix, such as `build:pages`.
 * @param {[string, string[]][]} steps - each a command and its arguments.
 * @param {NodeJS.ProcessEnv} env - set here, not as a shell prefix on the npm script:
 *   `cmd.exe` cannot parse `FOO=1 cmd`.
 */
export function runSteps(tag, steps, env) {
  for (const [command, args] of steps) {
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      console.error(`[${tag}] "${command} ${args.join(' ')}" failed with ${result.status}`);
      process.exit(result.status ?? 1);
    }
  }
}
