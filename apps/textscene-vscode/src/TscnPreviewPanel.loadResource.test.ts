/**
 * Unit tests for `TscnPreviewPanel`'s `loadResource` handling.
 *
 * `_handleLoadResource` was previously only integration-exercised (mocha,
 * `test/integration/**`) with small fixtures — no unit test pinned the
 * ArrayBuffer->base64 chunked-encoding loop (`chunkSize = 8192`) against a
 * payload big enough to actually cross a chunk boundary, nor the
 * `resourceLoadError` paths (`No workspace folder found`, and the
 * underlying resource read failing).
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

async function createReadyPanel(
  triggerMessage: (msg: { type: string; [key: string]: unknown }) => void
): Promise<TscnPreviewPanel> {
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
  const panel = TscnPreviewPanel.create(
    createMockUri('/extension'),
    createMockUri('/workspace/scene.tscn')
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  triggerMessage({ type: 'webviewReady' });
  return panel;
}

interface ResourceLoadedMessage {
  type: 'resourceLoaded';
  requestId: string;
  content: string;
  isBinary: boolean;
}

interface ResourceLoadErrorMessage {
  type: 'resourceLoadError';
  requestId: string;
  error: string;
}

function loadedMessages(webview: MockWebview): ResourceLoadedMessage[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0])
    .filter((m): m is ResourceLoadedMessage => (m as { type: string }).type === 'resourceLoaded');
}

function errorMessages(webview: MockWebview): ResourceLoadErrorMessage[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0])
    .filter(
      (m): m is ResourceLoadErrorMessage => (m as { type: string }).type === 'resourceLoadError'
    );
}

/** Decode a base64 string back into raw bytes for a round-trip comparison. */
function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe('TscnPreviewPanel loadResource — binary encoding', () => {
  it('base64-round-trips a binary resource crossing multiple 8KB chunk boundaries', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    // 20,000 bytes: bigger than 2x the 8,192-byte chunk size, so the chunk
    // loop crosses a boundary mid-buffer more than once. Deterministic,
    // non-repeating-mod-256 pattern so a chunk-boundary off-by-one would
    // show up as a mismatch rather than accidentally matching.
    const bytes = new Uint8Array(20_000);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i * 37 + 11) % 256;
    }
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(bytes);

    triggerMessage({
      type: 'loadResource',
      path: 'res://textures/large.png',
      resourceType: 'Texture2D',
      requestId: 'req-large',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const messages = loadedMessages(webview);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.requestId).toBe('req-large');
    expect(messages[0]!.isBinary).toBe(true);
    expect(decodeBase64ToBytes(messages[0]!.content)).toEqual(bytes);
  });

  it('base64-round-trips a binary resource smaller than one chunk', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x7f, 0x10]);
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(bytes);

    triggerMessage({
      type: 'loadResource',
      path: 'res://textures/icon.png',
      resourceType: 'Texture2D',
      requestId: 'req-small',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const messages = loadedMessages(webview);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.isBinary).toBe(true);
    expect(decodeBase64ToBytes(messages[0]!.content)).toEqual(bytes);
  });

  it('loads a text resource as a plain (non-base64) string with isBinary: false', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });

    const subSceneText = '[gd_scene format=3]\n[node name="Sub" type="Node3D"]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(subSceneText));

    triggerMessage({
      type: 'loadResource',
      path: 'res://scenes/Sub.tscn',
      resourceType: 'PackedScene',
      requestId: 'req-text',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const messages = loadedMessages(webview);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.isBinary).toBe(false);
    expect(messages[0]!.content).toBe(subSceneText);
  });
});

describe('TscnPreviewPanel loadResource — error paths', () => {
  it('posts resourceLoadError "No workspace folder found" when the resource has no owning workspace', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    // `vi.clearAllMocks()` (test-setup's afterEach) clears call history but not a
    // previously-set `mockReturnValue` — pin this explicitly so the test doesn't
    // depend on running before any test that gives it a real workspace folder.
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);

    triggerMessage({
      type: 'loadResource',
      path: 'res://textures/orphan.png',
      resourceType: 'Texture2D',
      requestId: 'req-no-workspace',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const errors = errorMessages(webview);
    expect(errors).toEqual([
      { type: 'resourceLoadError', requestId: 'req-no-workspace', error: 'No workspace folder found' },
    ]);
    expect(loadedMessages(webview)).toHaveLength(0);
  });

  it('posts resourceLoadError when both the primary and fallback reads fail', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    await createReadyPanel(triggerMessage);
    (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({
      uri: createMockUri('/workspace'),
    });
    (vscode.workspace.fs.readFile as Mock).mockRejectedValue(new Error('ENOENT: no such file'));

    triggerMessage({
      type: 'loadResource',
      path: 'res://textures/missing.png',
      resourceType: 'Texture2D',
      requestId: 'req-missing',
    });
    await new Promise<void>((r) => setTimeout(r, 10));

    const errors = errorMessages(webview);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.requestId).toBe('req-missing');
    expect(errors[0]!.error).toContain('Failed to load resource: res://textures/missing.png');
    expect(loadedMessages(webview)).toHaveLength(0);
  });
});
