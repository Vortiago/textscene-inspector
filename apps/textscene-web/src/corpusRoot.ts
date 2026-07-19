/**
 * The corpus ↔ `res://` boundary for the web previewer, in one place. A fixture
 * file's `res://` namespace maps onto a public/fixtures subtree (the **Corpus
 * root**); this module owns the derivation (`corpusRootFor`), the bijection
 * between a `res://` path and its fixtures file (`resToFixtureFile` /
 * `fixtureFileToRes`), and the fetch-URL deriver (`fixtureUrlForRes` /
 * `fixtureUrlForGltfUri`).
 */
import type { Fixture } from './fixtures';

/**
 * Which public/fixtures subtree a fixture file's res:// namespace maps onto
 * ('' = the fixtures root). Listed fixtures carry it in the manifest;
 * unlisted subscenes (reachable via ?fixture= deep links — the selector lists
 * only each demo's main scene, and skips games' addons/ editor scenes) derive
 * it from their corpus path prefix: demos/<top>/<project>/ or games/<dir>/.
 */
export function corpusRootFor(file: string, fixtures: readonly Fixture[]): string {
  const listed = fixtures.find((f) => f.file === file);
  if (listed) return listed.root ?? '';

  const demoMatch = /^(demos\/[^/]+\/[^/]+)\//.exec(file);
  if (demoMatch) return demoMatch[1]!;

  const gameMatch = /^(games\/[^/]+)\//.exec(file);
  return gameMatch ? gameMatch[1]! : '';
}

/**
 * Map a `res://` path onto its fixtures file under the active corpus root:
 * `res://X` + root `R` → `R/X` (or `X` at the fixtures root). A path without the
 * `res://` scheme is prefixed as-is — the "open sub-scene standalone" affordance
 * passes an instance's `res://` path or a bare fixture path.
 */
export function resToFixtureFile(scenePath: string, resourceRoot: string): string {
  const rest = scenePath.startsWith('res://') ? scenePath.slice('res://'.length) : scenePath;
  return resourceRoot ? `${resourceRoot}/${rest}` : rest;
}

/**
 * The inverse of {@link resToFixtureFile}: a fixtures file's `res://` identity.
 * `R/X` + root `R` → `res://X`; a file outside the active root keeps its whole
 * path (an **Uploaded scene** lives in the base '' corpus).
 */
export function fixtureFileToRes(file: string, resourceRoot: string): string {
  const relative =
    resourceRoot && file.startsWith(`${resourceRoot}/`)
      ? file.slice(resourceRoot.length + 1)
      : file;
  return `res://${relative}`;
}

/**
 * Map a raw `res://` path onto the public fixtures mirror under the active corpus
 * root. For paths extracted by the parser (real directory separators). Non-res
 * URLs (blob:, already-mapped paths) pass through untouched.
 */
export function fixtureUrlForRes(url: string, resourceRoot: string): string {
  if (!url.startsWith('res://')) return url;
  return `/fixtures/${resToFixtureFile(url, resourceRoot)}`;
}

/**
 * Like {@link fixtureUrlForRes}, but for a percent-encoded glTF dependency URI —
 * the THREE LoadingManager URL modifier for text-glTF dependencies (external
 * .bin buffers, image files). glTF URIs arrive percent-encoded
 * (`textures%2Fgrass.webp`); the mirrored files use real separators, so decode
 * the `res://` remainder before mapping.
 */
export function fixtureUrlForGltfUri(uri: string, resourceRoot: string): string {
  if (!uri.startsWith('res://')) return uri;
  let rest = uri.slice('res://'.length);
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // Malformed escape — use the raw path.
  }
  // The decoded remainder is a bare fixtures-relative path; reuse the one mapping.
  return `/fixtures/${resToFixtureFile(rest, resourceRoot)}`;
}
