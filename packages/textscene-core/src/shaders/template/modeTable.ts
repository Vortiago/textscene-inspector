/**
 * What a renderer tells Godot's shader compiler about one shader type
 * (`ShaderCompiler::DefaultIdentifierActions`, `servers/rendering/shader_compiler.h`): the GLSL
 * text each built-in stands for, and the define each used built-in and render mode adds.
 */
export interface ModeTable {
  /** The GLSL text of each built-in: `COLOR` is `color`, `TIME` is `params.time`. */
  readonly renames: Readonly<Record<string, string>>;
  /** The define a use of the built-in adds to the variant. */
  readonly usage_defines: Readonly<Record<string, string>>;
  /** The define a render mode adds to the variant. */
  readonly render_mode_defines: Readonly<Record<string, string>>;
  /** The sampler of a built-in texture: `RADIANCE` reads with `SAMPLER_LINEAR_WITH_MIPMAPS_CLAMP`. */
  readonly custom_samplers: Readonly<Record<string, string>>;
  readonly base_texture_binding_index: number;
  /** The descriptor set of the material's textures, a number or the C++ enumerator's name. */
  readonly texture_layout_set: number | string;
  readonly base_uniform_string: string;
  readonly base_varying_index?: number;
  readonly default_filter: string;
  readonly default_repeat: string;
  readonly global_buffer_array_variable: string;
  readonly instance_uniform_index_variable?: string;
  readonly apply_luminance_multiplier?: boolean;
  readonly check_multiview_samplers?: boolean;
}
