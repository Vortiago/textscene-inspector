import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnDiagnostics } from '../TscnDiagnostics';
import { createWorkspaceResRoots } from '../resRoots/workspaceResRoots';
import { PROJECT_FILE_PATTERN, RESOURCE_FILES_PATTERN } from '../watchPatterns';
import type { PreviewCapture } from '../previewCaptureQueue';
import type { TscnToolHost } from './registerTscnTools';
import { registerTscnTools, TOOL_IDS } from './registerTscnTools';
import { createMockFileData, createMockUri, vscode as vscodeMocks } from '../test-setup';

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
    lintComplete: vi.fn().mockResolvedValue([]),
    rootFor: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

/** A token no case cancels. */
const TOKEN = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => undefined }),
} as unknown as vscode.CancellationToken;

/** A cancellation token the test cancels, which counts the listeners still subscribed. */
function cancellableToken() {
  const listeners = new Set<() => void>();
  return {
    isCancellationRequested: false,
    onCancellationRequested(listener: () => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    cancel() {
      this.isCancellationRequested = true;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  };
}

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
    vscodeMocks.workspace.workspaceFolders = [{ uri: createMockUri('/game') }];
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

  it('registers no capture tool on a VS Code whose host fails on an image part', () => {
    vscodeMocks.version = '1.105.0';
    try {
      registerTscnTools(context(), host());
      const ids = vscodeMocks.lm.registerTool.mock.calls.map((call: unknown[]) => call[0]);
      expect(ids).not.toContain(TOOL_IDS.capture);
    } finally {
      vscodeMocks.version = '1.106.0';
    }
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

  it('the scene tree tool returns the parsed hierarchy', async () => {
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
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[node name="Root" type="Node3D"]')
    );
    registerTscnTools(context(), host());
    const result = await registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'scenes/Main.tscn' } }, TOKEN);
    expect(result.content[0]!.value).toContain('no findings');
  });

  it('reuses the Problems panel linter and reads an unchanged glTF once', async () => {
    const project = createMockUri('/game');
    const scene = [
      '[gd_scene format=3]',
      '[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]',
      '[node name="Tree" instance=ExtResource("1_tree")]',
    ].join('\n');
    const glb = '/game/tree.glb';
    const files = new Map([
      [
        glb,
        new Uint8Array(
          readFileSync(
            join(
              import.meta.dirname,
              '../../../../scenes/fixtures/gltf-unsupported-required-extension/instanced-tree.glb'
            )
          )
        ),
      ],
      ['/game/project.godot', createMockFileData('config_version=5\n')],
      ['/game/scenes/Main.tscn', createMockFileData(scene)],
    ]);
    vscodeMocks.workspace.getWorkspaceFolder.mockReturnValue({ uri: project });
    vscodeMocks.workspace.fs.stat.mockImplementation(async (uri: vscode.Uri) => {
      const bytes = files.get(uri.path);
      if (!bytes) throw new Error('Not found');
      return { type: vscode.FileType.File, size: bytes.length, ctime: 0, mtime: 1 };
    });
    vscodeMocks.workspace.fs.readFile.mockImplementation(async (uri: vscode.Uri) => {
      const bytes = files.get(uri.path);
      if (!bytes) throw new Error('Not found');
      return bytes;
    });
    const roots = createWorkspaceResRoots();
    const filesWatcher = vscode.workspace.createFileSystemWatcher(RESOURCE_FILES_PATTERN);
    const projectWatcher = vscode.workspace.createFileSystemWatcher(PROJECT_FILE_PATTERN);
    const diagnostics = new TscnDiagnostics(roots, filesWatcher, projectWatcher);
    try {
      registerTscnTools(
        context(),
        host({ lintComplete: (uri, text) => diagnostics.lintComplete(uri, text) })
      );
      const invocation = { input: { path: 'scenes/Main.tscn' } };
      const first = await registeredTool(TOOL_IDS.lint).invoke(invocation, TOKEN);
      const second = await registeredTool(TOOL_IDS.lint).invoke(invocation, TOKEN);

      expect(first.content[0]!.value).toContain('gltf-required-extension-unsupported');
      expect(second.content[0]!.value).toBe(first.content[0]!.value);
      expect(
        vscodeMocks.workspace.fs.readFile.mock.calls.filter(([uri]: [vscode.Uri]) => uri.path === glb)
      ).toHaveLength(1);
    } finally {
      diagnostics.dispose();
      projectWatcher.dispose();
      filesWatcher.dispose();
      roots.dispose();
    }
  });

  it("the missing-resources tool checks over the Problems panel's provider for the scene", async () => {
    vscodeMocks.workspace.fs.readFile.mockResolvedValue(
      createMockFileData('[ext_resource type="PackedScene" path="res://door.tscn" id="1"]')
    );
    const stamp = vi.fn().mockResolvedValue(null);
    const rootFor = vi.fn().mockResolvedValue({ root: { stamp } });
    registerTscnTools(context(), host({ rootFor }));
    const result = await registeredTool(TOOL_IDS.missingResources).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(rootFor.mock.calls[0]![0].path).toMatch(/\/game\/scenes\/Main\.tscn$/);
    expect(stamp).toHaveBeenCalledWith('res://door.tscn');
    expect(result.content[0]!.value).toContain('res://door.tscn');
  });

  it('the missing-resources tool reports a scene outside a project', async () => {
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
        capturePreview: vi.fn().mockResolvedValue({ error: 'The viewport crashed: no WebGL context.' }),
      })
    );
    const result = await registeredTool(TOOL_IDS.capture).invoke(
      { input: { path: 'scenes/Main.tscn' } },
      TOKEN
    );
    expect(result.content[0]!.value).toContain(
      'did not return an image: The viewport crashed: no WebGL context.'
    );
  });

  it('the capture tool ends the capture when the call is cancelled, and stops listening', async () => {
    const token = cancellableToken();
    const capturePreview = vi.fn(
      (_uri: vscode.Uri, signal: AbortSignal) =>
        new Promise<PreviewCapture>((resolve) =>
          signal.addEventListener('abort', () => resolve({ error: 'The capture was cancelled.' }))
        )
    );
    registerTscnTools(context(), host({ capturePreview }));
    const invoked = registeredTool(TOOL_IDS.capture).invoke({ input: { path: 'scenes/Main.tscn' } }, token);

    token.cancel();
    const result = await invoked;

    expect(result.content[0]!.value).toContain('did not return an image: The capture was cancelled.');
    expect(token.listenerCount()).toBe(0);
  });

  it('rejects a path that is not a .tscn scene', async () => {
    registerTscnTools(context(), host());
    await expect(
      registeredTool(TOOL_IDS.lint).invoke({ input: { path: 'notes.txt' } }, TOKEN)
    ).rejects.toThrow('Expected a .tscn scene');
  });
});
