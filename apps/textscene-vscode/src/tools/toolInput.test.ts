import { beforeEach, describe, expect, it } from 'vitest';
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
  beforeEach(() => {
    vscodeMocks.workspace.textDocuments = [];
  });

  it('reads the editor text of an open document, its unsaved edits included', async () => {
    vscodeMocks.workspace.textDocuments = [
      { uri: createMockUri('/game/Main.tscn'), getText: () => '[node name="Edited" type="Node"]' },
    ];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Saved" type="Node"]')
    );

    expect(await readSceneText(createMockUri('/game/Main.tscn'))).toContain('name="Edited"');
  });

  it('reads the disk for a scene no editor holds, though another document is open', async () => {
    vscodeMocks.workspace.textDocuments = [
      { uri: createMockUri('/game/Other.tscn'), getText: () => '[node name="Other" type="Node"]' },
    ];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Saved" type="Node"]')
    );

    expect(await readSceneText(createMockUri('/game/Main.tscn'))).toContain('name="Saved"');
  });

  it('decodes the file bytes as text', async () => {
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(createMockFileData('[node name="R" type="Node"]'));
    expect(await readSceneText(createMockUri('/game/Main.tscn'))).toContain('name="R"');
  });

  it('rejects when the file cannot be read', async () => {
    vscodeMocks.workspace.fs.readFile.mockRejectedValue(new Error('Not found'));
    await expect(readSceneText(createMockUri('/game/Missing.tscn'))).rejects.toThrow('Not found');
  });
});
