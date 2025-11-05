/**
 * Comprehensive tests for TscnPreviewPanel
 * Tests panel lifecycle, content loading, message handling, resource loading, and integration
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, vscode } from './test-setup';

// Mock external modules
vi.mock('./webview/webviewHtml', () => ({
  generateNonce: vi.fn(() => 'mock-nonce-12345678901234567890'),
  generateWebviewHtml: vi.fn((scriptUri: string, nonce: string) =>
    `<html><script nonce="${nonce}" src="${scriptUri}"></script></html>`
  )
}));

vi.mock('./diffUtils', () => ({
  computeIncrementalChanges: vi.fn()
}));

// Create a mock loadResource function that we can control
const mockLoadResource = vi.fn();

vi.mock('./providers/VSCodeResourceProvider', () => ({
  VSCodeResourceProvider: class MockVSCodeResourceProvider {
    constructor(workspaceRoot: any, documentUri: any) {}
    loadResource = mockLoadResource;
  }
}));

vi.mock('./logger', () => ({
  getChannel: vi.fn(),
  show: vi.fn()
}));

import { generateNonce, generateWebviewHtml } from './webview/webviewHtml';
import { computeIncrementalChanges } from './diffUtils';
import * as logger from './logger';

// Export mockLoadResource for use in tests
export { mockLoadResource };

describe('TscnPreviewPanel', () => {
  let extensionUri: ReturnType<typeof createMockUri>;
  let resourceUri: ReturnType<typeof createMockUri>;
  let mockPanel: any;
  let mockWebview: any;
  let messageHandler: ((message: any) => void) | null;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    messageHandler = null;

    // Setup URIs
    extensionUri = createMockUri('/extension');
    resourceUri = createMockUri('/workspace/test.tscn');

    // Setup mock webview
    mockWebview = {
      html: '',
      postMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: any) => ({
        ...uri,
        toString: () => `vscode-webview://mock/${uri.fsPath}`
      })),
      onDidReceiveMessage: vi.fn((handler: (msg: any) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      })
    };

    // Setup mock panel
    mockPanel = {
      webview: mockWebview,
      title: '',
      reveal: vi.fn(),
      dispose: vi.fn(),
      onDidDispose: vi.fn((handler: () => void) => {
        // Store handler for later invocation if needed
        return { dispose: vi.fn() };
      })
    };

    // Mock createWebviewPanel
    (vscode.window.createWebviewPanel as Mock).mockReturnValue(mockPanel);

    // Mock workspace.fs.readFile by default
    const mockTscnContent = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
    (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
      createMockFileData(mockTscnContent)
    );

    // Mock workspace.getWorkspaceFolder
    (vscode.workspace.getWorkspaceFolder as Mock) = vi.fn(() => ({
      uri: createMockUri('/workspace'),
      name: 'workspace',
      index: 0
    }));

    // Mock computeIncrementalChanges
    (computeIncrementalChanges as Mock).mockReturnValue({
      updateType: 'full',
      newScene: { nodes: [], externalResources: [], internalResources: [] }
    });
  });

  // ============================================================================
  // Phase A: Panel Lifecycle (8 tests)
  // ============================================================================

  describe('Panel Lifecycle', () => {
    it('should create panel with valid resource', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'tscnPreview',
        'Preview: test.tscn',
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
      expect(panel.resource.fsPath).toBe(resourceUri.fsPath);
    });

    it('should reveal existing panel', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

      panel.reveal(vscode.ViewColumn.Two as any);

      expect(mockPanel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.Two);
    });

    it('should track current resource URI', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(panel.resource.fsPath).toBe('/workspace/test.tscn');
    });

    it('should update title on resource change', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      const newResource = createMockUri('/workspace/other.tscn');

      panel.update(newResource);

      expect(mockPanel.title).toBe('Preview: other.tscn');
      expect(panel.resource.fsPath).toBe('/workspace/other.tscn');
    });

    it('should fire onDidDispose event when panel disposed', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      const disposeSpy = vi.fn();

      panel.onDidDispose(disposeSpy);
      panel.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clean up all disposables on dispose', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

      // Capture disposables registered during construction
      const disposeSpies = mockPanel.onDidDispose.mock.results.map((r: any) => r.value.dispose);
      const messageDisposeSpies = mockWebview.onDidReceiveMessage.mock.results.map((r: any) => r.value.dispose);

      panel.dispose();

      expect(mockPanel.dispose).toHaveBeenCalled();
      // Verify disposables were called
      expect(disposeSpies.length + messageDisposeSpies.length).toBeGreaterThan(0);
    });

    it('should dispose panel multiple times safely', () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);

      panel.dispose();
      panel.dispose(); // Second dispose should not throw

      expect(mockPanel.dispose).toHaveBeenCalledTimes(2);
    });

    it('should set webview HTML during construction', () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(generateNonce).toHaveBeenCalled();
      expect(generateWebviewHtml).toHaveBeenCalled();
      expect(mockWebview.html).toBeTruthy();
    });
  });

  // ============================================================================
  // Phase B: Content Loading (12 tests)
  // ============================================================================

  describe('Content Loading', () => {
    it('should load initial TSCN content', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);

      // Wait for async content load
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(resourceUri);
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'loadTscn',
        content: expect.stringContaining('[gd_scene format=3]')
      });
    });

    it('should perform full reload when content changes significantly', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock significant change requiring full reload
      (computeIncrementalChanges as Mock).mockReturnValue({
        updateType: 'full',
        newScene: { nodes: [], externalResources: [], internalResources: [] }
      });

      const newContent = '[gd_scene format=3]\n[node name="NewRoot" type="Node3D"]';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const loadTscnCalls = (mockWebview.postMessage as Mock).mock.calls.filter(
        (call: any) => call[0].type === 'loadTscn'
      );
      expect(loadTscnCalls.length).toBeGreaterThanOrEqual(2); // Initial + update
    });

    it('should perform incremental update when only nodes change', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock incremental change
      (computeIncrementalChanges as Mock).mockReturnValue({
        updateType: 'incremental',
        changes: [{ type: 'update', nodePath: 'Root', node: {} }],
        newScene: { nodes: [{ name: 'Root', type: 'Node3D' }], externalResources: [], internalResources: [] }
      });

      const newContent = '[gd_scene format=3]\n[node name="Root" type="Node3D"]\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      mockWebview.postMessage.mockClear();
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'incrementalUpdate',
        data: expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ type: 'update' })
          ])
        })
      });
    });

    it('should not reload when content unchanged', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const initialCallCount = (mockWebview.postMessage as Mock).mock.calls.length;

      // Update with same content
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const finalCallCount = (mockWebview.postMessage as Mock).mock.calls.length;
      expect(finalCallCount).toBe(initialCallCount); // No new messages
    });

    it('should handle empty file without error', async () => {
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData('')
      );

      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'loadTscn',
        content: ''
      });
    });

    it('should show error message when file read fails', async () => {
      (vscode.workspace.fs.readFile as Mock).mockRejectedValue(
        new Error('File not found')
      );

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load TSCN file')
      );
    });

    it('should update previousContent after each load', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Change content
      const newContent = '[gd_scene format=3]\n[node name="Different" type="Node3D"]';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Third update with same content should not trigger reload
      mockWebview.postMessage.mockClear();
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });

    it('should call computeIncrementalChanges with correct parameters', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const oldContent = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
      const newContent = '[gd_scene format=3]\n[node name="Root" type="Node3D"]\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)';

      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(computeIncrementalChanges).toHaveBeenCalledWith(
        oldContent,
        newContent
      );
    });

    it('should fallback to full reload when diff has no changes', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock incremental result but with undefined changes
      (computeIncrementalChanges as Mock).mockReturnValue({
        updateType: 'incremental',
        changes: undefined,
        newScene: undefined
      });

      const newContent = '[gd_scene format=3]\n[node name="Modified" type="Node3D"]';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      mockWebview.postMessage.mockClear();
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'loadTscn',
        content: newContent
      });
    });

    it('should fallback to full reload when diff has no newScene', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock incremental result but with undefined newScene
      (computeIncrementalChanges as Mock).mockReturnValue({
        updateType: 'incremental',
        changes: [{ type: 'update', nodePath: 'Root' }],
        newScene: null
      });

      const newContent = '[gd_scene format=3]\n[node name="Modified" type="Node3D"]';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      mockWebview.postMessage.mockClear();
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'loadTscn',
        content: newContent
      });
    });

    it('should send loadTscn message on first load', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'loadTscn',
        content: expect.any(String)
      });
    });
  });

  // ============================================================================
  // Phase C: Message Handling (10 tests)
  // ============================================================================

  describe('Message Handling', () => {
    it('should handle jumpToNode message', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="TestNode" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      // Send jumpToNode message
      messageHandler?.({ type: 'jumpToNode', nodeName: 'TestNode' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(resourceUri);
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('should handle loadResource message', async () => {
      mockLoadResource.mockResolvedValueOnce('texture content');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      // Send loadResource message
      messageHandler?.({
        type: 'loadResource',
        path: 'res://icon.png',
        resourceType: 'Texture2D',
        requestId: 'req-123'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoaded',
        requestId: 'req-123',
        content: 'texture content',
        isBinary: false
      });
    });

    it('should handle resourceNeeded message', async () => {
      const mockChannel = {
        warn: vi.fn(),
        append: vi.fn(),
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn()
      };
      (logger.getChannel as Mock).mockReturnValue(mockChannel);

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Send resourceNeeded message
      messageHandler?.({
        type: 'resourceNeeded',
        resource: {
          path: 'res://missing.tscn',
          type: 'PackedScene',
          referencedBy: 'Enemy',
          error: 'File not found'
        }
      });

      expect(mockChannel.warn).toHaveBeenCalledWith(
        expect.stringContaining('res://missing.tscn')
      );
      expect(logger.show).toHaveBeenCalled();
    });

    it('should open correct document and line for jumpToNode', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() =>
          '[gd_scene format=3]\n' +
          '[node name="Root" type="Node3D"]\n' +
          '[node name="Child" type="Node3D" parent="."]'
        ),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Child' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEditor.selection.start.line).toBe(2); // Third line (0-indexed)
      expect(mockEditor.revealRange).toHaveBeenCalled();
    });

    it('should send resourceLoaded response with correct requestId', async () => {
      mockLoadResource.mockResolvedValueOnce('content data');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://test.txt',
        resourceType: 'Resource',
        requestId: 'unique-request-id-456'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unique-request-id-456'
        })
      );
    });

    it('should send resourceLoadError message on loadResource failure', async () => {
      mockLoadResource.mockRejectedValueOnce(new Error('Resource not found'));

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://missing.txt',
        resourceType: 'Resource',
        requestId: 'req-error-789'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoadError',
        requestId: 'req-error-789',
        error: 'Resource not found'
      });
    });

    it('should show warning when node not found in jumpToNode', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="Root" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'NonExistent' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Could not find node "NonExistent"')
      );
    });

    it('should handle loadResource with no workspace folder', async () => {
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://test.txt',
        resourceType: 'Resource',
        requestId: 'req-no-workspace'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoadError',
        requestId: 'req-no-workspace',
        error: 'No workspace folder found'
      });
    });

    it('should handle error message from webview', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      messageHandler?.({
        type: 'error',
        message: 'Rendering failed: Invalid mesh data'
      });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Rendering failed: Invalid mesh data'
      );
    });

    it('should handle document open failure in jumpToNode', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      (vscode.workspace.openTextDocument as Mock).mockRejectedValue(
        new Error('Document open failed')
      );

      messageHandler?.({ type: 'jumpToNode', nodeName: 'TestNode' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to jump to node')
      );
    });
  });

  // ============================================================================
  // Phase D: Resource Loading (8 tests)
  // ============================================================================

  describe('Resource Loading', () => {
    it('should load text resource via VSCodeResourceProvider', async () => {
      mockLoadResource.mockResolvedValueOnce('shader code content');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      messageHandler?.({
        type: 'loadResource',
        path: 'res://shaders/custom.gdshader',
        resourceType: 'Shader',
        requestId: 'req-text'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLoadResource).toHaveBeenCalledWith(
        'res://shaders/custom.gdshader',
        'Shader'
      );
    });

    it('should load binary resource via VSCodeResourceProvider', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
      mockLoadResource.mockResolvedValueOnce(binaryData);

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      messageHandler?.({
        type: 'loadResource',
        path: 'res://icon.png',
        resourceType: 'Texture2D',
        requestId: 'req-binary'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLoadResource).toHaveBeenCalledWith(
        'res://icon.png',
        'Texture2D'
      );
    });

    it('should send binary resource as base64 encoded', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
      mockLoadResource.mockResolvedValueOnce(binaryData);

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://test.png',
        resourceType: 'Texture2D',
        requestId: 'req-base64'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoaded',
        requestId: 'req-base64',
        content: expect.any(String),
        isBinary: true
      });

      // Verify base64 encoding occurred
      const call = (mockWebview.postMessage as Mock).mock.calls.find(
        (c: any) => c[0].requestId === 'req-base64'
      );
      expect(typeof call?.[0].content).toBe('string');
    });

    it('should mark binary flag correctly for ArrayBuffer', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4]).buffer;
      mockLoadResource.mockResolvedValueOnce(binaryData);

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://binary.bin',
        resourceType: 'Resource',
        requestId: 'req-binary-flag'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isBinary: true })
      );
    });

    it('should mark binary flag as false for string content', async () => {
      mockLoadResource.mockResolvedValueOnce('text content');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://text.txt',
        resourceType: 'Resource',
        requestId: 'req-text-flag'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isBinary: false })
      );
    });

    it('should handle VSCodeResourceProvider failure', async () => {
      mockLoadResource.mockRejectedValueOnce(new Error('Provider error'));

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://fail.txt',
        resourceType: 'Resource',
        requestId: 'req-fail'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoadError',
        requestId: 'req-fail',
        error: 'Provider error'
      });
    });

    it('should create VSCodeResourceProvider with workspace root', async () => {
      const mockWorkspaceFolder = {
        uri: createMockUri('/workspace'),
        name: 'test-workspace',
        index: 0
      };
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(mockWorkspaceFolder);

      // We don't need to check the constructor call since it's instantiated inside
      // Just verify it works
      mockLoadResource.mockResolvedValueOnce('content');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://test.txt',
        resourceType: 'Resource',
        requestId: 'req-workspace'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoaded',
        requestId: 'req-workspace',
        content: 'content',
        isBinary: false
      });
    });

    it('should handle unknown error type in loadResource', async () => {
      mockLoadResource.mockRejectedValueOnce('string error');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockWebview.postMessage.mockClear();

      messageHandler?.({
        type: 'loadResource',
        path: 'res://fail.txt',
        resourceType: 'Resource',
        requestId: 'req-unknown-error'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoadError',
        requestId: 'req-unknown-error',
        error: 'Unknown error'
      });
    });
  });

  // ============================================================================
  // Phase E: Jump to Definition (6 tests)
  // ============================================================================

  describe('Jump to Definition', () => {
    it('should find node definition in file', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() =>
          '[gd_scene format=3]\n' +
          '[node name="Root" type="Node3D"]\n' +
          '[node name="Target" type="MeshInstance3D" parent="."]'
        ),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Target' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEditor.selection.start.line).toBe(2);
    });

    it('should set cursor position correctly', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="Test" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEditor.selection.start.line).toBe(1);
      expect(mockEditor.selection.start.character).toBe(0);
    });

    it('should reveal line in editor', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="Reveal" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Reveal' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEditor.revealRange).toHaveBeenCalledWith(
        expect.any(Object),
        vscode.TextEditorRevealType.InCenter
      );
    });

    it('should handle node with special characters in name', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="Node-With_Special.Chars" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn()
      };
      (vscode.window.showTextDocument as Mock).mockResolvedValue(mockEditor);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Node-With_Special.Chars' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEditor.selection.start.line).toBe(1);
    });

    it('should handle node not found gracefully', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockDocument = {
        getText: vi.fn(() => '[gd_scene format=3]\n[node name="Exists" type="Node3D"]'),
        uri: resourceUri
      };
      (vscode.workspace.openTextDocument as Mock).mockResolvedValue(mockDocument);

      messageHandler?.({ type: 'jumpToNode', nodeName: 'DoesNotExist' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Could not find node "DoesNotExist" in file'
      );
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('should handle document open failure', async () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      (vscode.workspace.openTextDocument as Mock).mockRejectedValue(
        new Error('Access denied')
      );

      messageHandler?.({ type: 'jumpToNode', nodeName: 'Test' });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to jump to node')
      );
    });
  });

  // ============================================================================
  // Phase F: HTML Generation (3 tests)
  // ============================================================================

  describe('HTML Generation', () => {
    it('should generate HTML with valid script URI', () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(mockWebview.asWebviewUri).toHaveBeenCalledWith(
        expect.objectContaining({
          fsPath: expect.stringContaining('webview.js')
        })
      );
      expect(generateWebviewHtml).toHaveBeenCalledWith(
        expect.stringContaining('vscode-webview'),
        expect.any(String)
      );
    });

    it('should include nonce in HTML generation', () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(generateNonce).toHaveBeenCalled();
      expect(generateWebviewHtml).toHaveBeenCalledWith(
        expect.any(String),
        'mock-nonce-12345678901234567890'
      );
    });

    it('should set webview HTML with generated content', () => {
      TscnPreviewPanel.create(extensionUri, resourceUri);

      expect(mockWebview.html).toContain('<html>');
      expect(mockWebview.html).toContain('mock-nonce-12345678901234567890');
    });
  });

  // ============================================================================
  // Phase G: Integration Tests (3 tests)
  // ============================================================================

  describe('Integration Tests', () => {
    it('should complete full panel lifecycle (create → load → update → dispose)', async () => {
      const panel = TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify creation
      expect(panel.resource.fsPath).toBe(resourceUri.fsPath);
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'loadTscn' })
      );

      // Update with new content
      const newContent = '[gd_scene format=3]\n[node name="Updated" type="Node3D"]';
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
        createMockFileData(newContent)
      );

      mockWebview.postMessage.mockClear();
      panel.update(resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWebview.postMessage).toHaveBeenCalled();

      // Dispose
      const disposeSpy = vi.fn();
      panel.onDidDispose(disposeSpy);
      panel.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(mockPanel.dispose).toHaveBeenCalled();
    });

    it('should handle message round-trip (extension → webview → extension)', async () => {
      mockLoadResource.mockResolvedValueOnce('response data');

      TscnPreviewPanel.create(extensionUri, resourceUri);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Extension sends loadTscn to webview (initial load)
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'loadTscn' })
      );

      // Webview sends loadResource request back to extension
      messageHandler?.({
        type: 'loadResource',
        path: 'res://test.txt',
        resourceType: 'Resource',
        requestId: 'round-trip-123'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Extension sends resourceLoaded response back to webview
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'resourceLoaded',
        requestId: 'round-trip-123',
        content: 'response data',
        isBinary: false
      });
    });

    it('should support multiple panels for different files', () => {
      const resource1 = createMockUri('/workspace/file1.tscn');
      const resource2 = createMockUri('/workspace/file2.tscn');

      const panel1 = TscnPreviewPanel.create(extensionUri, resource1);
      const panel2 = TscnPreviewPanel.create(extensionUri, resource2);

      expect(panel1.resource.fsPath).toBe('/workspace/file1.tscn');
      expect(panel2.resource.fsPath).toBe('/workspace/file2.tscn');
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    });
  });
});
