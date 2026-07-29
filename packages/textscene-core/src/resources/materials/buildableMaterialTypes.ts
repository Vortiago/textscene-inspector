/**
 * The material resource types `createMaterialFromContent` can build.
 *
 * Its own guard reads this, so anything absent here fails there — which makes the
 * set the single answer to "is it worth addressing this material at all?". A
 * producer that minted an address for a type the pipeline cannot build would put a
 * permanent missing-resources row in front of the user for a file that is present
 * and correct, so producers ask this before minting.
 *
 * Deliberately THREE-free: the decoders that consult it must not pull the renderer
 * into their import graph.
 */
export const BUILDABLE_MATERIAL_TYPES: ReadonlySet<string> = new Set([
  'StandardMaterial3D',
  'ShaderMaterial',
]);
