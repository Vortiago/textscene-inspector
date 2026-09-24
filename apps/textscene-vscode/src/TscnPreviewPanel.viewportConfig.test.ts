/**
 * Unit tests for `textscene.defaultViewportMode`. The panel embeds it once in the
 * HTML as `window.__TEXTSCENE_CONFIG__`, read at mount. "auto" (the default) keeps
 * Godot-parity auto-select, and "2D"/"3D" reaches `<TscnPreviewShell initialViewportMode>`.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, setupMockPanel } from './test-setup';

function mockDefaultViewportMode(value: 'auto' | '2D' | '3D' | undefined): void {
  (vscode.workspace.getConfiguration as Mock).mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'defaultViewportMode') {
        return value ?? defaultValue;
      }
      return defaultValue;
    }),
  });
}

describe('TscnPreviewPanel textscene.defaultViewportMode', () => {
  it('embeds "auto" when the setting is unset', () => {
    mockDefaultViewportMode(undefined);
    const { webview } = setupMockPanel();

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));

    expect(webview.html).toContain('window.__TEXTSCENE_CONFIG__ = {"viewportMode":"auto"};');
  });

  it('embeds an explicit "2D" override', () => {
    mockDefaultViewportMode('2D');
    const { webview } = setupMockPanel();

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));

    expect(webview.html).toContain('window.__TEXTSCENE_CONFIG__ = {"viewportMode":"2D"};');
  });

  it('embeds an explicit "3D" override', () => {
    mockDefaultViewportMode('3D');
    const { webview } = setupMockPanel();

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));

    expect(webview.html).toContain('window.__TEXTSCENE_CONFIG__ = {"viewportMode":"3D"};');
  });

  it('reads the "textscene" configuration section', () => {
    mockDefaultViewportMode('2D');
    setupMockPanel();

    TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/test.tscn'));

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('textscene');
  });
});
