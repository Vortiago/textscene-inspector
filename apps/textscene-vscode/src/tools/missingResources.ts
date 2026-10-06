/**
 * Lists the `res://` resources a scene references but its `res://` root does not hold. The
 * paths come from the parsed scene's `[ext_resource]` headings, and each is checked under the
 * root the links and the linter read: the Godot project, or the scene's own directory.
 */

import * as vscode from 'vscode';
import { TscnParser } from '@textscene/core/parser';
import { resRootOf } from '../resRoot';
import { LintResourceProvider } from '../LintResourceProvider';

/**
 * Every `res://` path the scene names that no file answers. Empty when all are present, or outside every workspace
 * folder.
 */
export async function missingResourcePaths(uri: vscode.Uri, content: string): Promise<readonly string[]> {
  const root = await resRootOf(uri);
  if (!root) return [];

  const provider = new LintResourceProvider(root);
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
