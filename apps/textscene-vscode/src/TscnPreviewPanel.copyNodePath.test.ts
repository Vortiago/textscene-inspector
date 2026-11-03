/**
 * The host writes a node path to the clipboard, so the copy does not depend on the
 * webview's clipboard permission.
 */
import { describe, expect, it } from 'vitest';
import { openReadyPreviewPanel } from './previewPanel.testkit';
import { vscode } from './test-setup';

describe('TscnPreviewPanel copyNodePath', () => {
  it('writes the webview node path to the clipboard', async () => {
    const { triggerMessage } = await openReadyPreviewPanel('[gd_scene format=3]');

    triggerMessage({ type: 'copyNodePath', nodePath: 'Player/Camera3D' });

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('Player/Camera3D');
  });
});
