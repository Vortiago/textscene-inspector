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
import { readSceneText } from './tools/toolInput';
import type { ResPathListing } from './TscnResPathListing';

/**
 * The text of the file at `path` under `root`, an open editor's unsaved text first, as {@link readSceneText} reads it:
 * a range from the file's text would land on the wrong line in the editor. It does not use `readWorkspaceFile`: that
 * refuses a link or a large file to guard what the webview receives, and this read returns only positions.
 */
async function readReferenceText(root: vscode.Uri, path: string): Promise<string | null> {
  const file = resPathUri(root, path);
  if (file === null) return null;
  try {
    return await readSceneText(file);
  } catch {
    // A file that went away since the listing, or one the host may not read, holds no reference to report.
    return null;
  }
}

export class TscnReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly pathListing: ResPathListing) {}

  /** The occurrence under the cursor is always one of the references, so the context's `includeDeclaration` is not read. */
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location[]> {
    const root = await resRootOf(document.uri);
    if (root === null) return [];
    const references = await resPathReferencesAt(languageDocumentOf(document), position, {
      listPaths: () => this.pathListing.pathsFor(document),
      readText: (path) => readReferenceText(root, path),
    });
    return references.flatMap(({ file, range }) => {
      const uri = resPathUri(root, file);
      return uri === null ? [] : [new vscode.Location(uri, toVscodeRange(range))];
    });
  }
}
