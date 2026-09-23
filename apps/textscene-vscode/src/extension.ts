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
    // `resource` is the file a menu hands over: the clicked file for
    // `explorer/context`, the tab's file for `editor/title`. It wins over the
    // focused file, and an explorer click on an unopened scene has no active editor.
    // Only the command palette passes nothing, and then the active editor decides.
    vscode.commands.registerCommand('textscene.openPreviewToSide', (resource?: unknown) => {
      // `isUri`, not truthiness: a keybinding or a task can pass a non-Uri, whose
      // `.fsPath` is `undefined` yet counts as handed a resource, previewing nothing.
      const clicked = isUri(resource) ? resource : undefined;
      const activeEditor = vscode.window.activeTextEditor;
      const target =
        clicked?.fsPath?.endsWith('.tscn') ? clicked
        : !clicked && activeEditor?.document.fileName.endsWith('.tscn') ?
          activeEditor.document.uri
        : undefined;

      if (target) {
        getOrCreatePanel(target);
      } else {
        vscode.window.showInformationMessage('Open a .tscn file to preview it.');
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'tscn' },
      new TscnDocumentSymbolProvider(),
      {
        label: 'TSCN Scene Hierarchy',
      }
    )
  );

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

  // Linter diagnostics in the Problems panel.
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
    false, // ignoreCreateEvents
    false, // ignoreChangeEvents
    false  // ignoreDeleteEvents
  );

  context.subscriptions.push(resourceWatcher);

  // The panel whose own main scene changed re-reads it, which catches an external
  // edit (git pull, branch switch) that fires no save event. The content-diff guard
  // in update() drops the in-editor save that onDidSaveTextDocument already
  // handled. Every other panel re-fetches the file as a dependency or sub-scene.
  const handleResourceChange = async (
    uri: vscode.Uri,
    deleted = false,
  ): Promise<void> => {
    const changedKey = uri.toString();
    await Promise.all(
      [...panels].map(([panelKey, panel]) => {
        if (panelKey === changedKey) {
          // A deleted main scene cannot be re-read, and update() then raises a false
          // "Failed to load" toast on a branch switch or rename. The panel keeps its
          // last render. Other panels flip the file to its missing placeholder.
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
