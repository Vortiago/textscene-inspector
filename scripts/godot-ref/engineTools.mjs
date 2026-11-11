/**
 * The tools a render through real Godot starts. Not every host has both, so the tests that render
 * are a command of their own (`pnpm test:godot-ref`). The pre-push hook runs it only where both
 * exist, and the CI job `godot-ref` installs them.
 */

import { spawnSync } from 'node:child_process';

/** A test file that renders through real Godot. No project of the unit run includes one. */
export const ENGINE_TEST_FILE = /\.engine\.test\.mjs$/;

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
