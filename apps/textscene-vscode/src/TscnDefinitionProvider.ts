/**
 * Go to Definition for `.tscn` files: a resource id goes to the heading that declares it, a node
 * path to the `[node]` heading it names, and a `res://` path to the file it names. The engine
 * finds all three, so the answer matches the `tscn-lsp` server's.
 */

import * as vscode from 'vscode';
import { definitionRangeAt, resPathAt } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';
import type { WorkspaceResRoots } from './resRoots/workspaceResRoots';

export class TscnDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly roots: WorkspaceResRoots) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location | null> {
    const model = languageDocumentOf(document);
    const declaration = definitionRangeAt(model, position);
    if (declaration) return new vscode.Location(document.uri, toVscodeRange(declaration));

    const occurrence = resPathAt(model, position);
    if (!occurrence) return null;
    const root = await this.roots.rootOf(document.uri);
    const file = await root?.existingFile(occurrence.path);
    return file ? new vscode.Location(file, new vscode.Position(0, 0)) : null;
  }
}
