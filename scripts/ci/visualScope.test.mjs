/** Which pull requests skip the golden-image run. */
import { describe, expect, it } from 'vitest';
import { needsVisualRun } from './visualScope.mjs';

describe('needsVisualRun', () => {
  it('skips a change to prose, tests, linter rules and the other apps only', () => {
    expect(
      needsVisualRun([
        'README.md',
        'docs/adr/0001-x.md',
        'apps/textscene-web/src/r3f-main.dev-site.test.tsx',
        'packages/textscene-core/src/linter/index.ts',
        'packages/textscene-core/src/nodes/3d/meshinstance3d/linter.ts',
        'packages/textscene-core/src/nodes/3d/meshinstance3d/linterParser.ts',
        'packages/textscene-core/src/nodes/3d/meshinstance3d/index.linter.ts',
        'apps/textscene-vscode/src/extension.ts',
        'apps/textscene-linter/src/cli.ts',
        '.github/workflows/pages.yml',
        'scripts/compare-docs/build-gallery.mjs',
      ])
    ).toBe(false);
  });

  it('runs for a node slice that renders', () => {
    expect(
      needsVisualRun(['packages/textscene-core/src/nodes/3d/meshinstance3d/Component.tsx'])
    ).toBe(true);
  });

  it('runs for the shared renderer, the web app and the lockfile', () => {
    expect(needsVisualRun(['packages/textscene-core/src/r3f/TscnCanvas.tsx'])).toBe(true);
    expect(needsVisualRun(['apps/textscene-web/src/r3f-main.tsx'])).toBe(true);
    expect(needsVisualRun(['pnpm-lock.yaml'])).toBe(true);
  });

  it('runs for a scene fixture and for a script the harness imports', () => {
    expect(needsVisualRun(['scenes/fixtures/unit-plane-mesh.tscn'])).toBe(true);
    expect(needsVisualRun(['scripts/godot-ref/run.mjs'])).toBe(true);
    expect(needsVisualRun(['scripts/corpusRoots.mjs'])).toBe(true);
  });

  it('runs for a change to ci.yml, which defines the run itself', () => {
    expect(needsVisualRun(['.github/workflows/ci.yml'])).toBe(true);
  });

  it('runs when one file of many renders', () => {
    expect(needsVisualRun(['README.md', 'packages/textscene-core/src/r3f/TscnCanvas.tsx'])).toBe(
      true
    );
  });

  it('runs for an empty diff', () => {
    expect(needsVisualRun([])).toBe(true);
  });
});
