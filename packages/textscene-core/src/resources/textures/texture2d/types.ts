/**
 * What a Texture2D resource draws, as the `TEXTURE_2D` kind decodes it: the layers a slot peels,
 * outermost first, down to the source of the pixels. No THREE.
 */

import type { Read, ScopedReference } from '../../reading';
import type { AtlasTextureData } from '../atlastexture/types';
import type { CanvasTextureData } from '../canvastexture/types';
import type { GradientTexture2D, Gradient } from '../gradienttexture2d/types';
import type { SavedImage } from '../image/kind';
import type { NoiseSources } from '../noiseSources';
import type { NoiseTexture2DData } from '../noisetexture2d/types';

export type Texture2D = CanvasTextureLayer | AtlasTextureLayer | Texture2DSource;

/** A CanvasTexture over the texture it draws as its diffuse map. */
export interface CanvasTextureLayer {
  readonly form: 'canvas';
  readonly canvasTexture: CanvasTextureMaps;
  readonly diffuse: Read<Texture2D>;
}

/** A CanvasTexture's sampler and shading, with its normal and specular maps. */
export interface CanvasTextureMaps {
  readonly texture: CanvasTextureData;
  /** Null when the CanvasTexture sets no normal map, without which Godot shades none. */
  readonly normalTexture: ScopedReference | null;
  readonly specularTexture: ScopedReference | null;
}

/** An AtlasTexture over the sheet it cuts a region from. */
export interface AtlasTextureLayer {
  readonly form: 'atlas';
  readonly atlas: AtlasTextureData;
  readonly sheet: Read<Texture2D>;
}

/** The texture that gives the pixels: a file the loader imports, a procedural texture or a live target. */
export type Texture2DSource =
  | { readonly form: 'file'; readonly path: string }
  | GradientTexture2DSource
  | NoiseTexture2DSource
  | { readonly form: 'image'; readonly image: SavedImage }
  | ViewportTextureSource;

export interface GradientTexture2DSource {
  readonly form: 'gradient';
  readonly texture: GradientTexture2D;
  /** Null when no `gradient` is set: the texture never gets an image (`gradient_texture.cpp:229-233`). */
  readonly gradient: Gradient | null;
}

export interface NoiseTexture2DSource {
  readonly form: 'noise';
  readonly texture: NoiseTexture2DData;
  readonly sources: NoiseSources;
}

export interface ViewportTextureSource {
  readonly form: 'viewport';
  /** The `viewport_path`, from the local scene root. Null when it names no viewport. */
  readonly viewportPath: string | null;
  /** Godot sets the texture up only when every holder down to it is local to scene. */
  readonly isSetUp: boolean;
}
