import type { ImageSize } from '../../resources/formats/image/imagePixels';
import type { BaseMaterialProperties } from '../../resources/materials/material/types';
import type { ScopedReference } from '../../resources/reading';
import type { ShaderText, ShaderTextureReference } from '../../resources/materials/shadermaterial/types';
import { baseMaterialSurface } from '../../shaders/material/baseMaterialShader';
import { ALBEDO_TEXTURE_SIZE } from '../../shaders/material/materialParameters';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ParameterValue } from '../../shaders/uniforms/transpiledUniform';
import { parameterVariants } from '../../shaders/uniforms/materialParameters';
import { variant } from '../../godot/variant/value/variant';
import { perObject } from '../../utils/perObject';

/** What a spatial surface draws through a shader: a ShaderMaterial, a BaseMaterial3D or Godot's default. */
export type SurfaceShaderSource =
  | { readonly shader: ShaderText }
  | { readonly baseMaterial: BaseMaterialProperties }
  | { readonly defaultMaterial: ShaderText };

/** What a fault names a shader Godot generates for: a BaseMaterial3D's class, or its default material. */
type GeneratedFor = BaseMaterialProperties['materialClass'] | 'default material';

/** A spatial shader's text, and what its material gives each parameter. */
export interface SurfaceShader {
  readonly code: string;
  /** The address a fault names. */
  readonly file: string;
  /** The material whose shader Godot generates, or null for a user's ShaderMaterial. */
  readonly generatedFor: GeneratedFor | null;
  readonly textures: Readonly<Record<string, ShaderTextureReference>>;
  /** The albedo texture whose reported size the generated shader reads, or null for none. */
  readonly albedoTexture: ScopedReference | null;
  /** The value of each parameter, with the textures and the albedo's reported size once they load. */
  parametersWith(
    textures: Readonly<Record<string, SamplerValue>>,
    albedoSize: ImageSize | undefined
  ): Readonly<Record<string, ParameterValue>>;
}

const shaderMaterialSurfaceOf = perObject(shaderMaterialSurface);
const baseMaterial3DSurfaceOf = perObject(baseMaterial3DSurface);
const defaultMaterialSurfaceOf = perObject((text: ShaderText): SurfaceShader => ({
  ...shaderMaterialSurface(text),
  generatedFor: 'default material',
}));

/** The shader `source` draws, its parameters read once for the surfaces that share one material. */
export function surfaceShaderOf(source: SurfaceShaderSource): SurfaceShader {
  if ('shader' in source) return shaderMaterialSurfaceOf(source.shader);
  if ('defaultMaterial' in source) return defaultMaterialSurfaceOf(source.defaultMaterial);
  return baseMaterial3DSurfaceOf(source.baseMaterial);
}

function shaderMaterialSurface({ code, file, parameters, textures }: ShaderText): SurfaceShader {
  const values = parameterVariants(parameters);
  return {
    code,
    file,
    generatedFor: null,
    textures,
    albedoTexture: null,
    parametersWith: (loaded) => ({ ...values, ...loaded }),
  };
}

function baseMaterial3DSurface({
  materialClass,
  address,
  properties,
  resources,
}: BaseMaterialProperties): SurfaceShader {
  const { code, parameters, textures } = baseMaterialSurface(materialClass, properties, resources);
  return {
    code,
    file: address ?? materialClass,
    generatedFor: materialClass,
    textures,
    albedoTexture: resources.albedo_texture ?? null,
    parametersWith: (loaded, albedoSize) => ({ ...parameters, ...loaded, ...albedoTextureSize(albedoSize) }),
  };
}

/** `set_texture` gives the albedo's own `get_width` and `get_height` here (`material.cpp:2545`). */
function albedoTextureSize(size: ImageSize | undefined): Record<string, ParameterValue> {
  if (!size) return {};
  return { [ALBEDO_TEXTURE_SIZE]: variant('VECTOR2I', { x: size.width, y: size.height }) };
}
