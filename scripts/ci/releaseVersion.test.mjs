/** Which tags release which package, and what each release's notes compare against. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { RELEASE_PACKAGES, checkReleaseTag, previousReleaseTag } from './releaseVersion.mjs';

const versions = (byPath) => (manifestPath) => byPath[manifestPath];

describe('checkReleaseTag', () => {
  it('releases the extension alone on a vscode tag, whatever the linter version is', () => {
    const readVersion = versions({
      'apps/textscene-vscode/package.json': '1.3.0',
      'apps/textscene-linter/package.json': '0.9.0',
    });

    expect(checkReleaseTag('vscode-v1.3.0', readVersion)).toEqual({
      package: 'vscode',
      version: '1.3.0',
    });
  });

  it('releases the linter alone on a linter tag', () => {
    const readVersion = versions({ 'apps/textscene-linter/package.json': '0.10.0' });

    expect(checkReleaseTag('linter-v0.10.0', readVersion)).toEqual({
      package: 'linter',
      version: '0.10.0',
    });
  });

  it('names the manifest when its version differs from the tag', () => {
    const readVersion = versions({ 'apps/textscene-linter/package.json': '0.9.0' });

    expect(checkReleaseTag('linter-v0.10.0', readVersion)).toEqual({
      error: 'apps/textscene-linter/package.json has version 0.9.0, the tag says 0.10.0',
    });
  });

  it('refuses a pre-release tag, which the VS Marketplace cannot take', () => {
    expect(checkReleaseTag('vscode-v1.3.0-rc.1', versions({}))).toEqual({
      error: 'expected a tag like vscode-v1.2.3 or linter-v1.2.3, got "vscode-v1.3.0-rc.1"',
    });
  });

  it('refuses a tag that names no package', () => {
    expect(checkReleaseTag('v1.3.0', versions({}))).toHaveProperty('error');
  });

  it('refuses a prefix that is not a released package', () => {
    expect(checkReleaseTag('web-v1.3.0', versions({}))).toEqual({
      error: 'expected a tag prefix out of vscode, linter, got "web"',
    });
  });
});

describe('previousReleaseTag', () => {
  it('picks the highest earlier tag of the same package, ignoring the other package', () => {
    const tags = ['vscode-v1.2.0', 'vscode-v1.10.0', 'linter-v1.10.5', 'vscode-v1.9.1'];

    expect(previousReleaseTag('vscode-v1.11.0', tags)).toBe('vscode-v1.10.0');
  });

  it('ignores the tag itself and any later tag', () => {
    const tags = ['linter-v0.9.0', 'linter-v0.10.0', 'linter-v0.11.0'];

    expect(previousReleaseTag('linter-v0.10.0', tags)).toBe('linter-v0.9.0');
  });

  it('returns an empty string for a package first release', () => {
    expect(previousReleaseTag('linter-v0.9.0', ['vscode-v1.0.0', 'v0.8.0'])).toBe('');
  });
});

describe('RELEASE_PACKAGES', () => {
  it.each(Object.values(RELEASE_PACKAGES))('%s exists and is publishable', (manifestPath) => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, manifestPath), 'utf8'));

    expect(manifest.private).not.toBe(true);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
