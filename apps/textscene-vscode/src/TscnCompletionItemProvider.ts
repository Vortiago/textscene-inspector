/**
 * Completions for `.tscn` files: class names, property keys, enum values, resource
 * ids and `res://` paths. The engine computes them. This maps the host-neutral items
 * to VS Code's, and supplies the workspace's path listing through the engine's seam.
 */

import * as vscode from 'vscode';
import {
  COMPLETION_TRIGGER_CHARACTERS,
  completionsAt,
  type CompletionItem as EngineCompletionItem,
  type CompletionKind,
} from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';

/** The icon for each engine completion kind. A `Record`, so a new kind does not compile until it has one. */
const COMPLETION_KIND: Record<CompletionKind, vscode.CompletionItemKind> = {
  nodeType: vscode.CompletionItemKind.Class,
  resourceType: vscode.CompletionItemKind.Struct,
  property: vscode.CompletionItemKind.Property,
  value: vscode.CompletionItemKind.Value,
  resourceId: vscode.CompletionItemKind.Reference,
  path: vscode.CompletionItemKind.File,
  nodeName: vscode.CompletionItemKind.Reference,
};

function toCompletionItem(item: EngineCompletionItem): vscode.CompletionItem {
  const completion = new vscode.CompletionItem(item.label, COMPLETION_KIND[item.kind]);
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
    const listing = this.pathListing;
    const items = await completionsAt(
      languageDocumentOf(document),
      position,
      listing ? { listPaths: () => listing.pathsFor(document) } : undefined
    );
    return items.map(toCompletionItem);
  }
}
