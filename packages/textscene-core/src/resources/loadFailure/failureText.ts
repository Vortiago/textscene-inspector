/** The words the preview shows for a file Godot fails to load. */

import type { ParsedScene } from '../../core/SceneGraph';
import { extResourcePathIn } from './failingReads';
import type { LoadFailureCause } from './loadOutcome';

/**
 * The error Godot prints for the read of `read` in `scene`, less its line number: an ext_resource
 * (resource_format_text.cpp:40, :152), else a `Resource()` literal in a [node] (:291).
 */
export function godotFailureLine(
  scene: Pick<ParsedScene, 'path' | 'externalResources'>,
  read: string
): string {
  const isExtResource = scene.externalResources.some(
    (ext) => extResourcePathIn(scene.path, ext.path) === read
  );
  return isExtResource
    ? `${scene.path} - Parse Error: [ext_resource] referenced non-existent resource at: ${read}.`
    : `Parse Error: Parse error. [Resource file ${scene.path}]`;
}

const CAUSE_TEXT: Record<LoadFailureCause, string> = {
  missing: 'missing',
  unparsed: 'does not parse',
  unimported: 'does not import',
};

export function failureChainText(chain: readonly string[], cause: LoadFailureCause): string {
  return `${chain.join(' → ')} (${CAUSE_TEXT[cause]})`;
}
