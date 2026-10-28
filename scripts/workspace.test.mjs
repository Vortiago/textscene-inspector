import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './repoRoot.mjs';
import { workspacePackages } from './workspace.mjs';

describe('workspacePackages', () => {
  it('lists a package under packages/ and an app under apps/, as absolute directories', () => {
    expect(workspacePackages()).toEqual(
      expect.arrayContaining([
        join(REPO_ROOT, 'packages', 'textscene-core'),
        join(REPO_ROOT, 'apps', 'textscene-web'),
      ])
    );
  });

  it('lists no folder outside the two workspace globs', () => {
    expect(workspacePackages()).not.toContain(join(REPO_ROOT, 'scripts'));
  });
});
