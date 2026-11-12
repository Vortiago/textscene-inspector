/**
 * Unit tests for `TscnPreviewPanel`'s `listDirectory` handling: the entries of a `res://` folder as the workspace holds
 * them, null for a folder it lacks, and `resourceLoadError` while no workspace is open.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { openReadyPreviewPanel } from './previewPanel.testkit';
import { createMockUri, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
const DIRECTORY = 2;
const FILE = 1;
const SYMBOLIC_LINK = 64;

const answers = (webview: MockWebview, type: string) =>
  webview.postMessage.mock.calls.map((call) => call[0] as { type: string }).filter((m) => m.type === type);

async function listFolder(folder: string) {
  const panel = await openReadyPreviewPanel(MINIMAL_TSCN);
  (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({ uri: createMockUri('/workspace') });
  panel.triggerMessage({ type: 'listDirectory', folder, requestId: 'list-1' });
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return panel.webview;
}

describe('TscnPreviewPanel listDirectory', () => {
  it('answers with the entries of the folder, a link to a folder counted as a folder', async () => {
    (vscode.workspace.fs.readDirectory as Mock).mockResolvedValue([
      ['sub', DIRECTORY],
      ['a.png', FILE],
      ['link', DIRECTORY | SYMBOLIC_LINK],
    ]);
    const webview = await listFolder('res://');
    expect(answers(webview, 'directoryListed')).toEqual([
      {
        type: 'directoryListed',
        requestId: 'list-1',
        entries: [
          { name: 'sub', isDirectory: true },
          { name: 'a.png', isDirectory: false },
          { name: 'link', isDirectory: true },
        ],
      },
    ]);
  });

  it('answers null for a folder the workspace lacks', async () => {
    (vscode.workspace.fs.readDirectory as Mock).mockRejectedValue(new Error('FileNotFound'));
    const webview = await listFolder('res://nope');
    expect(answers(webview, 'directoryListed')).toEqual([
      { type: 'directoryListed', requestId: 'list-1', entries: null },
    ]);
  });

  it('refuses a folder that climbs out of the res:// root', async () => {
    const webview = await listFolder('res://..');
    expect(answers(webview, 'resourceLoadError')).toHaveLength(1);
  });
});
