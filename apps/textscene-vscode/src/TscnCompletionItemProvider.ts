/**
 * Completions for `.tscn` files: class names, property keys, enum values, resource
 * ids and `res://` paths. The engine computes them; this maps the host-neutral items
 * to VS Code's, and supplies the workspace's path listing through the engine's seam.
 */

import * as vscode from 'vscode';
import {
  completionsAt,
  createLanguageDocument,
  type CompletionItem as EngineCompletionItem,
  type CompletionKind,
} from '@textscene/core/languageFeatures';
import { toEnginePosition } from './languageFeatureRanges';

/** The trigger characters: a quote opens a class or a path, `=` a value, the rest a key or an id. */
export const COMPLETION_TRIGGER_CHARACTERS = ['"', '=', '.', '/', '('];

function vscodeKind(kind: CompletionKind): vscode.CompletionItemKind {
  switch (kind) {
    case 'nodeType':
      return vscode.CompletionItemKind.Class;
    case 'resourceType':
      return vscode.CompletionItemKind.Struct;
    case 'property':
      return vscode.CompletionItemKind.Property;
    case 'value':
      return vscode.CompletionItemKind.Value;
    case 'resourceId':
      return vscode.CompletionItemKind.Reference;
    case 'path':
      return vscode.CompletionItemKind.File;
    case 'nodeName':
      return vscode.CompletionItemKind.Reference;
  }
}

function toCompletionItem(item: EngineCompletionItem): vscode.CompletionItem {
  const completion = new vscode.CompletionItem(item.label, vscodeKind(item.kind));
  if (item.detail) completion.detail = item.detail;
  if (item.documentation) completion.documentation = new vscode.MarkdownString(item.documentation);
  if (item.insertText) completion.insertText = item.insertText;
  if (item.deprecated) completion.tags = [vscode.CompletionItemTag.Deprecated];
  return completion;
}

/** Lists the Godot project's `res://` paths, the seam the engine's path completion reads. */
export interface ResPathListing {
  pathsFor(document: vscode.TextDocument): Promise<readonly string[]>;
}

export class TscnCompletionItemProvider implements vscode.CompletionItemProvider {
  readonly triggerCharacters = COMPLETION_TRIGGER_CHARACTERS;

  constructor(private readonly pathListing?: ResPathListing) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const engine = createLanguageDocument(document.getText());
    const paths = await this.pathListing?.pathsFor(document);
    const items = completionsAt(
      engine,
      toEnginePosition(position),
      paths ? { listPaths: () => paths } : undefined
    );
    return items.map(toCompletionItem);
  }
}
