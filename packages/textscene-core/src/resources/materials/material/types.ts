import type { ScopedReference } from '../../reading';
import type { AuthoredSkyProperties } from '../../sky/types';
import type { ShaderText } from '../shadermaterial/types';
import type { StandardMaterial3DData, TextureSlot } from '../standardmaterial3d/types';

export interface StandardMaterial {
  readonly form: 'standard';
  readonly data: StandardMaterial3DData;
  /** Each texture slot whose feature gate is on, resolved in the material's own file. */
  readonly textures: Readonly<Partial<Record<TextureSlot, ScopedReference>>>;
  /** `next_pass`, resolved in the material's own file. Null when there is none. */
  readonly nextPass: ScopedReference | null;
}

/** A ProceduralSkyMaterial, a PanoramaSkyMaterial or a PhysicalSkyMaterial: a Sky draws it. */
export interface SkyMaterial {
  readonly form: 'sky';
  readonly type: string;
  readonly properties: AuthoredSkyProperties;
  /** A PanoramaSkyMaterial's `panorama`, resolved in the material's own file. Null for none or for any other sky. */
  readonly panorama: ScopedReference | null;
}

/** A ShaderMaterial whose shader is `shader_type spatial`, which the node lit surface draws. */
export interface SpatialShaderMaterial {
  readonly form: 'spatial-shader';
  readonly shader: ShaderText;
}

/** A Material class the previewer does not build, such as an ORMMaterial3D or a canvas_item shader. */
export interface DeclinedMaterial {
  readonly form: 'declined';
  readonly type: string;
}

export type Material = StandardMaterial | SkyMaterial | SpatialShaderMaterial | DeclinedMaterial;
