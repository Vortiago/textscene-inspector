import * as THREE from 'three';
import { clamp, type Rgba } from '../../godot/math/math.js';
import type { TextureFilterWord } from '../../godot/rendering/materials/textureFilter.js';
import { defaultTexture } from '../uniforms/defaultTextures.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import { applySamplerState, GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import type { SamplerSettings } from '../uniforms/samplerTextures.js';
import { SharedCopies, TextureCopies } from '../uniforms/textureCopies.js';
import type { CanvasDraw } from './transpileCanvas.js';

/** A texture's `texpixel_size`: one over its size in texels. */
export interface TexelSize {
  readonly x: number;
  readonly y: number;
}

/** `CanvasItem.texture_filter` past `DEFAULT`, which the item resolves to the project's filter. */
export type CanvasTextureFilter = TextureFilterWord;

/** `CanvasItem.texture_repeat` past `DEFAULT`. */
export type CanvasTextureRepeat = 'disabled' | 'enabled' | 'mirror';

export interface CanvasTextureState {
  readonly filter: CanvasTextureFilter;
  readonly repeat: CanvasTextureRepeat;
  /** A linear render target reads a colour texture through its sRGB view (`texture_storage.cpp:754`). */
  readonly usesLinearColors?: boolean;
}

/** The project's default canvas texture filter and repeat (`project_settings.cpp:1833-1834`). */
export const GODOT_CANVAS_TEXTURE_STATE: CanvasTextureState = { filter: 'linear', repeat: 'disabled' };

const REPEAT_WORDS: Readonly<Record<CanvasTextureRepeat, string>> = {
  disabled: 'repeat_disable',
  enabled: 'repeat_enable',
  mirror: 'repeat_mirror',
};

const settingsOf = ({ filter, repeat }: CanvasTextureState): SamplerSettings => ({
  filter: `filter_${filter}`,
  repeat: REPEAT_WORDS[repeat],
});

/** A CanvasTexture's maps, which a batch binds beside its diffuse (`texture_storage.cpp:761-786`). */
export interface CanvasMaps {
  /** Null for none: the batch binds Godot's flat default normal map. */
  readonly normal: THREE.Texture | null;
  /** Null for none: the batch binds white. */
  readonly specular: THREE.Texture | null;
  /** `specular_color` with `specular_shininess` as its alpha. */
  readonly specularShininess: Rgba;
}

/** The maps of Godot's default canvas texture, and of a texture that is no CanvasTexture. */
export const DEFAULT_CANVAS_MAPS: CanvasMaps = Object.freeze({
  normal: null,
  specular: null,
  specularShininess: Object.freeze({ r: 1, g: 1, b: 1, a: 1 }),
});

/** What the push constants of a rect batch read from its texture (`renderer_canvas_render_rd.h:554-565`). */
interface BatchTexture {
  readonly width: number;
  readonly height: number;
  readonly maps: CanvasMaps;
}

/** `renderer_canvas_render_rd.h:83-84`. */
const DEFAULT_NORMAL_MAP_USED = 1 << 9;
const DEFAULT_SPECULAR_MAP_USED = 1 << 10;

/** A shininess at or over this leaves the default specular map off (`renderer_canvas_render_rd.cpp:3337`). */
const SPECULAR_OFF_SHININESS = 0.999;

/** One channel as `uint8_t(CLAMP(x * 255.0, 0.0, 255.0))` casts it: truncated. */
const unorm8 = (channel: number) => Math.trunc(clamp(channel * 255, 0, 255));

/** `renderer_canvas_render_rd.cpp:3345-3349`, unsigned as `unpackUnorm4x8` reads it. */
const packedSpecular = ({ r, g, b, a }: Rgba) =>
  ((unorm8(a) << 24) | (unorm8(b) << 16) | (unorm8(g) << 8) | unorm8(r)) >>> 0;

const batchFlagsOf = ({ normal, specularShininess }: CanvasMaps) =>
  (specularShininess.a < SPECULAR_OFF_SHININESS ? DEFAULT_SPECULAR_MAP_USED : 0) |
  (normal ? DEFAULT_NORMAL_MAP_USED : 0);

/** The texel size reads the image's size, so a texture whose image has not loaded cannot draw. */
function sizeOf(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as Partial<BatchTexture> | null;
  if (!image?.width || !image.height)
    throw new Error(
      `expected a canvas texture with a loaded, sized image, got ${image?.width ?? 'no'} by ${image?.height ?? 'no'} texels`
    );
  return { width: image.width, height: image.height };
}

/** The default canvas texture has no diffuse map, so its size is 1 by 1 (`texture_storage.cpp:751-752`). */
const DEFAULT_TEXTURE_SIZE = { width: 1, height: 1 };

export const DEFAULT_TEXEL_SIZE: TexelSize = {
  x: 1 / DEFAULT_TEXTURE_SIZE.width,
  y: 1 / DEFAULT_TEXTURE_SIZE.height,
};

/** The members of `Params` a rect batch writes from its texture and its CanvasTexture's maps. */
const TEXTURE_BINDINGS: readonly Binding<BatchTexture>[] = [
  {
    uniform: 'params.color_texture_pixel_size',
    godot: 'renderer_canvas_render_rd.cpp:3351',
    value: ({ width, height }) => new THREE.Vector2(1 / width, 1 / height),
  },
  {
    uniform: 'params.specular_shininess',
    godot: 'renderer_canvas_render_rd.cpp:3345-3349',
    value: ({ maps }) => packedSpecular(maps.specularShininess),
  },
  {
    uniform: 'params.batch_flags',
    godot: 'renderer_canvas_render_rd.cpp:3337-3343',
    value: ({ maps }) => batchFlagsOf(maps),
  },
];

