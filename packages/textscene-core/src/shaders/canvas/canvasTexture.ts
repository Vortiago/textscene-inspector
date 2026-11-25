import * as THREE from 'three';
import { defaultTexture } from '../uniforms/defaultTextures.js';
import { GODOT_SAMPLING, type ProjectSampling, samplerState } from '../uniforms/samplerState.js';
import type { SamplerSettings } from '../uniforms/samplerTextures.js';
import { TextureCopies } from '../uniforms/textureCopies.js';
import { levelsOf } from '../uniforms/textureLevels.js';
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

/** The default canvas texture's specular colour, white, packed as `unpackUnorm4x8` reads it. */
const WHITE_SPECULAR_SHININESS = 0xffffffff;

/** A rect batch's texture with its item's sampler (`renderer_canvas_render_rd.cpp:3006-3019, 3320-3351`). */
export class CanvasTextureBinding {
  /** Written only by `bind`: the copies of each sampler state, which three keeps on the texture. */
  private readonly copies = new Map<string, TextureCopies>();
  private readonly white = defaultTexture('flat', 'white');
  private readonly normal = defaultTexture('flat', 'normal');

  constructor(
    private readonly draw: CanvasDraw,
    private readonly sampling: ProjectSampling = GODOT_SAMPLING
  ) {}

  /** Binds `texture`, or Godot's default canvas texture, white, for a rect with none. */
  bind(texture: THREE.Texture | undefined, state: CanvasTextureState): void {
    const bound = texture ? this.copiesOf(state).copyOf(texture) : this.white;
    this.setTexture('color_texture', bound);
    this.setTexture('normal_texture', this.normal);
    this.setTexture('specular_texture', this.white);
    const { width, height } = bound.image as { width: number; height: number };
    this.setParam('color_texture_pixel_size', new THREE.Vector2(1 / width, 1 / height));
    this.setParam('specular_shininess', WHITE_SPECULAR_SHININESS);
    this.setParam('batch_flags', 0);
    for (const [key, copies] of this.copies) copies.release(key === stateKey(state) ? [bound] : []);
  }

  /** Frees the copies and the default textures it binds. */
  dispose(): void {
    for (const copies of this.copies.values()) copies.release([]);
    this.white.dispose();
    this.normal.dispose();
  }

  private copiesOf(state: CanvasTextureState): TextureCopies {
    const key = stateKey(state);
    let copies = this.copies.get(key);
    if (!copies)
      this.copies.set(
        key,
        (copies = new TextureCopies((copy, source) => this.configure(copy, source, state)))
      );
    return copies;
  }

  /** An sRGB render target reads the texels as they are stored, with no decode. */
  private configure(copy: THREE.Texture, source: THREE.Texture, state: CanvasTextureState): void {
    const sampler = samplerState(settingsOf(state), levelsOf(source), this.sampling);
    copy.flipY = false;
    copy.magFilter = sampler.magFilter;
    copy.minFilter = sampler.minFilter;
    copy.wrapS = copy.wrapT = sampler.wrap;
    copy.anisotropy = sampler.anisotropy;
    copy.colorSpace = THREE.NoColorSpace;
  }

  private setTexture(name: string, texture: THREE.Texture): void {
    const node = this.draw.textures.get(name);
    if (node) node.value = texture;
  }

  private setParam(member: string, value: unknown): void {
    const uniform = this.draw.uniforms.get(`params.${member}`);
    if (uniform && 'value' in uniform) uniform.value = value;
  }
}

const stateKey = ({ filter, repeat }: CanvasTextureState) => `${filter} ${repeat}`;
