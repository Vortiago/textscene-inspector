/** Which commits share a CI image, and which Playwright that image holds. */
import { describe, expect, it } from 'vitest';
import { ciImageRef, lockedPlaywrightVersion } from './ciImage.mjs';

/** A pnpm lockfile whose root package depends on `playwright` at `version`. */
const lockfile = (version) =>
  [
    "lockfileVersion: '9.0'",
    'importers:',
    '  .:',
    '    devDependencies:',
    '      pixelmatch:',
    "        specifier: 'catalog:'",
    '        version: 7.1.0',
    '      playwright:',
    '        specifier: ^1.64.1',
    `        version: ${version}`,
    '  apps/textscene-vscode:',
    '    devDependencies:',
    '      playwright:',
    '        specifier: ^1.61.0',
    '        version: 1.61.1',
  ].join('\n');

const DOCKERFILE = 'FROM ubuntu:24.04\n';

describe('lockedPlaywrightVersion', () => {
  it("reads the root package's Playwright, not another package's", () => {
    expect(lockedPlaywrightVersion(lockfile('1.64.1'))).toBe('1.64.1');
  });

  it('names the lockfile when the root package has no Playwright', () => {
    expect(() => lockedPlaywrightVersion("lockfileVersion: '9.0'\n")).toThrow(/pnpm-lock\.yaml/);
  });
});

describe('ciImageRef', () => {
  it('names an image of this repository on ghcr.io with a 16-digit hex tag', () => {
    expect(ciImageRef(DOCKERFILE, '1.64.1')).toMatch(
      /^ghcr\.io\/vortiago\/textscene-inspector\/ci:[0-9a-f]{16}$/
    );
  });

  it('gives two commits the same image when neither input differs', () => {
    expect(ciImageRef(DOCKERFILE, '1.64.1')).toBe(ciImageRef(DOCKERFILE, '1.64.1'));
  });

  it('gives a new image when the Dockerfile changes', () => {
    expect(ciImageRef(`${DOCKERFILE}RUN true\n`, '1.64.1')).not.toBe(ciImageRef(DOCKERFILE, '1.64.1'));
  });

  it('gives a new image when the locked Playwright changes', () => {
    expect(ciImageRef(DOCKERFILE, '1.65.0')).not.toBe(ciImageRef(DOCKERFILE, '1.64.1'));
  });
});
