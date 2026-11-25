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

/** The material a spatial surface draws through its shader: a ShaderMaterial, or a BaseMaterial3D. */
export type SurfaceShaderSource =
  { readonly shader: ShaderText } | { readonly baseMaterial: BaseMaterialProperties };

/** A spatial shader's text, and what its material gives each parameter. */
export interface SurfaceShader {
  readonly code: string;
  /** The address a fault names. */
  readonly file: string;
  /** The class whose shader Godot generates, or null for a user's ShaderMaterial. */
  readonly generatedFor: BaseMaterialProperties['materialClass'] | null;
  readonly textures: Readonly<Record<string, ShaderTextureReference>>;
  /** The albedo texture whose reported size the generated shader reads, or null for none. */
  readonly albedoTexture: ScopedReference | null;
  /** The value of each parameter, with the material's textures and the albedo's reported size once they load. */
  parametersWith(
    textures: Readonly<Record<string, SamplerValue>>,
    albedoSize: ImageSize | undefined
  ): Readonly<Record<string, ParameterValue>>;
}

const shaderMaterialSurfaceOf = perObject(shaderMaterialSurface);
const baseMaterial3DSurfaceOf = perObject(baseMaterial3DSurface);

/** The shader `source` draws, its parameters read once for the surfaces that share one material. */
export function surfaceShaderOf(source: SurfaceShaderSource): SurfaceShader {
  return 'shader' in source
    ? shaderMaterialSurfaceOf(source.shader)
    : baseMaterial3DSurfaceOf(source.baseMaterial);
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

/**
 * `set_texture` gives the albedo texture's own `get_width` and `get_height` to its parameter
 * (`material.cpp:2545`): an AtlasTexture's region and margin, though the sampler reads its sheet.
 */
function albedoTextureSize(size: ImageSize | undefined): Record<string, ParameterValue> {
  if (!size) return {};
  return { [ALBEDO_TEXTURE_SIZE]: variant('VECTOR2I', { x: size.width, y: size.height }) };
}
