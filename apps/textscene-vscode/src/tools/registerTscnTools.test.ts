import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { TscnToolHost } from './registerTscnTools';
import { registerTscnTools, TOOL_IDS } from './registerTscnTools';
import {
  createMockFileData,
  createMockUri,
  MockLanguageModelDataPart,
  vscode as vscodeMocks,
} from '../test-setup';

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as {
  contributes: { languageModelTools: { when?: string }[] };
};

function context(): vscode.ExtensionContext {
  return { subscriptions: [] } as unknown as vscode.ExtensionContext;
}

/** A host whose capture answers no image unless a case overrides it. */
function host(overrides: Partial<TscnToolHost> = {}): TscnToolHost {
  return {
    openPreview: vi.fn(),
    capturePreview: vi.fn().mockResolvedValue({ error: 'not ready' }),
    lintProviderFor: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const TOKEN = {} as vscode.CancellationToken;

function registeredTool(id: string): any {
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

  it('registers the five tools when the API is present', () => {
    const ctx = context();
    registerTscnTools(ctx, host());
    expect(vscodeMocks.lm.registerTool.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      TOOL_IDS.lint,
      TOOL_IDS.sceneTree,
      TOOL_IDS.openPreview,
      TOOL_IDS.missingResources,
      TOOL_IDS.capture,
    ]);
    expect(ctx.subscriptions).toHaveLength(5);
  });

  it('registers no capture tool on a VS Code without the image part', () => {
    // The module mock and this export share the one class, so its static method is the
    // same object `registerTscnTools` sees.
    const image = MockLanguageModelDataPart.image;
    (MockLanguageModelDataPart as { image?: unknown }).image = undefined;
    registerTscnTools(context(), host());
    const ids = vscodeMocks.lm.registerTool.mock.calls.map((call: unknown[]) => call[0]);
    expect(ids).not.toContain(TOOL_IDS.capture);
    (MockLanguageModelDataPart as { image?: unknown }).image = image;
  });

  it('refuses a call while the user has the tools off, so the setting applies with no reload', async () => {
    registerTscnTools(context(), host());
    vscodeMocks.workspace.getConfiguration.mockReturnValue({ get: () => false });
    await expect(
      registeredTool(TOOL_IDS.sceneTree).invoke({ input: { path: 'scenes/Main.tscn' } }, TOKEN)
    ).rejects.toThrow('textscene.agentTools.enabled');
  });

  it('hides every contributed tool behind the setting', () => {
    const tools = manifest.contributes.languageModelTools;
    expect(tools.map((tool) => tool.when)).toEqual(tools.map(() => 'config.textscene.agentTools.enabled'));
  });

  it('registers nothing on a VS Code without the API', () => {
    const original = vscodeMocks.lm.registerTool;
    vscodeMocks.lm.registerTool = undefined;
    registerTscnTools(context(), host());
    expect(original).not.toHaveBeenCalled();
    vscodeMocks.lm.registerTool = original;
  });

  it('the scene tree tool returns the parsed hierarchy', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Root" type="Node3D"]')
    );
    registerTscnTools(context(), host());
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
    registerTscnTools(context(), host());
    const result = await registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'scenes/Main.tscn' } }, TOKEN);
    expect(result.content[0]!.value).toContain('no findings');
  });

  it("the lint tool lints over the Problems panel's provider for the scene", async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Root" type="Node3D"]')
    );
    const lintProviderFor = vi.fn().mockResolvedValue(null);
    registerTscnTools(context(), host({ lintProviderFor }));
    await registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'scenes/Main.tscn' } }, TOKEN);
    expect(lintProviderFor).toHaveBeenCalledTimes(1);
    expect(lintProviderFor.mock.calls[0]![0].path).toMatch(/\/game\/scenes\/Main\.tscn$/);
  });

  it('the missing-resources tool reports a scene outside a project', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[ext_resource type="PackedScene" path="res://door.tscn" id="1"]')
    );
    registerTscnTools(context(), host());
    const result = await registeredTool(TOOL_IDS.missingResources).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(result.content[0]!.value).toContain('every referenced resource is present');
  });

  it('the capture tool returns the PNG as an image part', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const capturePreview = vi
      .fn()
      .mockResolvedValue({ dataUrl: `data:image/png;base64,${png.toString('base64')}` });
    registerTscnTools(context(), host({ capturePreview }));
    const result = await registeredTool(TOOL_IDS.capture).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );

    expect(capturePreview).toHaveBeenCalled();
    const image = result.content[1] as { mimeType: string; data: Uint8Array };
    expect(image.mimeType).toBe('image/png');
    expect([...image.data]).toEqual([...png]);
  });

  it('the capture tool says so, with the reason, when the preview answers no image', async () => {
    registerTscnTools(
      context(),
      host({
        capturePreview: vi
          .fn()
          .mockResolvedValue({ error: 'The preview shows the 2D view, and only the 3D view can capture.' }),
      })
    );
    const result = await registeredTool(TOOL_IDS.capture).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(result.content[0]!.value).toContain(
      'did not return an image: The preview shows the 2D view, and only the 3D view can capture.'
    );
  });

  it('rejects a path that is not a .tscn scene', async () => {
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
    registerTscnTools(context(), host());
    await expect(
      registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'notes.txt' } }, TOKEN)
    ).rejects.toThrow('Expected a .tscn scene');
  });
});
