import type { ScopedReference } from '../../reading';
import type { ShaderSkyText } from '../../sky/types';
import type { ShaderText } from '../shadermaterial/types';
import type { StandardMaterial3DData, TextureSlot } from '../standardmaterial3d/types';

/** A BaseMaterial3D as Godot's generated shader reads it. */
export interface BaseMaterialProperties {
  readonly materialClass: 'StandardMaterial3D' | 'ORMMaterial3D';
  /** Each property the file writes that holds no resource, as Variant text, in the file's order. */
  readonly properties: Readonly<Record<string, string>>;
  /** Each property the file writes that holds a resource, resolved in the material's own file. */
  readonly resources: Readonly<Record<string, ScopedReference>>;
}

export interface StandardMaterial {
  readonly form: 'standard';
  readonly data: StandardMaterial3DData;
  readonly baseMaterial: BaseMaterialProperties;
  /** Each texture slot whose feature gate is on, resolved in the material's own file. */
  readonly textures: Readonly<Partial<Record<TextureSlot, ScopedReference>>>;
  /** `next_pass`, resolved in the material's own file. Null when there is none. */
  readonly nextPass: ScopedReference | null;
}

/** A sky material, or a ShaderMaterial of `shader_type sky`, as the shader a Sky draws. */
export interface SkyMaterial {
  readonly form: 'sky';
  readonly type: string;
  readonly properties: ShaderSkyText;
}

/** A ShaderMaterial whose shader is `shader_type spatial`, which the node lit surface draws. */
export interface SpatialShaderMaterial {
  readonly form: 'spatial-shader';
  readonly shader: ShaderText;
}

/** An ORMMaterial3D, which only the node lit surface draws, through Godot's generated shader. */
export interface OrmMaterial {
  readonly form: 'orm';
  readonly baseMaterial: BaseMaterialProperties;
}

/** A Material class the previewer does not build, such as a canvas_item shader. */
export interface DeclinedMaterial {
  readonly form: 'declined';
  readonly type: string;
}

export type Material =
  StandardMaterial | OrmMaterial | SkyMaterial | SpatialShaderMaterial | DeclinedMaterial;
