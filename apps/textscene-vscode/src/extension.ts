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
}

export function deactivate() {
  disposeLogger();
}
