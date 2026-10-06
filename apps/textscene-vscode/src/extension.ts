/**
 * VS Code extension for previewing .tscn files with three.js.
 */

import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { TscnDocumentSymbolProvider } from './TscnDocumentSymbolProvider';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
import { TscnDocumentLinkProvider } from './TscnDocumentLinkProvider';
import { TscnHoverProvider } from './TscnHoverProvider';
import { COMPLETION_TRIGGER_CHARACTERS } from '@textscene/core/languageFeatures';
import { TscnCompletionItemProvider } from './TscnCompletionItemProvider';
import { TscnCodeActionProvider } from './TscnCodeActionProvider';
import { TscnFoldingRangeProvider } from './TscnFoldingRangeProvider';
import { TscnDocumentHighlightProvider } from './TscnDocumentHighlightProvider';
import { TscnResPathListing } from './TscnResPathListing';
import { registerTscnTools } from './tools/registerTscnTools';
import { TscnDiagnostics } from './TscnDiagnostics';
import { SceneTreeView } from './sceneTree/SceneTreeView';
import { initLogger, dispose as disposeLogger } from './logger';
import { isUri } from './uriArgument';
import { PROJECT_FILE_PATTERN, RESOURCE_FILES_PATTERN, SCAN_STOP_FILES_PATTERN } from './watchPatterns';

export function activate(context: vscode.ExtensionContext) {
  initLogger('TextScene Inspector');

  const panels = new Map<string, TscnPreviewPanel>();
  const sceneTree = new SceneTreeView(panels);
  context.subscriptions.push(sceneTree);

  const getOrCreatePanel = (resource: vscode.Uri): TscnPreviewPanel => {
    const key = resource.toString();
    let panel = panels.get(key);

    if (panel) {
      panel.reveal();
      return panel;
    }

    panel = TscnPreviewPanel.create(context.extensionUri, resource);
    panels.set(key, panel);

    panel.onDidChangeViewState(() => sceneTree.refresh());
    panel.onDidDispose(() => {
      panels.delete(key);
      sceneTree.refresh();
    });

    return panel;
  };

  context.subscriptions.push(
    // `resource` is the file a menu hands over: the clicked file for
    // `explorer/context`, the tab's file for `editor/title`. It wins over the
    // focused file, and an explorer click on an unopened scene has no active editor.
    // Only the command palette passes nothing, and then the active editor decides.
    vscode.commands.registerCommand('textscene.openPreviewToSide', (resource?: unknown) => {
      // `isUri`, not truthiness: a keybinding or a task can pass a non-Uri, whose
      // `.fsPath` is `undefined` yet counts as handed a resource, previewing nothing.
      const clicked = isUri(resource) ? resource : undefined;
      const activeEditor = vscode.window.activeTextEditor;
      const target = clicked?.fsPath?.endsWith('.tscn')
        ? clicked
        : !clicked && activeEditor?.document.fileName.endsWith('.tscn')
          ? activeEditor.document.uri
          : undefined;

      if (target) {
        getOrCreatePanel(target);
      } else {
        vscode.window.showInformationMessage('Open a .tscn file to preview it.');
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider({ language: 'tscn' }, new TscnDocumentSymbolProvider(), {
      label: 'TSCN Scene Hierarchy',
    })
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: 'tscn' }, new TscnDefinitionProvider())
  );

  // Turn `res://` references into clickable links that open the target file.
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider({ language: 'tscn' }, new TscnDocumentLinkProvider())
  );

  const resPathListing = new TscnResPathListing();
  context.subscriptions.push(...registerLanguageFeatureProviders(resPathListing));

  // External changes to every file a scene can load, and to the project file. Each watcher
  // serves the previews and the linter diagnostics in the Problems panel.
  const resourceWatcher = vscode.workspace.createFileSystemWatcher(RESOURCE_FILES_PATTERN);
  const projectFileWatcher = vscode.workspace.createFileSystemWatcher(PROJECT_FILE_PATTERN);
  const diagnostics = new TscnDiagnostics(resourceWatcher, projectFileWatcher);

  registerTscnTools(context, {
    openPreview: (uri) => void getOrCreatePanel(uri),
    capturePreview: (uri) => getOrCreatePanel(uri).capture(),
    lintProviderFor: (uri) => diagnostics.providerFor(uri),
  });

  context.subscriptions.push(resourceWatcher, projectFileWatcher, diagnostics);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.fileName.endsWith('.tscn')) {
        const panel = panels.get(document.uri.toString());
        if (panel) {
          panel.update(document.uri);
        }
      }
    })
  );

  // The panel whose own main scene changed re-reads it, which catches an external
  // edit (git pull, branch switch) that fires no save event. The content-diff guard
  // in update() drops the in-editor save that onDidSaveTextDocument already
  // handled. The Scene Tree view re-reads it too, as a closed document fires no edit.
  // Every other panel re-fetches the file as a dependency or sub-scene.
  const handleResourceChange = async (uri: vscode.Uri, deleted = false): Promise<void> => {
    const changedKey = uri.toString();
    await Promise.all(
      [...panels].map(([panelKey, panel]) => {
        if (panelKey === changedKey) {
          // A deleted main scene cannot be re-read, and update() then raises a false
          // "Failed to load" toast on a branch switch or rename. The panel keeps its
          // last render. Other panels flip the file to its missing placeholder.
          if (!deleted) {
            panel.update(uri);
            sceneTree.refresh();
          }
          return Promise.resolve();
        }
        return panel.handleDependencyChange(uri);
      })
    );
  };

  for (const watcher of [resourceWatcher, projectFileWatcher]) {
    context.subscriptions.push(
      watcher.onDidChange(handleResourceChange),
      // A created or deleted file changes what `res://` completion may offer. An edit does not.
      watcher.onDidCreate((uri) => {
        resPathListing.clear();
        return handleResourceChange(uri);
      }),
      watcher.onDidDelete((uri) => {
        resPathListing.clear();
        return handleResourceChange(uri, true);
      })
    );
  }

  context.subscriptions.push(...watchScanStopFiles(resPathListing));
}

