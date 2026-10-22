/**
 * The host writes a node path to the clipboard, so the copy does not depend on the
 * webview's clipboard permission.
 */
import { describe, expect, it } from 'vitest';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockFileData, createMockUri, setupMockPanel, vscode } from './test-setup';

async function createReadyPanel(): Promise<ReturnType<typeof setupMockPanel>> {
  const mockPanel = setupMockPanel();
  vscode.workspace.fs.readFile.mockResolvedValue(createMockFileData('[gd_scene format=3]'));
  TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));
  await new Promise<void>((r) => setTimeout(r, 10));
  mockPanel.triggerMessage({ type: 'webviewReady' });
  return mockPanel;
}

describe('TscnPreviewPanel copyNodePath', () => {
  it('writes the webview node path to the clipboard', async () => {
    const { triggerMessage } = await createReadyPanel();

    triggerMessage({ type: 'copyNodePath', nodePath: 'Player/Camera3D' });

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('Player/Camera3D');
  });
});
