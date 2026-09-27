/** Which release tags match the versions of the packages they publish. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { PUBLISHED_MANIFESTS, checkReleaseVersion } from './releaseVersion.mjs';

const manifestsAt = (...versions) =>
  versions.map((version, i) => ({ path: `apps/package-${i}/package.json`, version }));

describe('checkReleaseVersion', () => {
  it('returns the version when every manifest matches the tag', () => {
    expect(checkReleaseVersion('v1.2.3', manifestsAt('1.2.3', '1.2.3'))).toEqual({
      version: '1.2.3',
      errors: [],
    });
  });

  it('names each manifest whose version differs from the tag', () => {
    const { errors } = checkReleaseVersion('v1.2.3', manifestsAt('1.2.3', '1.2.2'));

    expect(errors).toEqual(['apps/package-1/package.json has version 1.2.2, the tag says 1.2.3']);
  });

  it('refuses a pre-release tag, which the VS Marketplace cannot take', () => {
    const { version, errors } = checkReleaseVersion('v1.2.3-rc.1', manifestsAt('1.2.3-rc.1'));

    expect(version).toBeNull();
    expect(errors).toEqual(['expected a tag like v1.2.3, got "v1.2.3-rc.1"']);
  });

  it('refuses a tag without the v prefix, and an empty tag', () => {
    expect(checkReleaseVersion('1.2.3', manifestsAt('1.2.3')).errors).toHaveLength(1);
    expect(checkReleaseVersion('', manifestsAt('1.2.3')).errors).toHaveLength(1);
  });
});

describe('PUBLISHED_MANIFESTS', () => {
  it.each(PUBLISHED_MANIFESTS)('%s exists and is publishable', (path) => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));

    expect(manifest.private).not.toBe(true);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
