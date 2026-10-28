import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
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

  it('finds the packages the globs of pnpm-workspace.yaml name', () => {
    const { packages: globs } = parse(readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8'));
    const named = globs.flatMap((glob) => {
      expect(glob).toMatch(/^[^*]+\/\*$/);
      const folder = join(REPO_ROOT, glob.slice(0, -2));
      return readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(folder, entry.name))
        .filter((dir) => existsSync(join(dir, 'package.json')));
    });
    expect(workspacePackages().sort()).toEqual(named.sort());
  });
});
