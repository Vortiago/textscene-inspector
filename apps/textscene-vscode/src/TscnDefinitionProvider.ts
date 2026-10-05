/**
 * Go to Definition for `.tscn` files: a resource id goes to the heading that declares it, and a
 * `res://` path to the project file it names. The engine finds both, so the answer matches the
 * `tscn-lsp` server's.
 */

import * as vscode from 'vscode';
import { declarationRangeAt, resPathAt } from '@textscene/core/languageFeatures';
import { existingResFile } from './existingResFile';
import { findGodotProjectRoot } from './findGodotProjectRoot';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';

/** The project file a `res://` path names, or null outside a workspace folder or for no file. */
async function projectFileOf(document: vscode.TextDocument, path: string): Promise<vscode.Uri | null> {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return null;
  return existingResFile(await findGodotProjectRoot(folder.uri, document.uri), path);
}

export class TscnDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location | null> {
    const model = languageDocumentOf(document);
    const declaration = declarationRangeAt(model, position);
    if (declaration) return new vscode.Location(document.uri, toVscodeRange(declaration));

    const occurrence = resPathAt(model, position);
    const file = occurrence && (await projectFileOf(document, occurrence.path));
    return file ? new vscode.Location(file, new vscode.Position(0, 0)) : null;
  }
}
