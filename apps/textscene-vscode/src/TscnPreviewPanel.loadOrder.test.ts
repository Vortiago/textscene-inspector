/**
 * Unit tests for overlapping scene reads in `TscnPreviewPanel`. A save fires both
 * `onDidSaveTextDocument` and the watcher's `onDidChange`, so two reads can be in
 * flight at once, and only the latest one's result reaches the webview.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const FIRST_TSCN = '[gd_scene format=3]\n[node name="First" type="Node3D"]';
const STALE_TSCN = '[gd_scene format=3]\n[node name="Stale" type="Node3D"]';
const LATEST_TSCN = '[gd_scene format=3]\n[node name="Latest" type="Node3D"]';

/** A read the test settles by hand, so it can finish after a later read. */
interface PendingRead {
  promise: Promise<Uint8Array>;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

function pendingRead(): PendingRead {
  let resolve!: (data: Uint8Array) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Uint8Array>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: (text) => resolve(createMockFileData(text)), reject };
}

/** Queues the next two reads as hand-settled ones, in the order the panel starts them. */
function queueTwoReads(): [PendingRead, PendingRead] {
  const reads: [PendingRead, PendingRead] = [pendingRead(), pendingRead()];
  const readFile = vscode.workspace.fs.readFile as Mock;
  for (const read of reads) {
    readFile.mockImplementationOnce(() => read.promise);
  }
  return reads;
}

function postedScenes(webview: MockWebview): string[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0] as { type: string; content?: string })
    .filter((m) => m.type === 'loadTscn')
    .map((m) => m.content as string);
}

const settle = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 10));

async function createReadyPanel(
  triggerMessage: (msg: unknown) => void,
  resource = createMockUri('/workspace/scene.tscn')
): Promise<TscnPreviewPanel> {
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(FIRST_TSCN));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), resource);
  await settle();
  triggerMessage({ type: 'webviewReady' });
  await settle();
  return panel;
}

describe('TscnPreviewPanel overlapping scene reads', () => {
  it('posts only the latest read when an earlier read finishes after it', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const resource = createMockUri('/workspace/scene.tscn');
    const panel = await createReadyPanel(triggerMessage, resource);
    webview.postMessage.mockClear();
    const [staleRead, latestRead] = queueTwoReads();

    panel.update(resource);
    panel.update(resource);
    latestRead.resolve(LATEST_TSCN);
    await settle();
    staleRead.resolve(STALE_TSCN);
    await settle();

    expect(postedScenes(webview)).toEqual([LATEST_TSCN]);
  });

  it('keeps the latest text for the ready replay after a stale read finishes', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const resource = createMockUri('/workspace/scene.tscn');
    const panel = await createReadyPanel(triggerMessage, resource);
    const [staleRead, latestRead] = queueTwoReads();

    panel.update(resource);
    panel.update(resource);
    latestRead.resolve(LATEST_TSCN);
    await settle();
    staleRead.resolve(STALE_TSCN);
    await settle();
    webview.postMessage.mockClear();
    triggerMessage({ type: 'webviewReady' });

    expect(postedScenes(webview)).toEqual([LATEST_TSCN]);
  });

  it('raises no error for a superseded read that fails after the latest read succeeds', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const resource = createMockUri('/workspace/scene.tscn');
    const panel = await createReadyPanel(triggerMessage, resource);
    webview.postMessage.mockClear();
    const showError = vscode.window.showErrorMessage as Mock;
    showError.mockClear();
    const [staleRead, latestRead] = queueTwoReads();

    panel.update(resource);
    panel.update(resource);
    latestRead.resolve(LATEST_TSCN);
    await settle();
    staleRead.reject(new Error('EBUSY: file locked'));
    await settle();

    expect(showError).not.toHaveBeenCalled();
    expect(postedScenes(webview)).toEqual([LATEST_TSCN]);
  });

  it('drops the previous document read when update() switches documents mid-read', async () => {
    const { webview, triggerMessage } = setupMockPanel();
    const resource = createMockUri('/workspace/scene.tscn');
    const panel = await createReadyPanel(triggerMessage, resource);
    webview.postMessage.mockClear();
    const [oldDocumentRead, newDocumentRead] = queueTwoReads();

    panel.update(resource);
    panel.update(createMockUri('/workspace/other.tscn'));
    newDocumentRead.resolve(LATEST_TSCN);
    await settle();
    oldDocumentRead.resolve(STALE_TSCN);
    await settle();

    expect(postedScenes(webview)).toEqual([LATEST_TSCN]);
  });
});
