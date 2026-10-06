/**
 * Lists the `res://` resources a scene references but the project does not hold. The
 * paths come from the parsed scene's `[ext_resource]` headings, and each is checked
 * under the Godot project root, as the preview's Resources tab resolves them.
 */

import * as vscode from 'vscode';
import { TscnParser } from '@textscene/core/parser';
import { findGodotProjectRoot } from '../findGodotProjectRoot';
import { LintResourceProvider } from '../LintResourceProvider';

/** Every `res://` path the scene names that no file answers. Empty when all are present. */
export async function missingResourcePaths(uri: vscode.Uri, content: string): Promise<readonly string[]> {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return [];

  // The preview's root, not the linter's: it falls back to the workspace root outside a project.
  const provider = new LintResourceProvider(await findGodotProjectRoot(folder.uri, uri));
  const paths = new TscnParser().parse(content).externalResources.map((resource) => resource.path);
  // A stamp is one `stat`, and null for a missing file or a path outside the root.
  const stamps = await Promise.all(paths.map((path) => provider.stamp(path)));
  return paths.filter((_, index) => stamps[index] === null);
}

/** The missing-resource answer as plain text. */
export function formatMissingResources(fileName: string, paths: readonly string[]): string {
  if (paths.length === 0) return `${fileName}: every referenced resource is present.`;
  return `${fileName}: ${paths.length} missing resource(s):\n  ${paths.join('\n  ')}`;
}
