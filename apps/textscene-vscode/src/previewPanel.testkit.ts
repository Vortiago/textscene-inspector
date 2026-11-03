/// <reference types="vitest/globals" />

/** Opens a `TscnPreviewPanel` on a mocked webview panel, for the tests that drive one. */

import { expect, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { setupMockPanel, type MockWebview } from './mockPanel.testkit';
import { createMockFileData, createMockUri } from './vscodeMocks.testkit';

/** A panel on `scene.tscn` holding `tscn`, once the panel has read the file. */
export async function openPreviewPanel(tscn: string): Promise<{
  panel: TscnPreviewPanel;
  webview: MockWebview;
  triggerMessage: (msg: unknown) => void;
}> {
  const { webview, triggerMessage } = setupMockPanel();
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(tscn));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'));
  await vi.waitFor(() => expect(vscode.workspace.fs.readFile).toHaveBeenCalled());
  return { panel, webview, triggerMessage };
}
