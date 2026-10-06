/**
 * Which scene the Scene Tree view shows: the scene of the active preview, or else of the
 * active `.tscn` text editor.
 */

import type * as vscode from 'vscode';

/** What the view reads from a preview. `TscnPreviewPanel` satisfies it. */
export interface ScenePreview {
  readonly resource: vscode.Uri;
  readonly isActive: boolean;
}

/**
 * Undefined when neither a preview nor a `.tscn` text editor is the active editor, as the
 * Outline goes empty for an editor it cannot read.
 */
export function activeScene(
  previews: Iterable<ScenePreview>,
  editor: vscode.TextEditor | undefined
): vscode.Uri | undefined {
  for (const preview of previews) {
    if (preview.isActive) return preview.resource;
  }
  const uri = editor?.document.uri;
  return uri?.path.endsWith('.tscn') ? uri : undefined;
}
