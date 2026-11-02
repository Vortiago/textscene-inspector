/** The lockfile guard that fails on an install script outside the root allowlist. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allowedBuildPackages,
  depEntriesWithInstallScripts,
  entriesOutsideAllowlist,
  packageNameOf,
} from './checkDepScripts.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

const CLEAN_LOCKFILE = `lockfileVersion: '9.0'

packages:

  acorn@8.19.0:
    resolution: {integrity: sha512-TEST}

  fzstd@0.1.1:
    resolution: {integrity: sha512-TEST}
`;

const LOCKFILE_WITH_SCRIPTS = `lockfileVersion: '9.0'

packages:

  acorn@8.19.0:
    resolution: {integrity: sha512-TEST}

  brotli@2.1.0:
    resolution: {integrity: sha512-TEST}
    hasInstallScript: true

  '@textscene/renderer@0.2.0':
    resolution: {integrity: sha512-TEST}
    hasInstallScript: true
`;

const LOCKFILE_WITH_FALSE_FLAGS = `lockfileVersion: '9.0'

packages:

  acorn@8.19.0:
    resolution: {integrity: sha512-TEST}
    hasInstallScript: false
`;

const LOCKFILE_WITHOUT_PACKAGES = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      acorn:
        specifier: ^8.19.0
        version: 8.19.0
`;

describe('depEntriesWithInstallScripts', () => {
  it('returns nothing for a lockfile whose entries declare no install script', () => {
    expect(depEntriesWithInstallScripts(CLEAN_LOCKFILE)).toEqual([]);
  });

  it('returns each declaring entry under its lockfile id', () => {
    expect(depEntriesWithInstallScripts(LOCKFILE_WITH_SCRIPTS)).toEqual([
      'brotli@2.1.0',
      '@textscene/renderer@0.2.0',
    ]);
  });

  it('ignores `hasInstallScript: false` and a lockfile without a packages section', () => {
    expect(depEntriesWithInstallScripts(LOCKFILE_WITH_FALSE_FLAGS)).toEqual([]);
    expect(depEntriesWithInstallScripts(LOCKFILE_WITHOUT_PACKAGES)).toEqual([]);
  });

  it('(error path) fails on malformed yaml', () => {
    expect(() => depEntriesWithInstallScripts('packages:\n  brotli@2.1.0: [')).toThrow();
  });
});

describe('allowedBuildPackages', () => {
  it('reads the names `pnpm.onlyBuiltDependencies` permits', () => {
    expect(allowedBuildPackages('{"pnpm":{"onlyBuiltDependencies":["brotli"]}}')).toEqual(['brotli']);
  });

  it('returns the empty list that denies every dependency its script', () => {
    expect(allowedBuildPackages('{"pnpm":{"onlyBuiltDependencies":[]}}')).toEqual([]);
  });

  it('(error path) fails closed when the deny-all field is gone', () => {
    expect(() => allowedBuildPackages('{"name": "x"}')).toThrow(/pnpm\.onlyBuiltDependencies/);
    expect(() => allowedBuildPackages('{"pnpm":{}}')).toThrow(/pnpm\.onlyBuiltDependencies/);
  });

  it('(error path) fails closed when the field is not an array', () => {
    expect(() => allowedBuildPackages('{"pnpm":{"onlyBuiltDependencies":"brotli"}}')).toThrow(
      /pnpm\.onlyBuiltDependencies/
    );
  });

  it('(error path) fails on a malformed package.json', () => {
    expect(() => allowedBuildPackages('{')).toThrow();
  });
});

describe('entriesOutsideAllowlist', () => {
  it('keeps every entry when the allowlist is empty', () => {
    expect(entriesOutsideAllowlist(['brotli@2.1.0'], [])).toEqual(['brotli@2.1.0']);
  });

  it('drops the entries whose package is allowlisted', () => {
    expect(entriesOutsideAllowlist(['brotli@2.1.0', 'fzstd@0.1.1'], ['brotli'])).toEqual(['fzstd@0.1.1']);
  });

  it('matches a scoped package by its full name', () => {
    expect(entriesOutsideAllowlist(['@textscene/renderer@0.2.0'], ['@textscene/renderer'])).toEqual([]);
  });
});

describe('packageNameOf', () => {
  it('splits the version off a plain name', () => {
    expect(packageNameOf('brotli@2.1.0')).toBe('brotli');
  });

  it('keeps the scope of a scoped package', () => {
    expect(packageNameOf('@textscene/renderer@0.2.0')).toBe('@textscene/renderer');
  });

  it('splits a peer suffix off before the version', () => {
    expect(packageNameOf('react@19.3.1(react-dom@19.3.1)')).toBe('react');
  });

  it('keeps an id without a version whole', () => {
    expect(packageNameOf('file:packages/fixture')).toBe('file:packages/fixture');
  });
});

describe('the root package.json', () => {
  it('keeps `pnpm.onlyBuiltDependencies` present, the deny-all the guard reads', () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(Array.isArray(manifest.pnpm.onlyBuiltDependencies)).toBe(true);
  });
});
