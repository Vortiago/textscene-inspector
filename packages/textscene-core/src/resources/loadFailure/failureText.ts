/** The words the preview shows for a file Godot fails to load. */

import type { ParsedScene } from '../../core/SceneGraph';
import { simplifyResPath } from '../../godot/string/string';

/** The error Godot's loader prints for the read of `read` in `scene` (resource_format_text.cpp:152, variant_parser.cpp:1171). */
export function godotFailureLine(
  scene: Pick<ParsedScene, 'path' | 'externalResources'>,
  read: string
): string {
  const isExtResource = scene.externalResources.some((ext) => simplifyResPath(ext.path) === read);
  const message = isExtResource
    ? `[ext_resource] referenced non-existent resource at: ${read}`
    : `Can't load resource at path: ${read} with uid: `;
  return `${scene.path}: ${message}`;
}

export function failureChainText(chain: readonly string[], cause: 'missing' | 'unparsed'): string {
  return `${chain.join(' → ')} (${cause === 'missing' ? 'missing' : 'does not parse'})`;
}
