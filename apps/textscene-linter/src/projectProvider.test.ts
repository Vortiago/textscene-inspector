/** The CLI's view of a scene's Godot project: the files under the nearest `project.godot`, read from disk. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectProviderFor } from './projectProvider';

let tempDir: string;
let projectDir: string;
let scenePath: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tscn-lint-project-'));
  projectDir = join(tempDir, 'game');
  mkdirSync(join(projectDir, 'scenes', 'deep'), { recursive: true });
  mkdirSync(join(projectDir, 'models'));
  writeFileSync(join(projectDir, 'project.godot'), 'config_version=5\n');
  writeFileSync(join(projectDir, 'models', 'tree.glb'), new Uint8Array([0x67, 0x6c, 0x54, 0x46]));
  writeFileSync(join(projectDir, 'scenes', 'level.tscn'), '[gd_scene format=3]\n');
  writeFileSync(join(tempDir, 'secret.txt'), 'outside the project');
  scenePath = join(projectDir, 'scenes', 'deep', 'level.tscn');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('projectProviderFor', () => {
  it('gives no provider for a scene with no project.godot above it', async () => {
    expect(await projectProviderFor(join(tempDir, 'loose', 'scene.tscn'))).toBeNull();
  });

  it('reads a res:// path under the nearest project.godot as bytes', async () => {
    const provider = await projectProviderFor(scenePath);
    const data = await provider!.loadResource('res://models/tree.glb', 'PackedScene');

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(data as ArrayBuffer)]).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('reads a text resource as a string', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://scenes/level.tscn', 'PackedScene')).toBe('[gd_scene format=3]\n');
  });

  it('gives null for a file the project does not hold', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://models/missing.glb', 'PackedScene')).toBeNull();
  });

  it('refuses a path that escapes the project root', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource('res://../secret.txt', 'TextFile')).toBeNull();
  });

  it('refuses a path that is not res://', async () => {
    const provider = await projectProviderFor(scenePath);
    expect(await provider!.loadResource(join(tempDir, 'secret.txt'), 'TextFile')).toBeNull();
  });
});
