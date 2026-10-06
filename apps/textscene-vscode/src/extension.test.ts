/** Tests for extension.ts: activation, command registration and panel management. */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { activate, deactivate } from './extension';
import { createMockUri, vscode } from './test-setup';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import * as logger from './logger';
import { TscnDiagnostics } from './TscnDiagnostics';
import { SceneTreeView } from './sceneTree/SceneTreeView';
import { PROJECT_FILE_PATTERN, RESOURCE_FILES_PATTERN } from './watchPatterns';

vi.mock('./TscnPreviewPanel', () => ({
  TscnPreviewPanel: {
    create: vi.fn(),
  },
}));

// TscnDiagnostics has its own unit tests.
vi.mock('./TscnDiagnostics', () => ({
  TscnDiagnostics: vi.fn(function (this: { dispose: ReturnType<typeof vi.fn> }) {
    this.dispose = vi.fn();
  }),
}));

// SceneTreeView has its own unit tests.
vi.mock('./sceneTree/SceneTreeView', () => ({
  SceneTreeView: vi.fn(function (this: {
    refresh: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }) {
    this.refresh = vi.fn();
    this.dispose = vi.fn();
  }),
}));

vi.mock('./logger', () => ({
  initLogger: vi.fn(),
  dispose: vi.fn(),
}));

type UriHandler = (uri: unknown) => unknown;

interface WatcherHandlers {
  change: UriHandler[];
  delete: UriHandler[];
}

