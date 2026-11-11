/**
 * The tools a render through real Godot starts. CI has neither, so the tests that render are a
 * command of their own (`pnpm test:godot-ref`), and the pre-push hook runs it only where both exist.
 */

import { spawnSync } from 'node:child_process';

const ENGINE_TOOLS = ['godot', 'xvfb-run'];

const isOnPath = (tool) => spawnSync('which', [tool]).status === 0;

/** The engine tools that `onPath` does not find, in the order the harness starts them. */
export function missingEngineTools(onPath = isOnPath) {
  return ENGINE_TOOLS.filter((tool) => !onPath(tool));
}

/** Whether this host can render through real Godot. */
export const hasEngine = () => missingEngineTools().length === 0;

/** What the engine tests say on a host that lacks the tools in `missing`, where they fail. */
export function engineMissingMessage(missing) {
  return (
    `pnpm test:godot-ref renders through real Godot. Expected ${ENGINE_TOOLS.join(' and ')} on the PATH, ` +
    `found no ${missing.join(' and no ')}.`
  );
}
