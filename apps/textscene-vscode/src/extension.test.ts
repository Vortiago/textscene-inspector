/**
 * Tests for extension.ts
 * Validates extension activation, command registration, and panel management
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { activate, deactivate } from './extension';
import { createMockUri, vscode } from './test-setup';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import * as logger from './logger';

// Mock TscnPreviewPanel
vi.mock('./TscnPreviewPanel', () => ({
  TscnPreviewPanel: {
    create: vi.fn()
  }
}));

// Mock TscnDiagnostics (covered by its own unit tests)
vi.mock('./TscnDiagnostics', () => ({
  TscnDiagnostics: vi.fn(function (this: { dispose: ReturnType<typeof vi.fn> }) {
    this.dispose = vi.fn();
  })
}));

// Mock logger
vi.mock('./logger', () => ({
  initLogger: vi.fn(),
  dispose: vi.fn()
}));

describe('Extension', () => {
  let mockContext: any;
  let mockPanel: any;
  let commandHandlers: Map<string, (...args: unknown[]) => unknown>;
  let saveDocumentHandlers: Array<(...args: unknown[]) => unknown>;
  let resourceChangeHandlers: Array<(uri: unknown) => unknown>;
  let resourceDeleteHandlers: Array<(uri: unknown) => unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    commandHandlers = new Map();
    saveDocumentHandlers = [];
    resourceChangeHandlers = [];
    resourceDeleteHandlers = [];

    // Mock context
    mockContext = {
      extensionUri: createMockUri('/extension'),
      subscriptions: []
    };

    // Mock panel instance
    mockPanel = {
      reveal: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        // Store the callback for later invocation
        mockPanel._disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
      handleDependencyChange: vi.fn().mockResolvedValue(undefined),
      resource: createMockUri('/workspace/test.tscn')
    };

    // Mock TscnPreviewPanel.create
    (TscnPreviewPanel.create as Mock).mockReturnValue(mockPanel);

    // Mock vscode.commands.registerCommand
    (vscode.commands.registerCommand as Mock) = vi.fn((command: string, handler: (...args: unknown[]) => unknown) => {
      commandHandlers.set(command, handler);
      return { dispose: vi.fn() };
    });

    // Mock vscode.workspace.onDidSaveTextDocument
    (vscode.workspace.onDidSaveTextDocument as Mock) = vi.fn((handler: (...args: unknown[]) => unknown) => {
      saveDocumentHandlers.push(handler);
      return { dispose: vi.fn() };
    });

    // Mock the file-system watcher so we can capture the change handler.
    (vscode.workspace.createFileSystemWatcher as Mock) = vi.fn(() => ({
      onDidChange: vi.fn((handler: (uri: unknown) => unknown) => {
        resourceChangeHandlers.push(handler);
        return { dispose: vi.fn() };
      }),
      onDidCreate: vi.fn((handler: (uri: unknown) => unknown) => {
        resourceChangeHandlers.push(handler);
        return { dispose: vi.fn() };
      }),
      onDidDelete: vi.fn((handler: (uri: unknown) => unknown) => {
        resourceDeleteHandlers.push(handler);
        return { dispose: vi.fn() };
      }),
      dispose: vi.fn(),
    }));
  });

  function openPanelFor(fsPath: string): void {
    (vscode.window.activeTextEditor as any) = {
      document: { uri: createMockUri(fsPath), fileName: fsPath },
    };
    commandHandlers.get('textscene.openPreviewToSide')?.();
  }

  // ============================================================================
  // Activation Tests
  // ============================================================================

  describe('activate', () => {
    it('should initialize logger on activation', () => {
      activate(mockContext);

      expect(logger.initLogger).toHaveBeenCalledWith('TextScene Inspector');
    });

    it('should register openPreviewToSide command', () => {
      activate(mockContext);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'textscene.openPreviewToSide',
        expect.any(Function)
      );
    });

    it('should register onDidSaveTextDocument listener', () => {
      activate(mockContext);

      expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should add disposables to context subscriptions', () => {
      activate(mockContext);

      expect(mockContext.subscriptions.length).toBe(10); // command + symbol provider + definition provider + document link provider + diagnostics + save listener + resource watcher + 3 watcher handlers (onChange + onCreate + onDelete)
    });

    it('should register a document link provider for res:// references', () => {
      activate(mockContext);

      expect(vscode.languages.registerDocumentLinkProvider).toHaveBeenCalledWith(
        { language: 'tscn' },
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // Command Handler Tests
  // ============================================================================

  describe('openPreviewToSide command', () => {
    it('should create panel when active editor has .tscn file', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(TscnPreviewPanel.create).toHaveBeenCalledWith(
        mockContext.extensionUri,
        mockDocument.uri
      );
    });

    it('should show info message when no active editor', () => {
      (vscode.window.activeTextEditor as any) = undefined;

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Open a .tscn file to preview it.'
      );
      expect(TscnPreviewPanel.create).not.toHaveBeenCalled();
    });

    it('should show info message when active file is not .tscn', () => {
      (vscode.window.activeTextEditor as any) = {
        document: {
          uri: createMockUri('/workspace/other.txt'),
          fileName: '/workspace/other.txt'
        }
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Open a .tscn file to preview it.'
      );
      expect(TscnPreviewPanel.create).not.toHaveBeenCalled();
    });

    it('should reveal existing panel instead of creating new one', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');

      // First invocation - create panel
      commandHandler?.();
      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(1);

      // Second invocation - reveal existing
      commandHandler?.();
      expect(mockPanel.reveal).toHaveBeenCalledTimes(1);
      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(1); // Still only 1
    });

    it('should track multiple panels for different files', () => {
      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');

      // Open first file
      (vscode.window.activeTextEditor as any) = {
        document: {
          uri: createMockUri('/workspace/file1.tscn'),
          fileName: '/workspace/file1.tscn'
        }
      };
      commandHandler?.();

      // Create second panel for second file
      const mockPanel2 = { ...mockPanel, resource: createMockUri('/workspace/file2.tscn') };
      (TscnPreviewPanel.create as Mock).mockReturnValueOnce(mockPanel2);

      (vscode.window.activeTextEditor as any) = {
        document: {
          uri: createMockUri('/workspace/file2.tscn'),
          fileName: '/workspace/file2.tscn'
        }
      };
      commandHandler?.();

      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Panel Lifecycle Tests
  // ============================================================================

  describe('Panel Lifecycle', () => {
    it('should remove panel from tracking when disposed', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');

      // Create panel
      commandHandler?.();
      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(1);

      // Simulate panel disposal
      mockPanel._disposeCallback?.();

      // Try to open same file again - should create new panel
      commandHandler?.();
      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(2);
    });

    it('should register dispose callback when panel created', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(mockPanel.onDidDispose).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ============================================================================
  // Hot-Reload Tests
  // ============================================================================

  describe('Hot-Reload (onDidSaveTextDocument)', () => {
    it('should update panel when .tscn file is saved', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument
      };

      activate(mockContext);

      // Create panel first
      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      // Simulate file save
      saveDocumentHandlers.forEach(handler => handler(mockDocument));

      expect(mockPanel.update).toHaveBeenCalledWith(mockDocument.uri);
    });

    it('should not update panel when non-.tscn file is saved', () => {
      const tscnDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      (vscode.window.activeTextEditor as any) = {
        document: tscnDocument
      };

      activate(mockContext);

      // Create panel
      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      // Save different file type
      const otherDocument = {
        uri: createMockUri('/workspace/other.txt'),
        fileName: '/workspace/other.txt'
      };

      saveDocumentHandlers.forEach(handler => handler(otherDocument));

      expect(mockPanel.update).not.toHaveBeenCalled();
    });

    it('should not update if no panel exists for saved file', () => {
      activate(mockContext);

      // Save file without opening panel
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn'
      };

      saveDocumentHandlers.forEach(handler => handler(mockDocument));

      // Should not throw or crash
      expect(mockPanel.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Resource Watcher (dependency hot-reload)
  // ============================================================================

  describe('Resource Watcher', () => {
    it('routes a changed dependency to the panel for re-fetch', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const depUri = createMockUri('/workspace/textures/wood.png');
      await Promise.all(resourceChangeHandlers.map((handler) => handler(depUri)));

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(depUri);
    });

    it('re-reads a panel\'s own main scene (external change) instead of treating it as a dependency', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const mainUri = createMockUri('/workspace/scene.tscn');
      await Promise.all(resourceChangeHandlers.map((handler) => handler(mainUri)));

      // An external edit to the main scene fires no save event, so the watcher
      // must refresh it via update(); it must NOT be re-fetched as a dependency.
      expect(mockPanel.update).toHaveBeenCalledWith(mainUri);
      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
    });

    it('routes a deleted dependency through handleDependencyChange (missing placeholder path)', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const depUri = createMockUri('/workspace/textures/wood.png');
      await Promise.all(resourceDeleteHandlers.map((handler) => handler(depUri)));

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(depUri);
    });

    it('routes deletion of the main scene through update() so the panel holds last render and surfaces an error', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const mainUri = createMockUri('/workspace/scene.tscn');
      await Promise.all(resourceDeleteHandlers.map((handler) => handler(mainUri)));

      expect(mockPanel.update).toHaveBeenCalledWith(mainUri);
      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
    });

    it('deletion of a file no panel cares about causes no invalidation', async () => {
      activate(mockContext);
      // No panel opened.

      const irrelevantUri = createMockUri('/workspace/other.png');
      await Promise.all(resourceDeleteHandlers.map((handler) => handler(irrelevantUri)));

      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
      expect(mockPanel.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Deactivation Tests
  // ============================================================================

  describe('deactivate', () => {
    it('should dispose logger on deactivation', () => {
      deactivate();

      expect(logger.dispose).toHaveBeenCalled();
    });
  });
});
