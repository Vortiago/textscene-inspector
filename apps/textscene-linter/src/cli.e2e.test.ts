/** End-to-end tests: build the CLI bundle, spawn it, and verify the bundle stays lean. */

import { execSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
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

const CLEAN_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

// A CollisionShape2D with no shape trips a warning-severity diagnostic and
// nothing of error severity - mirrors lint.test.ts's WARNING_TSCN.
const WARNING_TSCN = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Body" type="StaticBody2D" parent="."]

[node name="Shape" type="CollisionShape2D" parent="Body"]
`;

// A CSGMesh3D with no mesh trips an info-severity diagnostic and nothing else.
const INFO_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Shape" type="CSGMesh3D" parent="."]
`;

let tempDir: string;
let badPath: string;
let warningPath: string;
let infoPath: string;
let scenesDir: string;
let nestedCleanPath: string;
let nestedBadPath: string;

/**
 * Spawns the built CLI with GITHUB_ACTIONS off: CI sets it, and spawnSync inherits
 * process.env, which flips every test to the `github` format. The isolation lives
 * in the default value, since stripping it in the body reads it back off
 * `process.env`. A test of auto-detection passes its own `env`.
 */
function runCli(args: string[], env: typeof process.env = { ...process.env, GITHUB_ACTIONS: '' }) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf-8', env });
}

beforeAll(() => {
  // Build the real bundle the same way CI and lint-staged consume it.
  execSync('pnpm --filter @textscene/linter build', { cwd: repoRoot, stdio: 'pipe' });

  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lint-e2e-'));
  badPath = join(tempDir, 'broken.tscn');
  writeFileSync(badPath, BAD_TSCN);
  warningPath = join(tempDir, 'warning.tscn');
  writeFileSync(warningPath, WARNING_TSCN);
  infoPath = join(tempDir, 'info.tscn');
  writeFileSync(infoPath, INFO_TSCN);

  scenesDir = join(tempDir, 'scenes');
  const nestedDir = join(scenesDir, 'nested');
  mkdirSync(nestedDir, { recursive: true });
  nestedCleanPath = join(scenesDir, 'clean.tscn');
  nestedBadPath = join(nestedDir, 'broken.tscn');
  writeFileSync(nestedCleanPath, CLEAN_TSCN);
  writeFileSync(nestedBadPath, BAD_TSCN);
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

  it('recurses into a directory argument and lints every nested .tscn file', () => {
    const result = runCli(['--no-color', scenesDir]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(nestedCleanPath);
    expect(result.stdout).toContain(nestedBadPath);
    expect(result.stdout).toContain('(strict-parser)');
  });

  it('emits ANSI colors by default', () => {
    const result = runCli([cleanFixture]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('\x1b[32m'); // Green success line
  });
});

describe('CLI --format output modes', () => {
  it('--format json prints a parseable array of findings and exits 1 on errors', () => {
    const result = runCli(['--format', 'json', cleanFixture, badPath]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');

    const findings = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(Array.isArray(findings)).toBe(true);
    const badFinding = findings.find((f) => f.file === badPath);
    expect(badFinding).toMatchObject({
      file: badPath,
      severity: 'error',
      rule: 'strict-parser',
    });
    expect(typeof badFinding?.line).toBe('number');
    // The clean fixture contributes no findings at all.
    expect(findings.some((f) => f.file === cleanFixture)).toBe(false);
  });

  it('--format json exits 0 for warnings-only input, listing the warning finding', () => {
    const result = runCli(['--format', 'json', warningPath]);

    expect(result.status).toBe(0);
    const findings = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(findings).toContainEqual(expect.objectContaining({ file: warningPath, severity: 'warning' }));
  });

  it('--format json reports an unreadable file as a file-read-error finding and exits 1', () => {
    const missing = join(tempDir, 'nope-json.tscn');
    const result = runCli(['--format', 'json', missing]);

    expect(result.status).toBe(1);
    const findings = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(findings).toEqual([
      expect.objectContaining({ file: missing, rule: 'file-read-error', severity: 'error' }),
    ]);
  });

  it('--format github prints ::error/::warning/::notice workflow-command annotations', () => {
    const result = runCli(['--format', 'github', badPath, warningPath, infoPath]);

    expect(result.status).toBe(1);
    const lines = result.stdout.trim().split('\n');
    expect(lines.some((l) => l.startsWith('::error file=') && l.includes(badPath))).toBe(true);
    expect(lines.some((l) => l.startsWith('::warning file=') && l.includes(warningPath))).toBe(true);
    expect(lines.some((l) => l.startsWith('::notice file=') && l.includes(infoPath))).toBe(true);
  });

  it('--format json exits 0 for info-only input, listing the info finding', () => {
    const result = runCli(['--format', 'json', infoPath]);

    expect(result.status).toBe(0);
    const findings = JSON.parse(result.stdout) as Array<{ file: string; severity: string; rule: string }>;
    expect(findings).toContainEqual(expect.objectContaining({ file: infoPath, severity: 'info', rule: 'csgmesh3d-requires-mesh' }));
  });

  it('rejects an unknown --format value with a non-zero, non-1 exit code and no partial output', () => {
    const result = runCli(['--format', 'bogus', cleanFixture]);

    expect(result.status).not.toBe(0);
    expect(result.status).not.toBe(1);
    expect(result.stderr.toLowerCase()).toContain('format');
    expect(result.stdout).toBe('');
  });

  it("runCli's default env isolation holds even when the *ambient* process.env already has GITHUB_ACTIONS=true (pins against the isolation living in the wrong place)", () => {
    const previous = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = 'true';
    try {
      const result = runCli(['--no-color', badPath]); // no explicit env override
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('(strict-parser)');
      expect(result.stdout).not.toContain('::error');
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = previous;
      }
    }
  });

  it('auto-detects github format from GITHUB_ACTIONS=true when --format is not passed', () => {
    const result = runCli(['--no-color', badPath], { ...process.env, GITHUB_ACTIONS: 'true' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error file=');
    expect(result.stdout).not.toContain('✖'); // not the text formatter's icon
  });

  it('an explicit --format text overrides GITHUB_ACTIONS auto-detection', () => {
    const result = runCli(['--no-color', '--format', 'text', badPath], { ...process.env, GITHUB_ACTIONS: 'true' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('(strict-parser)');
    expect(result.stdout).not.toContain('::error');
  });
});

describe('CLI bundle purity', () => {
  // Structural markers, since plain 'three' or 'react' false-positive on prose. A
  // bundled three.js holds 'THREE.'-prefixed warnings ("THREE.WebGLRenderer:"), and
  // React holds its Symbol.for("react. registrations and react-dom module ids.
  // A size check backs them up: three.js alone adds over 1 MB unminified.
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

  it('stays under the size backstop', () => {
    // A backstop for a leak the markers miss, not a budget for the linter's growth:
    // three.js or react-dom adds more than the whole bundle. Raise it for honest
    // growth, never to admit a dependency the markers failed on.
    expect(statSync(cliPath).size).toBeLessThan(1_400_000);
  });
});
