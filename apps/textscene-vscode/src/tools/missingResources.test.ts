import { describe, expect, it, vi } from 'vitest';
import { formatMissingResources, missingResourcePaths } from './missingResources';
import { createMockUri, vscode as vscodeMocks } from '../test-setup';

const SCENE = [
  '[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="1"]',
  '[ext_resource type="Texture2D" path="res://missing.png" id="2"]',
  '[node name="R" type="Node"]',
].join('\n');

function arrangeProject(): void {
  (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
    uri: createMockUri('/game'),
  });
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: { fsPath: string }) => {
    const path = uri.fsPath.replace(/\\/g, '/');
    if (path === '/game/project.godot' || path === '/game/scenes/Door.tscn') {
      return Promise.resolve({ type: 1, size: 1, ctime: 0, mtime: 0 });
    }
    return Promise.reject(new Error('Not found'));
  });
}

describe('missingResourcePaths', () => {
  it('names the res:// paths no file answers', async () => {
    arrangeProject();
    expect(await missingResourcePaths(createMockUri('/game/scenes/Main.tscn'), SCENE)).toEqual([
      'res://missing.png',
    ]);
  });

  it('returns nothing when every referenced file is present', async () => {
    arrangeProject();
    const text =
      '[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="1"]\n[node name="R" type="Node"]';
    expect(await missingResourcePaths(createMockUri('/game/scenes/Main.tscn'), text)).toEqual([]);
  });

  it('returns nothing outside a workspace folder', async () => {
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(await missingResourcePaths(createMockUri('/elsewhere/Main.tscn'), SCENE)).toEqual([]);
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
