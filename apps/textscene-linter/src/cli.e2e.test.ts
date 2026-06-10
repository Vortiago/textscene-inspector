/** End-to-end tests: build the CLI bundle, spawn it, and verify the bundle stays lean. */

import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const cliPath = join(packageDir, 'dist', 'cli.js');
const cleanFixture = join(repoRoot, 'scenes', 'fixtures', 'unit-box-mesh.tscn');

const BAD_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(invalid, values, here)
`;

let tempDir: string;
let badPath: string;

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf-8' });
}

beforeAll(() => {
  // Build the real bundle the same way CI and lint-staged consume it.
  execSync('pnpm --filter @textscene/linter build', { cwd: repoRoot, stdio: 'pipe' });

  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lint-e2e-'));
  badPath = join(tempDir, 'broken.tscn');
  writeFileSync(badPath, BAD_TSCN);
}, 120_000);

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('CLI end-to-end', () => {
  it('reports the package.json version for --version (no hardcoded literal)', () => {
    const pkg = JSON.parse(
      readFileSync(join(packageDir, 'package.json'), 'utf-8')
    ) as { version: string };
    const result = runCli(['--version']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('exits 0 and prints a checkmark for a known-clean fixture', () => {
    const result = runCli(['--no-color', cleanFixture]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain('unit-box-mesh.tscn');
    expect(result.stderr).toBe('');
  });

  it('exits 1 and reports the error for a syntactically invalid file', () => {
    const result = runCli(['--no-color', badPath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(badPath);
    expect(result.stdout).toContain('error');
    expect(result.stdout).toContain('(strict-parser)');
  });

  it('exits 1 and names the path on stderr for a missing file', () => {
    const missing = join(tempDir, 'nope.tscn');
    const result = runCli(['--no-color', missing]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Failed to lint ${missing}:`);
    expect(result.stderr).toContain('ENOENT');
  });

  it('lints multiple files in one run, combining exit codes', () => {
    const result = runCli(['--no-color', cleanFixture, badPath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('✓');
    expect(result.stdout).toContain('(strict-parser)');
  });

  it('emits ANSI colors by default', () => {
    const result = runCli([cleanFixture]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('\x1b[32m'); // Green success line
  });
});

describe('CLI bundle purity', () => {
  // Marker choice: a bundled three.js always contains 'THREE.'-prefixed
  // console warnings (e.g. "THREE.WebGLRenderer:"), and a bundled React
  // runtime always contains its Symbol.for("react. element registrations
  // and react-dom module ids. Plain substrings like 'three' or 'react'
  // would false-positive on ordinary prose, so we use these structural
  // markers plus a 1 MB size backstop (the lean bundle is ~230 KB; pulling
  // in three.js alone adds well over 1 MB unminified).
  it('contains no three.js or React markers', () => {
    const bundle = readFileSync(cliPath, 'utf-8');

    expect(bundle).not.toContain('THREE.');
    expect(bundle).not.toContain('react.createElement');
    expect(bundle).not.toContain('Symbol.for("react.');
    expect(bundle).not.toContain("Symbol.for('react.");
    expect(bundle).not.toContain('from "react"');
    expect(bundle).not.toContain('react-dom');
  });

  it('actually contains linter code (sanity check that we scanned the real bundle)', () => {
    const bundle = readFileSync(cliPath, 'utf-8');

    expect(bundle).toContain('strict-parser');
    expect(bundle).toContain('tscn-lint');
  });

  it('stays under the 1 MB size backstop', () => {
    expect(statSync(cliPath).size).toBeLessThan(1024 * 1024);
  });
});
