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
    vscode.commands.registerCommand('textscene.openPreviewToSide', () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.fileName.endsWith('.tscn')) {
        getOrCreatePanel(activeEditor.document.uri);
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
  const handleResourceChange = async (uri: vscode.Uri): Promise<void> => {
    const changedKey = uri.toString();
    await Promise.all(
      [...panels].map(([panelKey, panel]) => {
        if (panelKey === changedKey) {
          panel.update(uri);
          return Promise.resolve();
        }
        return panel.handleDependencyChange(uri);
      })
    );
  };

  context.subscriptions.push(
    resourceWatcher.onDidChange(handleResourceChange),
    resourceWatcher.onDidCreate(handleResourceChange),
    resourceWatcher.onDidDelete(handleResourceChange)
  );
}

export function deactivate() {
  disposeLogger();
}
