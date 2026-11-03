/**
 * A webview whose entry script fails to load posts `webviewLoadFailed`, since nothing of the
 * bundle runs. The panel loads its document once more, and a second failure ends every
 * capture with the error instead of the load deadline.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel } from './test-setup';

const CUT_SCRIPT_ERROR = 'SyntaxError: Unexpected end of input';

async function openPanel() {
  const { webview, triggerMessage } = setupMockPanel();
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData('[gd_scene format=3]'));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'));
  await vi.waitFor(() => expect(vscode.workspace.fs.readFile).toHaveBeenCalled());
  return { panel, webview, triggerMessage };
}

describe('TscnPreviewPanel script load failure', () => {
  it('loads a new document once the first one reports its script failed', async () => {
    const { webview, triggerMessage } = await openPanel();
    const firstDocument = webview.html;

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    expect(webview.html).toContain('<div id="r3f-root">');
    expect(webview.html).not.toBe(firstDocument);
  });

  it('loads no third document when the second one fails too', async () => {
    const { webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });
    const secondDocument = webview.html;

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    expect(webview.html).toBe(secondDocument);
  });

  it('answers a capture with the script error once the second document fails', async () => {
    const { panel, triggerMessage } = await openPanel();
    const captured = panel.capture();

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });
    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    await expect(captured).resolves.toEqual({
      error: `The preview script failed to load: ${CUT_SCRIPT_ERROR}`,
    });
  });
});
