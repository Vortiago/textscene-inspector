/**
 * Lists the `res://` resources a scene references but its `res://` root does not hold. The
 * paths come from the parsed scene's `[ext_resource]` headings, and the Problems panel's
 * provider checks each one, so the tool and the panel give one verdict.
 */

import { TscnParser } from '@textscene/core/parser';
import type { LintResourceProvider } from '../LintResourceProvider';

/** Every `res://` path the scene names that no file answers. Empty when all are present, or with no provider. */
export async function missingResourcePaths(
  provider: LintResourceProvider | null,
  content: string
): Promise<readonly string[]> {
  if (!provider) return [];
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
