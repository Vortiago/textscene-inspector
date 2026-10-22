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
 * The disk text of the file at `path` under `root`, or null for a file that went away since the listing or one the
 * host may not read. It reads through `workspace.fs` and not `readWorkspaceFile`: that refuses a link or a large file
 * to guard what the webview receives, and this read returns only positions.
 */
async function readFileText(root: vscode.Uri, path: string): Promise<string | null> {
  const file = resPathUri(root, path);
  if (file === null) return null;
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
  } catch {
    // A file that went away since the listing, or one the host may not read, holds no reference to report.
    return null;
  }
}

/** The open editors' documents by URI, taken once per request. */
function openDocumentsByUri(): ReadonlyMap<string, vscode.TextDocument> {
  return new Map(vscode.workspace.textDocuments.map((document) => [document.uri.toString(), document]));
}

export class TscnReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly pathListing: ResPathListing) {}

  /**
   * The occurrence under the cursor is one of the references when its file is in the listing, so the context's
   * `includeDeclaration` is not read. The listing leaves out what Godot's editor scan leaves out: a dot-named
   * directory (`editor_file_system.cpp:1161-1164`), and one that holds a `project.godot` or a `.gdignore`
   * (`editor_file_system.cpp:3466-3478`). A file there reports none.
   */
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[]> {
    const root = await resRootOf(document.uri);
    if (root === null) return [];
    const openDocuments = openDocumentsByUri();
    const references = await resPathReferencesAt(languageDocumentOf(document), position, {
      listPaths: () => this.pathListing.pathsFor(document),
      openText: (path) => {
        const file = resPathUri(root, path);
        return file === null ? undefined : openDocuments.get(file.toString())?.getText();
      },
      readFile: (path) => readFileText(root, path),
      isCancelled: () => token.isCancellationRequested,
    });
    return references.flatMap(({ file, range }) => {
      const uri = resPathUri(root, file);
      return uri === null ? [] : [new vscode.Location(uri, toVscodeRange(range))];
    });
  }
}
