/**
 * Which public/fixtures subtree a fixture file's res:// namespace maps onto
 * ('' = the fixtures root). Listed fixtures carry it in the manifest;
 * unlisted godot-demo subscenes (reachable via ?fixture= deep links — the
 * selector lists only each demo's main scene) derive it from their
 * demos/<top>/<project>/ path prefix.
 */
import type { Fixture } from './fixtures';

export function corpusRootFor(file: string, fixtures: readonly Fixture[]): string {
  const listed = fixtures.find((f) => f.file === file);
  if (listed) return listed.root ?? '';

  const demoMatch = /^(demos\/[^/]+\/[^/]+)\//.exec(file);
  return demoMatch ? demoMatch[1]! : '';
}

/**
 * Map a res:// URL onto the public fixtures mirror under the active corpus
 * root — the THREE LoadingManager URL modifier for text-glTF dependencies
 * (external .bin buffers, image files). glTF URIs arrive percent-encoded
 * (`textures%2Fgrass.webp`); the mirrored files use real separators, so
 * decode before mapping. Non-res URLs (blob:, already-mapped paths) pass
 * through untouched.
 */
export function fixtureUrlForRes(url: string, resourceRoot: string): string {
  if (!url.startsWith('res://')) return url;
  const prefix = resourceRoot ? `${resourceRoot}/` : '';
  let rest = url.slice('res://'.length);
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // Malformed escape — use the raw path.
  }
  return `/fixtures/${prefix}${rest}`;
}
