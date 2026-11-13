/**
 * The public entry of `@textscene/three-godot-shaders`: core's shader module (ADR-0072). The names
 * are listed one by one, since core is private and each name core exports through a barrel would
 * become a promise to every consumer.
 */

export { installGodotShading } from '@textscene/core/shaders';
export type {
  GodotLitNodeMaterial,
  GodotShading,
  GodotShadingOptions,
  LitProgram,
  NodeOutput,
  PipelineInputs,
  SkyInputs,
  SplitShadowLayout,
  SunShadowInputs,
} from '@textscene/core/shaders';
