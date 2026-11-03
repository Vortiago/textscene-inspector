/// <reference types="vitest/globals" />

/** Opens a `TscnPreviewPanel` on a mocked webview panel, for the tests that drive one. */

import { type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { setupMockPanel } from './mockPanel.testkit';
import { createMockFileData, createMockUri } from './vscodeMocks.testkit';

/** Lets every mocked read resolve and its continuation run. */
export const settle = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 10));

/**
 * A panel on `scenePath` holding `tscn`, once the panel has read the file. `panel` is the
 * preview, and `hostPanel` the VS Code panel it drives.
 */
export async function openPreviewPanel(tscn: string, scenePath = '/workspace/scene.tscn') {
  const mock = setupMockPanel();
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(tscn));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri(scenePath));
  await settle();
  return { ...mock, hostPanel: mock.panel, panel };
}

/** As `openPreviewPanel`, once the webview has posted `webviewReady`. */
export async function openReadyPreviewPanel(tscn: string, scenePath?: string) {
  const opened = await openPreviewPanel(tscn, scenePath);
  opened.triggerMessage({ type: 'webviewReady' });
  return opened;
}
