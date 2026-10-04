import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerTscnTools, TOOL_IDS } from './registerTscnTools';
import { createMockFileData, createMockUri, vscode as vscodeMocks } from '../test-setup';

function context(): vscode.ExtensionContext {
  return { subscriptions: [] } as unknown as vscode.ExtensionContext;
}

const TOKEN = {} as vscode.CancellationToken;

function registeredTool(id: string): {
  invoke: (
    options: { input: unknown },
    token: vscode.CancellationToken
  ) => Promise<{ content: Array<{ value: string }> }>;
} {
  return vscodeMocks.lm.registerTool.mock.calls.find((call: unknown[]) => call[0] === id)![1];
}

describe('registerTscnTools', () => {
  beforeEach(() => {
    // `clearAllMocks` clears calls, not implementations, so a case that turns the
    // setting off would otherwise leak its answer into the next case.
    vscodeMocks.workspace.getConfiguration.mockReturnValue({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    });
  });

  it('registers the four tools when the API is present', () => {
    const ctx = context();
    registerTscnTools(ctx, { openPreview: vi.fn() });
    expect(vscodeMocks.lm.registerTool.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      TOOL_IDS.lint,
      TOOL_IDS.sceneTree,
      TOOL_IDS.openPreview,
      TOOL_IDS.missingResources,
    ]);
    expect(ctx.subscriptions).toHaveLength(4);
  });

  it('registers nothing when the user turned the tools off', () => {
    vscodeMocks.workspace.getConfiguration.mockReturnValue({ get: () => false });
    registerTscnTools(context(), { openPreview: vi.fn() });
    expect(vscodeMocks.lm.registerTool).not.toHaveBeenCalled();
  });

  it('registers nothing on a VS Code without the API', () => {
    const original = vscodeMocks.lm.registerTool;
    vscodeMocks.lm.registerTool = undefined;
    registerTscnTools(context(), { openPreview: vi.fn() });
    expect(original).not.toHaveBeenCalled();
    vscodeMocks.lm.registerTool = original;
  });

  it('the scene tree tool returns the parsed hierarchy', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Root" type="Node3D"]')
    );
    registerTscnTools(context(), { openPreview: vi.fn() });
    const result = await registeredTool(TOOL_IDS.sceneTree).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(result.content[0]!.value).toContain('Root (Node3D)');
  });

  it('the lint tool reports a clean scene with no project', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Root" type="Node3D"]')
    );
    registerTscnTools(context(), { openPreview: vi.fn() });
    const result = await registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'scenes/Main.tscn' } }, TOKEN);
    expect(result.content[0]!.value).toContain('no findings');
  });

  it('the missing-resources tool reports a scene outside a project', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[ext_resource type="PackedScene" path="res://door.tscn" id="1"]')
    );
    registerTscnTools(context(), { openPreview: vi.fn() });
    const result = await registeredTool(TOOL_IDS.missingResources).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(result.content[0]!.value).toContain('every referenced resource is present');
  });

  it('rejects a path that is not a .tscn scene', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    registerTscnTools(context(), { openPreview: vi.fn() });
    await expect(
      registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'notes.txt' } }, TOKEN)
    ).rejects.toThrow('Expected a .tscn scene');
  });
});
