/** Which pull requests skip the real-Godot tests. */
import { describe, expect, it } from 'vitest';
import { needsGodotRefRun } from './godotRefScope.mjs';

const isEngineTestInput = (path) => path === 'scripts/godot-ref/run.mjs';
const needsRun = (paths) => needsGodotRefRun(paths, isEngineTestInput);

describe('needsGodotRefRun', () => {
  it('runs for a file the real-Godot tests read', () => {
    expect(needsRun(['README.md', 'scripts/godot-ref/run.mjs'])).toBe(true);
  });

  it('runs for a file that defines the run or what it installs', () => {
    for (const path of ['.github/workflows/ci.yml', '.github/actions/setup/action.yml', 'pnpm-lock.yaml']) {
      expect(needsRun([path])).toBe(true);
    }
  });

  it('skips a change that reaches neither', () => {
    expect(needsRun(['packages/textscene-core/src/r3f/TscnCanvas.tsx', '.github/workflows/pages.yml'])).toBe(
      false
    );
  });

  it('runs for an empty diff, which is more likely a broken checkout (edge case)', () => {
    expect(needsRun([])).toBe(true);
  });
});
