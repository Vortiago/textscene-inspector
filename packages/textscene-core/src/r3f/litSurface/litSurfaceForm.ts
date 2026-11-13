/**
 * The one switch that names the form of the lit surface (ADR-0055): `patched` draws through the
 * classic materials and their shader patches, `nodes` through the node materials of `shaders/`.
 * A page picks `nodes` with `?litSurface=nodes`. The VS Code webview has no such parameter, so it
 * draws `patched` until the port makes `nodes` the default (#1459).
 */

export type LitSurfaceForm = 'patched' | 'nodes';

/** The form a page's query names. Every value but `nodes`, and no parameter, is `patched`. */
function litSurfaceFormOf(search: string): LitSurfaceForm {
  return new URLSearchParams(search).get('litSurface') === 'nodes' ? 'nodes' : 'patched';
}

/**
 * Read once, when the module loads, because the web host rewrites the query when it opens a scene
 * (`useFixtureSelection`). Outside a browser there is no query, so the form is `patched`.
 */
const LOADED_FORM: LitSurfaceForm =
  typeof window === 'undefined' ? 'patched' : litSurfaceFormOf(window.location.search);

export function litSurfaceForm(): LitSurfaceForm {
  return LOADED_FORM;
}
