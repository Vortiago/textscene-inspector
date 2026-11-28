import { describe, expect, it } from 'vitest';
import { formatMissingResources, missingResourcePaths } from './missingResources';
import type { ResRoot } from '@textscene/core/resources/resRoots';
import { createWorkspaceResRoots } from '../resRoots/workspaceResRoots';
import { createMockUri, vscode as vscodeMocks } from '../test-setup';

const SCENE = [
  '[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="1"]',
  '[ext_resource type="Texture2D" path="res://missing.png" id="2"]',
  '[node name="R" type="Node"]',
].join('\n');

async function rootFinding(files: readonly string[]): Promise<ResRoot> {
  vscodeMocks.workspace.getWorkspaceFolder.mockReturnValue({ uri: createMockUri('/game') });
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: { fsPath: string }) =>
    files.includes(uri.fsPath.replace(/\\/g, '/'))
      ? Promise.resolve({ type: 1, size: 1, ctime: 0, mtime: 0 })
      : Promise.reject(new Error('Not found'))
  );
  const roots = createWorkspaceResRoots();
  try {
    return (await roots.rootOf(createMockUri('/game/scene.tscn')))!.root;
  } finally {
    roots.dispose();
  }
}

describe('missingResourcePaths', () => {
  it('names the res:// paths no file answers', async () => {
    expect(await missingResourcePaths(await rootFinding(['/game/scenes/Door.tscn']), SCENE)).toEqual([
      'res://missing.png',
    ]);
  });

  it('returns nothing when every referenced file is present', async () => {
    const root = await rootFinding(['/game/scenes/Door.tscn', '/game/missing.png']);
    expect(await missingResourcePaths(root, SCENE)).toEqual([]);
  });

  it('returns nothing with no root, outside every workspace folder', async () => {
    expect(await missingResourcePaths(null, SCENE)).toEqual([]);
  });
});

describe('formatMissingResources', () => {
  it('says so when all resources are present', () => {
    expect(formatMissingResources('Main.tscn', [])).toBe('Main.tscn: every referenced resource is present.');
  });

  it('lists each missing path', () => {
    expect(formatMissingResources('Main.tscn', ['res://a.png', 'res://b.png'])).toBe(
      'Main.tscn: 2 missing resource(s):\n  res://a.png\n  res://b.png'
    );
  });
});
