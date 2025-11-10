/**
 * VS Code extension for previewing .tscn files with three.js.
 */

import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { TscnDocumentSymbolProvider } from './TscnDocumentSymbolProvider';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
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

  // Watch for external resource file changes (textures, materials, external scenes)
  const resourceWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{tres,png,jpg,jpeg,svg,tscn}',
    false, // Don't ignore creates
    false, // Don't ignore changes
    false  // Don't ignore deletes
  );

  context.subscriptions.push(resourceWatcher);

  // When a resource file changes, update all panels (they will do incremental updates if possible)
  const handleResourceChange = async (uri: vscode.Uri) => {
    // Skip .tscn files that are main scene files (already handled by onDidSaveTextDocument)
    for (const panelUri of panels.keys()) {
      if (panelUri === uri.toString()) {
        continue; // This is a main scene file, already handled
      }
    }

    // Update all panels - they will only reload if they reference this resource
    // The incremental update system will minimize the cost of checking
    for (const panel of panels.values()) {
      panel.update(panel.resource);
    }
  };

  context.subscriptions.push(
    resourceWatcher.onDidChange(handleResourceChange),
    resourceWatcher.onDidCreate(handleResourceChange)
  );
}

export function deactivate() {
  disposeLogger();
}