describe('Extension', () => {
  let mockContext: any;
  let mockPanel: any;
  let commandHandlers: Map<string, (...args: unknown[]) => unknown>;
  let saveDocumentHandlers: Array<(...args: unknown[]) => unknown>;
  /** The change and delete handlers each watcher received, keyed by its glob. */
  let watcherHandlers: Map<string, WatcherHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();

    commandHandlers = new Map();
    saveDocumentHandlers = [];
    watcherHandlers = new Map();

    mockContext = {
      extensionUri: createMockUri('/extension'),
      subscriptions: [],
    };

    mockPanel = {
      reveal: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
      onDidDispose: vi.fn((callback: () => void) => {
        mockPanel._disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
      onDidChangeViewState: vi.fn((callback: () => void) => {
        mockPanel._viewStateCallback = callback;
        return { dispose: vi.fn() };
      }),
      handleDependencyChange: vi.fn().mockResolvedValue(undefined),
      resource: createMockUri('/workspace/test.tscn'),
    };

    (TscnPreviewPanel.create as Mock).mockReturnValue(mockPanel);

    (vscode.commands.registerCommand as Mock) = vi.fn(
      (command: string, handler: (...args: unknown[]) => unknown) => {
        commandHandlers.set(command, handler);
        return { dispose: vi.fn() };
      }
    );

    (vscode.workspace.onDidSaveTextDocument as Mock) = vi.fn((handler: (...args: unknown[]) => unknown) => {
      saveDocumentHandlers.push(handler);
      return { dispose: vi.fn() };
    });

    // A watcher mock, so the test captures each glob's change handlers.
    (vscode.workspace.createFileSystemWatcher as Mock) = vi.fn((pattern: string) => {
      const handlers: WatcherHandlers = { change: [], delete: [] };
      watcherHandlers.set(pattern, handlers);
      const capture = (into: UriHandler[]) =>
        vi.fn((handler: UriHandler) => {
          into.push(handler);
          return { dispose: vi.fn() };
        });
      return {
        onDidChange: capture(handlers.change),
        onDidCreate: capture(handlers.change),
        onDidDelete: capture(handlers.delete),
        dispose: vi.fn(),
      };
    });
  });

  async function fireChange(pattern: string, uri: unknown): Promise<void> {
    await Promise.all(watcherHandlers.get(pattern)!.change.map((handler) => handler(uri)));
  }

  async function fireDelete(pattern: string, uri: unknown): Promise<void> {
    await Promise.all(watcherHandlers.get(pattern)!.delete.map((handler) => handler(uri)));
  }

  function openPanelFor(fsPath: string): void {
    (vscode.window.activeTextEditor as any) = {
      document: { uri: createMockUri(fsPath), fileName: fsPath },
    };
    commandHandlers.get('textscene.openPreviewToSide')?.();
  }

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

      expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should add disposables to context subscriptions', () => {
      activate(mockContext);

      // scene tree view, command, symbol, definition and document link providers,
      // diagnostics, save listener, and for each of the two watchers itself plus its
      // three handlers.
      expect(mockContext.subscriptions.length).toBe(15);
    });

    it('hands the Scene Tree view the live map of previews', () => {
      activate(mockContext);
      openPanelFor('/workspace/test.tscn');

      const [previews] = (SceneTreeView as unknown as Mock).mock.calls[0]! as [Map<string, unknown>];
      expect([...previews.values()]).toEqual([mockPanel]);
    });

    it('should register a document link provider for res:// references', () => {
      activate(mockContext);

      expect(vscode.languages.registerDocumentLinkProvider).toHaveBeenCalledWith(
        { language: 'tscn' },
        expect.any(Object)
      );
    });
  });

  describe('openPreviewToSide command', () => {
    it('should create panel when active editor has .tscn file', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument,
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(TscnPreviewPanel.create).toHaveBeenCalledWith(mockContext.extensionUri, mockDocument.uri);
    });

    // VS Code passes the clicked resource as the handler's first argument for
    // `explorer/context`, `editor/context` and `editor/title` contributions.
    // Resolving from `activeTextEditor` instead previews whatever happens to be
    // focused, which is a different file than the one the user clicked.
    it('previews the clicked file, not the active one, when a uri is passed', () => {
      const active = {
        uri: createMockUri('/workspace/active.tscn'),
        fileName: '/workspace/active.tscn',
      };
      (vscode.window.activeTextEditor as any) = { document: active };

      activate(mockContext);

      const clicked = createMockUri('/workspace/clicked.tscn');
      commandHandlers.get('textscene.openPreviewToSide')?.(clicked);

      expect(TscnPreviewPanel.create).toHaveBeenCalledWith(mockContext.extensionUri, clicked);
    });

    it('previews a clicked file that is not open in any editor', () => {
      // The explorer entry point: right-clicking a `.tscn` that was never
      // opened leaves `activeTextEditor` undefined, or pointing at something
      // else entirely.
      (vscode.window.activeTextEditor as any) = undefined;

      activate(mockContext);

      const clicked = createMockUri('/workspace/never-opened.tscn');
      commandHandlers.get('textscene.openPreviewToSide')?.(clicked);

      expect(TscnPreviewPanel.create).toHaveBeenCalledWith(mockContext.extensionUri, clicked);
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('falls back to the active editor when invoked with no argument', () => {
      // The command palette passes nothing, so the active editor stays the
      // resolution source for that entry point.
      const active = {
        uri: createMockUri('/workspace/active.tscn'),
        fileName: '/workspace/active.tscn',
      };
      (vscode.window.activeTextEditor as any) = { document: active };

      activate(mockContext);

      commandHandlers.get('textscene.openPreviewToSide')?.();

      expect(TscnPreviewPanel.create).toHaveBeenCalledWith(mockContext.extensionUri, active.uri);
    });

    it('ignores a non-tscn argument rather than previewing it', () => {
      (vscode.window.activeTextEditor as any) = undefined;

      activate(mockContext);

      commandHandlers.get('textscene.openPreviewToSide')?.(createMockUri('/workspace/notes.txt'));

      expect(TscnPreviewPanel.create).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Open a .tscn file to preview it.');
    });

    it('should show info message when no active editor', () => {
      (vscode.window.activeTextEditor as any) = undefined;

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Open a .tscn file to preview it.');
      expect(TscnPreviewPanel.create).not.toHaveBeenCalled();
    });

    it('should show info message when active file is not .tscn', () => {
      (vscode.window.activeTextEditor as any) = {
        document: {
          uri: createMockUri('/workspace/other.txt'),
          fileName: '/workspace/other.txt',
        },
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Open a .tscn file to preview it.');
      expect(TscnPreviewPanel.create).not.toHaveBeenCalled();
    });

    it('should reveal existing panel instead of creating new one', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument,
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
          fileName: '/workspace/file1.tscn',
        },
      };
      commandHandler?.();

      // Create second panel for second file
      const mockPanel2 = { ...mockPanel, resource: createMockUri('/workspace/file2.tscn') };
      (TscnPreviewPanel.create as Mock).mockReturnValueOnce(mockPanel2);

      (vscode.window.activeTextEditor as any) = {
        document: {
          uri: createMockUri('/workspace/file2.tscn'),
          fileName: '/workspace/file2.tscn',
        },
      };
      commandHandler?.();

      expect(TscnPreviewPanel.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Panel Lifecycle', () => {
    it('refreshes the Scene Tree view when a preview gains or loses the active slot', () => {
      activate(mockContext);
      openPanelFor('/workspace/test.tscn');
      const sceneTree = (SceneTreeView as unknown as Mock).mock.instances[0] as { refresh: Mock };

      mockPanel._viewStateCallback();

      expect(sceneTree.refresh).toHaveBeenCalledTimes(1);
    });

    it('refreshes the Scene Tree view after a closed preview leaves the map', () => {
      activate(mockContext);
      openPanelFor('/workspace/test.tscn');
      const [previews] = (SceneTreeView as unknown as Mock).mock.calls[0]! as [Map<string, unknown>];
      const sceneTree = (SceneTreeView as unknown as Mock).mock.instances[0] as { refresh: Mock };
      sceneTree.refresh.mockImplementation(() => expect(previews.size).toBe(0));

      mockPanel._disposeCallback();

      expect(sceneTree.refresh).toHaveBeenCalledTimes(1);
    });

    it('should remove panel from tracking when disposed', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument,
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
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument,
      };

      activate(mockContext);

      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      expect(mockPanel.onDidDispose).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Hot-Reload (onDidSaveTextDocument)', () => {
    it('should update panel when .tscn file is saved', () => {
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: mockDocument,
      };

      activate(mockContext);

      // Create panel first
      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      // Simulate file save
      saveDocumentHandlers.forEach((handler) => handler(mockDocument));

      expect(mockPanel.update).toHaveBeenCalledWith(mockDocument.uri);
    });

    it('should not update panel when non-.tscn file is saved', () => {
      const tscnDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      (vscode.window.activeTextEditor as any) = {
        document: tscnDocument,
      };

      activate(mockContext);

      // Create panel
      const commandHandler = commandHandlers.get('textscene.openPreviewToSide');
      commandHandler?.();

      // Save different file type
      const otherDocument = {
        uri: createMockUri('/workspace/other.txt'),
        fileName: '/workspace/other.txt',
      };

      saveDocumentHandlers.forEach((handler) => handler(otherDocument));

      expect(mockPanel.update).not.toHaveBeenCalled();
    });

    it('should not update if no panel exists for saved file', () => {
      activate(mockContext);

      // Save file without opening panel
      const mockDocument = {
        uri: createMockUri('/workspace/scene.tscn'),
        fileName: '/workspace/scene.tscn',
      };

      saveDocumentHandlers.forEach((handler) => handler(mockDocument));

      // Should not throw or crash
      expect(mockPanel.update).not.toHaveBeenCalled();
    });
  });

  describe('Resource Watcher', () => {
    it('creates the resource and project-file watchers once each and hands both to the diagnostics', () => {
      activate(mockContext);

      const createWatcher = vscode.workspace.createFileSystemWatcher as Mock;
      expect(createWatcher.mock.calls).toEqual([[RESOURCE_FILES_PATTERN], [PROJECT_FILE_PATTERN]]);
      const [resourceWatcher, projectFileWatcher] = createWatcher.mock.results.map((result) => result.value);
      expect(TscnDiagnostics).toHaveBeenCalledWith(resourceWatcher, projectFileWatcher);
    });

    it('routes a changed project file to the panel for re-fetch', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const projectUri = createMockUri('/workspace/project.godot');
      await fireChange(PROJECT_FILE_PATTERN, projectUri);

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(projectUri);
    });

    it('routes a deleted project file to the panel', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const projectUri = createMockUri('/workspace/project.godot');
      await fireDelete(PROJECT_FILE_PATTERN, projectUri);

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(projectUri);
    });

    it('routes a changed dependency to the panel for re-fetch', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const depUri = createMockUri('/workspace/textures/wood.png');
      await fireChange(RESOURCE_FILES_PATTERN, depUri);

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(depUri);
    });

    it("re-reads a panel's own main scene (external change) instead of treating it as a dependency", async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const mainUri = createMockUri('/workspace/scene.tscn');
      await fireChange(RESOURCE_FILES_PATTERN, mainUri);

      // An external edit to the main scene fires no save event, so the watcher
      // refreshes it through update(), never as a dependency.
      expect(mockPanel.update).toHaveBeenCalledWith(mainUri);
      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
    });

    it("refreshes the Scene Tree view when a panel's own main scene changes on disk", async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');
      const sceneTree = (SceneTreeView as unknown as Mock).mock.instances[0] as { refresh: Mock };

      await fireChange(RESOURCE_FILES_PATTERN, createMockUri('/workspace/scene.tscn'));

      // A closed document fires no edit, so only this refresh re-reads the scene.
      expect(sceneTree.refresh).toHaveBeenCalled();
    });

    it('leaves the Scene Tree view alone when a dependency changes on disk', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');
      const sceneTree = (SceneTreeView as unknown as Mock).mock.instances[0] as { refresh: Mock };

      await fireChange(RESOURCE_FILES_PATTERN, createMockUri('/workspace/textures/wood.png'));

      expect(sceneTree.refresh).not.toHaveBeenCalled();
    });

    it('routes a deleted dependency through handleDependencyChange (missing placeholder path)', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const depUri = createMockUri('/workspace/textures/wood.png');
      await fireDelete(RESOURCE_FILES_PATTERN, depUri);

      expect(mockPanel.handleDependencyChange).toHaveBeenCalledWith(depUri);
    });

    it('ignores deletion of the main scene so the panel silently holds its last render', async () => {
      activate(mockContext);
      openPanelFor('/workspace/scene.tscn');

      const mainUri = createMockUri('/workspace/scene.tscn');
      await fireDelete(RESOURCE_FILES_PATTERN, mainUri);

      // A deleted main scene cannot be re-read, so update() only raises a false
      // load-error toast (a branch switch or rename deletes for a moment). The
      // panel keeps its last render. Propagation to other panels is covered above.
      expect(mockPanel.update).not.toHaveBeenCalled();
      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
    });

    it('deletion of a file no panel cares about causes no invalidation', async () => {
      activate(mockContext);
      // No panel opened.

      const irrelevantUri = createMockUri('/workspace/other.png');
      await fireDelete(RESOURCE_FILES_PATTERN, irrelevantUri);

      expect(mockPanel.handleDependencyChange).not.toHaveBeenCalled();
      expect(mockPanel.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should dispose logger on deactivation', () => {
      deactivate();

      expect(logger.dispose).toHaveBeenCalled();
    });
  });
});
