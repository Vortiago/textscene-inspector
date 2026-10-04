/**
 * Lists the `res://` resources a scene references but the project does not hold. The
 * paths come from the parsed scene's `[ext_resource]` headings, and each is checked
 * under the Godot project root, as the preview's Resources tab resolves them.
 */

import * as vscode from 'vscode';
import { TscnParser } from '@textscene/core/parser';
import { resRelativePath } from '@textscene/core/resources/resPath';
import { findGodotProjectRoot } from '../findGodotProjectRoot';

/** Every `res://` path the scene names that no file answers. Empty when all are present. */
export async function missingResourcePaths(uri: vscode.Uri, content: string): Promise<readonly string[]> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return [];

  const root = await findGodotProjectRoot(folder.uri, uri);
  const scene = new TscnParser().parse(content);
  const missing: string[] = [];
  for (const resource of scene.externalResources) {
    const relative = resRelativePath(resource.path);
    if (relative === null) {
      missing.push(resource.path);
      continue;
    }
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, ...relative.split(/[\\/]/)));
    } catch {
      missing.push(resource.path);
    }
  }
  return missing;
}

/** The missing-resource answer as plain text. */
export function formatMissingResources(fileName: string, paths: readonly string[]): string {
  if (paths.length === 0) return `${fileName}: every referenced resource is present.`;
  return `${fileName}: ${paths.length} missing resource(s):\n  ${paths.join('\n  ')}`;
}
