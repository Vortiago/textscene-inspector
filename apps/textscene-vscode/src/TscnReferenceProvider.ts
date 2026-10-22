/**
 * Find All References on a `res://` path in a `.tscn` or `.tres`. The engine matches the path. This lists the files
 * under the document's `res://` root, reads each one, and maps each match to a location in the file that holds it.
 */

import * as vscode from 'vscode';
import { resPathReferencesAt } from '@textscene/core/languageFeatures';
import { resPathUri } from './existingResFile';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';
import { resRootOf } from './resRoot';
import type { ResPathListing } from './TscnResPathListing';

/**
 * A reader of the files under `root` that serves an open editor's text in place of its file's: a range from the file's
 * text would land on the wrong line in the editor. It reads the open editors once, when it is made.
 * It reads through `workspace.fs` and not `readWorkspaceFile`: that refuses a link or a large file to guard what the
 * webview receives, and this read returns only positions.
 */
function textReaderWithOpenDocuments(root: vscode.Uri): (path: string) => Promise<string | null> {
  const openTexts = new Map(
    vscode.workspace.textDocuments.map((document) => [document.uri.toString(), document.getText()])
  );
  return async (path) => {
    const file = resPathUri(root, path);
    if (file === null) return null;
    const open = openTexts.get(file.toString());
    if (open !== undefined) return open;
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
    } catch {
      // A file that went away since the listing, or one the host may not read, holds no reference to report.
      return null;
    }
  };
}

export class TscnReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly pathListing: ResPathListing) {}

  /** The context's `includeDeclaration` is ignored: the occurrence under the cursor is always one of the references. */
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location[]> {
    const root = await resRootOf(document.uri);
    if (root === null) return [];
    const references = await resPathReferencesAt(languageDocumentOf(document), position, {
      listPaths: () => this.pathListing.pathsFor(document),
      readText: textReaderWithOpenDocuments(root),
    });
    return references.flatMap(({ file, range }) => {
      const uri = resPathUri(root, file);
      return uri === null ? [] : [new vscode.Location(uri, toVscodeRange(range))];
    });
  }
}
