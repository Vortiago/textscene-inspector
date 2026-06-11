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
