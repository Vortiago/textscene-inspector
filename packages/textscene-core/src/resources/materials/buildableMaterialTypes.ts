/**
 * The material resource types a mesh file's surface may name by a **Sub-resource path**, which
 * `materialPathInFile` gates on. THREE-free, so the decoders that read it do not import the renderer.
 */
export const BUILDABLE_MATERIAL_TYPES: ReadonlySet<string> = new Set([
  'StandardMaterial3D',
  'ShaderMaterial',
]);
