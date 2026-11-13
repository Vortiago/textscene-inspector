/**
 * What a Material resource decodes to, from any origin: a StandardMaterial3D the previewer
 * builds on a surface, a sky material it builds as a sky, or another Material class it declines
 * and draws as Godot's default surface (ADR-0041).
 */

import type { ScopedReference } from '../../reading';
import type { SkyProperties } from '../../sky/types';
import type { StandardMaterial3DData, TextureSlot } from '../standardmaterial3d/types';

export interface StandardMaterial {
  readonly form: 'standard';
  readonly data: StandardMaterial3DData;
  /** Each texture slot whose feature gate is on, resolved in the material's own file. */
  readonly textures: Readonly<Partial<Record<TextureSlot, ScopedReference>>>;
  /** `next_pass`, resolved in the material's own file. Its `ref` is undefined when there is none. */
  readonly nextPass: ScopedReference;
}

/** A ProceduralSkyMaterial, a PanoramaSkyMaterial or a PhysicalSkyMaterial: a Sky draws it. */
export interface SkyMaterial {
  readonly form: 'sky';
  readonly type: string;
  readonly properties: SkyProperties;
  /** A PanoramaSkyMaterial's `panorama`, resolved in the material's own file. Null for any other sky. */
  readonly panorama: ScopedReference | null;
}

/** A Material class this previewer does not build, such as a ShaderMaterial or an ORMMaterial3D. */
export interface DeclinedMaterial {
  readonly form: 'declined';
  readonly type: string;
}

export type Material = StandardMaterial | SkyMaterial | DeclinedMaterial;