/** A rect batch's texture with its item's sampler (`renderer_canvas_render_rd.cpp:3006-3019, 3320-3351`). */
export class CanvasTextureBinding {
  /** Written only by `bind`: the copies of each sampler state, which three keeps on the texture. */
  private readonly copies = new Map<string, TextureCopies>();
  /** Written only by `bind`: the textures the batch samples now. */
  private bound: readonly THREE.Texture[] = [];
  private readonly white = defaultTexture('flat', 'white');
  private readonly normal = defaultTexture('flat', 'normal');

  /** Written only by `bind`: the light atlas the binding holds a shared copy of, and that copy's state. */
  private atlas: { readonly source: THREE.Texture; readonly copies: SharedCopies } | null = null;

  constructor(
    private readonly draw: CanvasDraw,
    private readonly sampling: ProjectSampling = GODOT_SAMPLING
  ) {}

  /**
   * Binds `texture`, or white for none, and `maps` and a lit draw's `lightAtlas` raw with its sampler
   * (`texture_storage.cpp:767, 780`, `canvas.glsl:782`).
   */
  bind(
    texture: THREE.Texture | undefined,
    state: CanvasTextureState,
    maps: CanvasMaps = DEFAULT_CANVAS_MAPS,
    lightAtlas: THREE.Texture | null = null
  ): TexelSize | undefined {
    const kept = new Map<TextureCopies, THREE.Texture[]>();
    const copyOf = (source: THREE.Texture, copyState: CanvasTextureState) => {
      const copies = this.copiesOf(copyState);
      const copy = copies.copyOf(source);
      kept.set(copies, [...(kept.get(copies) ?? []), copy]);
      return copy;
    };
    const raw = { ...state, usesLinearColors: false };
    const color = texture ? copyOf(texture, state) : this.white;
    const normal = maps.normal ? copyOf(maps.normal, raw) : this.normal;
    const specular = maps.specular ? copyOf(maps.specular, raw) : this.white;
    this.setTexture('color_texture', color);
    this.setTexture('normal_texture', normal);
    this.setTexture('specular_texture', specular);
    this.bound = [color, normal, specular];
    if (lightAtlas) this.bound = [...this.bound, this.bindLightAtlas(lightAtlas, raw)];
    else this.releaseLightAtlas();
    const size = texture ? sizeOf(color) : DEFAULT_TEXTURE_SIZE;
    writeBindings(TEXTURE_BINDINGS, this.draw.uniforms, { ...size, maps });
    for (const copies of this.copies.values()) copies.release(kept.get(copies) ?? []);
    // Nothing, not the default's size: a record with no texture reads the whole default texture.
    return texture ? { x: 1 / size.width, y: 1 / size.height } : undefined;
  }

  /** The color, normal, specular and light atlas textures the last `bind` bound. */
  get boundTextures(): readonly THREE.Texture[] {
    return this.bound;
  }

  /** Frees the copies and the default textures it binds. */
  dispose(): void {
    this.releaseLightAtlas();
    for (const copies of this.copies.values()) copies.release([]);
    this.white.dispose();
    this.normal.dispose();
  }

  private copiesOf(state: CanvasTextureState): TextureCopies {
    const key = stateKey(state);
    const held = this.copies.get(key);
    if (held) return held;
    const copies = new TextureCopies(stateConfiguration(state, this.sampling));
    this.copies.set(key, copies);
    return copies;
  }

  /** The new copy is held before the old one goes, so a copy bound again never drops to no holder. */
  private bindLightAtlas(source: THREE.Texture, state: CanvasTextureState): THREE.Texture {
    const copies = sharedAtlasCopiesOf(this.sampling, state);
    const copy = copies.hold(source);
    this.releaseLightAtlas();
    this.atlas = { source, copies };
    this.setTexture('atlas_texture', copy);
    return copy;
  }

  private releaseLightAtlas(): void {
    this.atlas?.copies.release(this.atlas.source);
    this.atlas = null;
  }

  private setTexture(name: string, texture: THREE.Texture): void {
    const node = this.draw.textures.get(name);
    if (node) node.value = texture;
  }
}

const stateKey = ({ filter, repeat, usesLinearColors = false }: CanvasTextureState) =>
  `${filter} ${repeat} ${usesLinearColors}`;

/** What a copy of a texture read through `state`'s sampler takes. */
function stateConfiguration(
  state: CanvasTextureState,
  sampling: ProjectSampling
): (copy: THREE.Texture, source: THREE.Texture) => void {
  const settings = settingsOf(state);
  // An sRGB render target reads the texels as they are stored, and a linear one decodes them.
  const colorSpace = state.usesLinearColors ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return (copy, source) => {
    applySamplerState(copy, source, settings, sampling);
    copy.colorSpace = colorSpace;
  };
}

/** Written only by `sharedAtlasCopiesOf`: one atlas copy per sampler state, not an upload per item. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const sharedAtlasCopies = new WeakMap<ProjectSampling, Map<string, SharedCopies>>();

function sharedAtlasCopiesOf(sampling: ProjectSampling, state: CanvasTextureState): SharedCopies {
  let byState = sharedAtlasCopies.get(sampling);
  if (!byState) sharedAtlasCopies.set(sampling, (byState = new Map()));
  const key = stateKey(state);
  let copies = byState.get(key);
  if (!copies) byState.set(key, (copies = new SharedCopies(stateConfiguration(state, sampling))));
  return copies;
}