/**
 * The providers over `@textscene/core/languageFeatures`, the engine the standalone
 * `tscn-lsp` server uses too, so both hosts give the same answers.
 */
function registerLanguageFeatureProviders(resPathListing: TscnResPathListing): vscode.Disposable[] {
  return [
    vscode.languages.registerHoverProvider({ language: 'tscn' }, new TscnHoverProvider()),
    vscode.languages.registerCompletionItemProvider(
      { language: 'tscn' },
      new TscnCompletionItemProvider(resPathListing),
      ...COMPLETION_TRIGGER_CHARACTERS
    ),
    vscode.languages.registerCodeActionsProvider({ language: 'tscn' }, new TscnCodeActionProvider(), {
      providedCodeActionKinds: TscnCodeActionProvider.prototype.providedCodeActionKinds,
    }),
    vscode.languages.registerFoldingRangeProvider({ language: 'tscn' }, new TscnFoldingRangeProvider()),
    vscode.languages.registerDocumentHighlightProvider(
      { language: 'tscn' },
      new TscnDocumentHighlightProvider()
    ),
  ];
}

/** A `.gdignore` created or deleted moves a directory into or out of the scan the listing follows. */
function watchScanStopFiles(resPathListing: TscnResPathListing): vscode.Disposable[] {
  const watcher = vscode.workspace.createFileSystemWatcher(SCAN_STOP_FILES_PATTERN, false, true);
  return [
    watcher,
    watcher.onDidCreate(() => resPathListing.clear()),
    watcher.onDidDelete(() => resPathListing.clear()),
  ];
}

export function deactivate() {
  disposeLogger();
}
