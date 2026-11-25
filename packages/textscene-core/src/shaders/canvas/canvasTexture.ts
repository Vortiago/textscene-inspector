import * as THREE from 'three';
import { defaultTexture } from '../uniforms/defaultTextures.js';
import { type Binding, writeBindings } from '../uniforms/bindingTable.js';
import { applySamplerState, GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import type { SamplerSettings } from '../uniforms/samplerTextures.js';
import { TextureCopies } from '../uniforms/textureCopies.js';
import type { TexelSize } from './canvasRect.js';
import type { CanvasDraw } from './transpileCanvas.js';

/** `CanvasItem.texture_filter` past `DEFAULT`, which the item resolves to the project's filter. */
export type CanvasTextureFilter =
  | 'nearest'
  | 'linear'
  | 'nearest_mipmap'
  | 'linear_mipmap'
  | 'nearest_mipmap_anisotropic'
  | 'linear_mipmap_anisotropic';

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

/** What the push constants of a rect batch read from its texture (`renderer_canvas_render_rd.h:554-565`). */
interface BatchTexture {
  readonly width: number;
  readonly height: number;
}

/** The texel size reads the image's size, so a texture whose image has not loaded cannot draw. */
function sizeOf(texture: THREE.Texture): BatchTexture {
  const image = texture.image as Partial<BatchTexture> | null;
  if (!image?.width || !image.height)
    throw new Error(
      `expected a canvas texture with a loaded, sized image, got ${image?.width ?? 'no'} by ${image?.height ?? 'no'} texels`
    );
  return { width: image.width, height: image.height };
}

/** The default canvas texture has no diffuse map, so its size is 1 by 1 (`texture_storage.cpp:751-752`). */
const DEFAULT_TEXTURE_SIZE: BatchTexture = { width: 1, height: 1 };

/** The members of `Params` a rect batch writes from its texture and the default canvas texture's maps. */
const TEXTURE_BINDINGS: readonly Binding<BatchTexture>[] = [
  {
    uniform: 'params.color_texture_pixel_size',
    godot: 'renderer_canvas_render_rd.cpp:3351',
    value: ({ width, height }) => new THREE.Vector2(1 / width, 1 / height),
  },
  // The default canvas texture's specular colour is white, packed as `unpackUnorm4x8` reads it.
  {
    uniform: 'params.specular_shininess',
    godot: 'renderer_canvas_render_rd.cpp:3345-3349',
    value: () => 0xffffffff,
  },
  // It has no normal map and an opaque specular colour, so it sets no default map flag.
  { uniform: 'params.batch_flags', godot: 'renderer_canvas_render_rd.cpp:3337-3343', value: () => 0 },
];

/** A rect batch's texture with its item's sampler (`renderer_canvas_render_rd.cpp:3006-3019, 3320-3351`). */
export class CanvasTextureBinding {
  /** Written only by `bind`: the copies of each sampler state, which three keeps on the texture. */
  private readonly copies = new Map<string, TextureCopies>();
  private readonly white = defaultTexture('flat', 'white');
  private readonly normal = defaultTexture('flat', 'normal');

  constructor(
    private readonly draw: CanvasDraw,
    private readonly sampling: ProjectSampling = GODOT_SAMPLING
  ) {
    this.setTexture('normal_texture', this.normal);
    this.setTexture('specular_texture', this.white);
  }

  /** Binds `texture`, or Godot's default canvas texture, white, for a command with none. */
  bind(texture: THREE.Texture | undefined, state: CanvasTextureState): TexelSize {
    const key = stateKey(state);
    const bound = texture ? this.copiesOf(key, state).copyOf(texture) : this.white;
    this.setTexture('color_texture', bound);
    const size = texture ? sizeOf(bound) : DEFAULT_TEXTURE_SIZE;
    writeBindings(TEXTURE_BINDINGS, this.draw.uniforms, size);
    for (const [held, copies] of this.copies) copies.release(held === key ? [bound] : []);
    return { x: 1 / size.width, y: 1 / size.height };
  }

  /** Frees the copies and the default textures it binds. */
  dispose(): void {
    for (const copies of this.copies.values()) copies.release([]);
    this.white.dispose();
    this.normal.dispose();
  }

  private copiesOf(key: string, state: CanvasTextureState): TextureCopies {
    const held = this.copies.get(key);
    if (held) return held;
    const settings = settingsOf(state);
    // An sRGB render target reads the texels as they are stored, and a linear one decodes them.
    const colorSpace = state.usesLinearColors ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    const copies = new TextureCopies((copy, source) => {
      applySamplerState(copy, source, settings, this.sampling);
      copy.colorSpace = colorSpace;
    });
    this.copies.set(key, copies);
    return copies;
  }

  private setTexture(name: string, texture: THREE.Texture): void {
    const node = this.draw.textures.get(name);
    if (node) node.value = texture;
  }
}

const stateKey = ({ filter, repeat, usesLinearColors = false }: CanvasTextureState) =>
  `${filter} ${repeat} ${usesLinearColors}`;
