import type { ScopedReference } from '../../reading';

/** A sampler's resource, or a sampler array's with null for an empty element. */
export type ShaderTextureReference = ScopedReference | readonly (ScopedReference | null)[];

/** A ShaderMaterial's shader text and its `shader_parameter/*` values. */
export interface ShaderText {
  code: string;
  /** The shader's address, which a fault names: a path, `path::id`, or the scene's own reference. */
  file: string;
  /** Each `shader_parameter/<name>` the file writes as a Variant, by name, in the file's text. */
  parameters: Readonly<Record<string, string>>;
  /** Each `shader_parameter/<name>` the file writes as a resource or as an array of them, by name. */
  textures: Readonly<Record<string, ShaderTextureReference>>;
}
