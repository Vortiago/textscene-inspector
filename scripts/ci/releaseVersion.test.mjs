/** Which tags release which package, at which version, and against which earlier tag. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { RELEASE_INPUTS, RELEASE_PACKAGES, checkReleaseTag } from './releaseVersion.mjs';

describe('checkReleaseTag', () => {
  it('releases the extension alone on a vscode tag, at the tag version', () => {
    expect(checkReleaseTag('vscode-v1.3.0', [])).toEqual({
      package: 'vscode',
      directory: 'apps/textscene-vscode',
      version: '1.3.0',
      previousTag: '',
    });
  });

  it('releases the linter alone on a linter tag', () => {
    expect(checkReleaseTag('linter-v1.0.1', ['linter-v1.0.0'])).toMatchObject({
      package: 'linter',
      directory: 'apps/textscene-linter',
      version: '1.0.1',
    });
  });

  it('releases the language server alone on an lsp tag', () => {
    expect(checkReleaseTag('lsp-v1.0.0', ['linter-v1.0.0'])).toEqual({
      package: 'lsp',
      directory: 'apps/textscene-lsp',
      version: '1.0.0',
      previousTag: '',
    });
  });

  it('compares against the highest earlier tag of the same package, ignoring the other', () => {
    const tags = ['vscode-v1.2.0', 'vscode-v1.10.0', 'linter-v1.10.5', 'vscode-v1.9.1'];

    expect(checkReleaseTag('vscode-v1.11.0', tags)).toHaveProperty('previousTag', 'vscode-v1.10.0');
  });

  it('ignores the tag itself among the existing tags', () => {
    const tags = ['linter-v1.0.0', 'linter-v1.0.1'];

    expect(checkReleaseTag('linter-v1.0.1', tags)).toHaveProperty('previousTag', 'linter-v1.0.0');
  });

  it('has no previous tag on a package first release, whatever the other package has', () => {
    expect(checkReleaseTag('linter-v1.0.0', ['vscode-v1.0.0'])).toHaveProperty('previousTag', '');
  });

  it('refuses a version below the newest tag of the same package', () => {
    expect(checkReleaseTag('vscode-v1.2.0', ['vscode-v1.10.0'])).toEqual({
      error: 'expected a version above the newest vscode tag vscode-v1.10.0, got vscode-v1.2.0',
    });
  });

  it('refuses a pre-release tag, which the VS Marketplace cannot take', () => {
    expect(checkReleaseTag('vscode-v1.3.0-rc.1', [])).toEqual({
      error: 'expected a tag like vscode-v1.2.3, linter-v1.2.3 or lsp-v1.2.3, got "vscode-v1.3.0-rc.1"',
    });
  });

  it('refuses a tag that names no package', () => {
    expect(checkReleaseTag('v1.3.0', [])).toHaveProperty('error');
  });

  it('refuses a prefix that is not a released package', () => {
    expect(checkReleaseTag('web-v1.3.0', [])).toEqual({
      error: 'expected a tag prefix out of vscode, linter, lsp, got "web"',
    });
  });
});

describe('RELEASE_PACKAGES', () => {
  it.each(Object.values(RELEASE_PACKAGES))('%s holds a package manifest', (directory) => {
    expect(existsSync(join(REPO_ROOT, directory, 'package.json'))).toBe(true);
  });
});

describe('RELEASE_INPUTS', () => {
  it('names the inputs of every released package', () => {
    expect(Object.keys(RELEASE_INPUTS)).toEqual(Object.keys(RELEASE_PACKAGES));
  });

  it.each(Object.values(RELEASE_INPUTS).flat())('%s holds a package manifest', (directory) => {
    expect(existsSync(join(REPO_ROOT, directory, 'package.json'))).toBe(true);
  });
});
