/**
 * Unit tests for `TscnPreviewPanel`'s `loadResource` handling: the chunked
 * ArrayBuffer-to-base64 loop (`chunkSize = 8192`) across chunk boundaries, and the
 * `resourceLoadError` paths (`No workspace folder found`, and a failed read).
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

    // 20,000 bytes: over twice the 8,192-byte chunk, so the loop crosses more than
    // one boundary. The pattern does not repeat mod 256, so an off-by-one at a
    // boundary shows as a mismatch.
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
    // `vi.clearAllMocks()` (test-setup's afterEach) clears calls but not a
    // `mockReturnValue`, so this pins its own and runs in any order.
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
