/**
 * VS Code extension for previewing .tscn files with three.js.
 */

import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { TscnDocumentSymbolProvider } from './TscnDocumentSymbolProvider';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
import { TscnDocumentLinkProvider } from './TscnDocumentLinkProvider';
import { TscnDiagnostics } from './TscnDiagnostics';
import { initLogger, dispose as disposeLogger } from './logger';
import { isUri } from './uriArgument';

export function activate(context: vscode.ExtensionContext) {
  initLogger('TextScene Inspector');

  const panels = new Map<string, TscnPreviewPanel>();

  const getOrCreatePanel = (resource: vscode.Uri): TscnPreviewPanel => {
    const key = resource.toString();
    let panel = panels.get(key);

    if (panel) {
      panel.reveal();
      return panel;
    }

    panel = TscnPreviewPanel.create(context.extensionUri, resource);
    panels.set(key, panel);

    panel.onDidDispose(() => {
      panels.delete(key);
    });

    return panel;
  };

  context.subscriptions.push(
    // Every contribution is gated on `resourceExtname`, so VS Code hands the
    // clicked file's URI — the explorer, the editor title and the tab context
    // menus all address a file that need not be the one the active editor
    // holds. The active editor is the fallback for the palette entry, which
    // passes nothing.
    vscode.commands.registerCommand('textscene.openPreviewToSide', (resource?: vscode.Uri) => {
      // `resource` is whatever VS Code hands the handler, which the signature
      // describes rather than enforces: an argument that is not a Uri falls
      // back to the active editor, the same path the palette entry takes,
      // rather than throwing out of the command.
      //
      // `scheme` as well as `fsPath`, because the panel map is keyed on
      // `toString()`: a bare `{ fsPath }` object passes an `fsPath`-only test
      // and then stringifies to `'[object Object]'`, so every such value
      // collides on ONE entry and the second preview steals the first's panel.
      // `instanceof Uri` is not available here — the mocked namespace is a plain
      // object, not a constructor — and keying on `fsPath` instead would merge
      // `file:///a.tscn` with `git:/a.tscn`, which are distinct panels today.
      const target = isUri(resource) ? resource : vscode.window.activeTextEditor?.document.uri;
      if (target?.fsPath?.endsWith('.tscn')) {
        getOrCreatePanel(target);
      } else {
        vscode.window.showInformationMessage('Open a .tscn file to preview it.');
      }
    })
  );

  // Register Document Symbol Provider for .tscn files
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'tscn' },
      new TscnDocumentSymbolProvider(),
      {
        label: 'TSCN Scene Hierarchy',
      }
    )
  );

  // Register Definition Provider for .tscn files
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'tscn' },
      new TscnDefinitionProvider()
    )
  );

  // Turn `res://` references into clickable links that open the target file.
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'tscn' },
      new TscnDocumentLinkProvider()
    )
  );

  // Surface linter diagnostics for .tscn documents (Problems panel)
  context.subscriptions.push(new TscnDiagnostics());

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

  // Watch for external resource file changes: materials (.tres), textures
  // (png/jpg/webp/svg), GLB/glTF meshes, and instanced sub-scenes (.tscn).
  const resourceWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{tres,png,jpg,jpeg,webp,svg,glb,gltf,tscn}',
    false, // Don't ignore creates
    false, // Don't ignore changes
    false  // Don't ignore deletes
  );

  context.subscriptions.push(resourceWatcher);

  // When a watched file changes, refresh each panel appropriately: the panel
  // whose OWN main scene changed re-reads it (catching external edits — git
  // pull, branch switch — that fire no save event; the content-diff guard in
  // update() dedups the in-editor save already handled by onDidSaveTextDocument),
  // while every other panel re-fetches it as a dependency or instanced sub-scene.
  //
  // A DELETE is the exception on the identity branch: the own main scene's file
  // is now gone, so routing it into update() -> _loadTscnContent would read the
  // missing file, throw, and surface a spurious "Failed to load" toast on an
  // ordinary branch switch / rename / delete. The panel keeps rendering its
  // last-loaded content instead; other panels still propagate the deletion as a
  // dependency change (flipping a vanished texture/.tres/sub-scene to its
  // missing placeholder).
  const handleResourceChange = async (
    uri: vscode.Uri,
    deleted = false,
  ): Promise<void> => {
    const changedKey = uri.toString();
    await Promise.all(
      [...panels].map(([panelKey, panel]) => {
        if (panelKey === changedKey) {
          if (!deleted) {
            panel.update(uri);
          }
          return Promise.resolve();
        }
        return panel.handleDependencyChange(uri);
      })
    );
  };

  context.subscriptions.push(
    resourceWatcher.onDidChange(handleResourceChange),
    resourceWatcher.onDidCreate(handleResourceChange),
    resourceWatcher.onDidDelete((uri) => handleResourceChange(uri, true))
  );
}

export function deactivate() {
  disposeLogger();
}
