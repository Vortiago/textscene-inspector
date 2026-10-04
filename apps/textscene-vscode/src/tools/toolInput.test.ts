import { describe, expect, it } from 'vitest';
import { createMockFileData, createMockUri, vscode as vscodeMocks } from '../test-setup';
import { readSceneText, resolveToolUri } from './toolInput';

describe('resolveToolUri', () => {
  it('joins a relative path onto the first workspace folder', () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    expect(resolveToolUri('scenes/Main.tscn')?.path).toBe('/game/scenes/Main.tscn');
  });

  it('uses an absolute path as it is', () => {
    vscodeMocks.workspace.workspaceFolders = [];
    expect(resolveToolUri('/tmp/Main.tscn')?.path).toBe('/tmp/Main.tscn');
  });

  it('returns nothing for a relative path with no workspace folder', () => {
    vscodeMocks.workspace.workspaceFolders = [];
    expect(resolveToolUri('scenes/Main.tscn')).toBeUndefined();
  });
});

describe('readSceneText', () => {
  it('decodes the file bytes as text', async () => {
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(createMockFileData('[node name="R" type="Node"]'));
    expect(await readSceneText(createMockUri('/game/Main.tscn'))).toContain('name="R"');
  });

  it('rejects when the file cannot be read', async () => {
    vscodeMocks.workspace.fs.readFile.mockRejectedValue(new Error('Not found'));
    await expect(readSceneText(createMockUri('/game/Missing.tscn'))).rejects.toThrow('Not found');
  });
});
