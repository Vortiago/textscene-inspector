/**
 * The fixture manifest is untracked, so every command that reads it must write it first. Each
 * entry point carries its own pre-step, and this test fails when one loses it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../vitest.config';
import { REPO_ROOT } from '../repoRoot.mjs';

const readScripts = (packageDir) =>
  JSON.parse(readFileSync(join(REPO_ROOT, packageDir, 'package.json'), 'utf8')).scripts;

describe('the fixture manifest entry points', () => {
  it('writes the manifest on install', () => {
    expect(readScripts('.').postinstall).toContain('generate-fixtures.js');
  });

  it('writes the manifest before each web app command that imports it', () => {
    const scripts = readScripts('apps/textscene-web');
    const withoutStep = ['dev', 'build', 'test', 'type-check', 'type-check:tests'].filter(
      (command) => !scripts[`pre${command}`]?.includes('generate-fixtures')
    );

    expect(withoutStep).toEqual([]);
  });

  it('writes the manifest before the root test run', () => {
    expect(config.test.globalSetup).toContain('scripts/generate-fixtures/vitestGlobalSetup.mjs');
  });
});
