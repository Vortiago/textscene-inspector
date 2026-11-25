import type * as THREE from 'three';
import type { BaseMaterialProperties } from '../../resources/materials/material/types';
import type { ShaderText, ShaderTextureReference } from '../../resources/materials/shadermaterial/types';
import { baseMaterialSurface } from '../../shaders/material/baseMaterialShader';
import { ALBEDO_TEXTURE_SIZE, textureParameterOf } from '../../shaders/material/materialParameters';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ParameterValue } from '../../shaders/uniforms/transpiledUniform';
import { parameterVariants } from '../../shaders/uniforms/materialParameters';
import { imageSizeOf } from '../../shaders/uniforms/textureLevels';
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
  readonly textures: Readonly<Record<string, ShaderTextureReference>>;
  /** The value of each parameter, with the material's textures once they load. */
  parametersWith(textures: Readonly<Record<string, SamplerValue>>): Readonly<Record<string, ParameterValue>>;
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
  return { code, file, textures, parametersWith: (loaded) => ({ ...values, ...loaded }) };
}

function baseMaterial3DSurface({
  materialClass,
  properties,
  resources,
}: BaseMaterialProperties): SurfaceShader {
  const { code, parameters, textures } = baseMaterialSurface(materialClass, properties, resources);
  return {
    code,
    file: materialClass,
    textures,
    parametersWith: (loaded) => ({ ...parameters, ...loaded, ...albedoTextureSize(loaded[ALBEDO_TEXTURE]) }),
  };
}

const ALBEDO_TEXTURE = textureParameterOf('albedo_texture')!;

/** `set_texture` gives the albedo texture's size to its own parameter (`material.cpp:2545`). */
function albedoTextureSize(albedo: SamplerValue | undefined): Record<string, ParameterValue> {
  if (!albedo || isTextureList(albedo)) return {};
  const { width, height } = imageSizeOf(albedo.image);
  if (width === undefined || height === undefined) return {};
  return { [ALBEDO_TEXTURE_SIZE]: variant('VECTOR2I', { x: width, y: height }) };
}

const isTextureList = (value: SamplerValue): value is readonly (THREE.Texture | null)[] =>
  Array.isArray(value);
