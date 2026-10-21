/** Builds the @textscene/tscn bundle and checks what it exports and what it holds. */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const bundlePath = join(packageDir, 'dist', 'index.js');

/** The runtime exports of core's `./parser` and `./godot` entries. A new export is a decision to publish it. */
const PUBLIC_VALUE_EXPORTS = [
  'PROJECT_FILE_NAME',
  'PROJECT_FILE_PATH',
  'SCAN_STOP_FILES',
  'TscnParser',
  'importSidecarPath',
  'isGodotTextResourcePath',
  'isScannedPath',
];

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

let bundle: string;

beforeAll(() => {
  execSync('pnpm --filter @textscene/tscn build', { cwd: repoRoot, stdio: 'pipe' });
  bundle = readFileSync(bundlePath, 'utf8');
}, 120_000);

describe('@textscene/tscn bundle', () => {
  it('exports exactly the parser and engine-fact entries of core', async () => {
    const exported = await import(pathToFileURL(bundlePath).href);
    expect(Object.keys(exported).sort()).toEqual(PUBLIC_VALUE_EXPORTS);
  });

  it('imports nothing, so it needs no dependency and no resolver condition', () => {
    expect(bundle).not.toMatch(/^\s*(import|export)\b[^;]*\sfrom\s*['"]/m);
  });

  it('holds no React and no three.js module', () => {
    expect(bundle).not.toMatch(/Symbol\.for\(["']react\./);
    expect(bundle).not.toContain('__THREE__');
  });

  it('parses a scene', async () => {
    const { TscnParser } = await import(pathToFileURL(bundlePath).href);
    const scene = new TscnParser().parse(SCENE);
    expect(scene.nodes.map((node: { name: string }) => node.name)).toEqual(['Root']);
  });
});
