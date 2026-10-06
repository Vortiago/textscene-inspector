/**
 * Which scene the Scene Tree view shows: the scene of the active preview, or else of the
 * active `.tscn` text editor.
 */

import type * as vscode from 'vscode';

/** Any case, as Godot compares an extension with `nocasecmp_to` (resource_loader.cpp:73). */
const SCENE_EXTENSION = /\.tscn$/i;

/** What the view reads from a preview. `TscnPreviewPanel` satisfies it. */
export interface ScenePreview {
  readonly resource: vscode.Uri;
  readonly isActive: boolean;
  /** Where a clicked node's text opens beside, never over. */
  readonly viewColumn: vscode.ViewColumn | undefined;
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
  return uri && SCENE_EXTENSION.test(uri.path) ? uri : undefined;
}
