/**
 * `useInheritedTextureSampler`, the rule of the texture caches
 * (`scene/main/canvas_item.cpp:1625-1699`): PARENT_NODE (0,
 * `scene/main/canvas_item.h:52-69`) defers to the ambient, and a concrete value
 * wins. `ControlCanvasWalker.test.tsx` covers the propagation through the walker.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import {
  ROOT_TEXTURE_SAMPLER,
  TextureSampler2DContext,
  ViewportSamplerProvider,
  canvasItemViewSampler,
  inheritTextureSampler,
  useInheritedTextureSampler,
  type AmbientTextureSampler,
} from './canvasItemTextureSampler';
import { applyViewSampler } from '../resources/textures/textureView';

// The root viewport takes its default from the project settings; nothing here needs the real provider's load.
const projectSettingsMock = vi.hoisted(() => ({ settings: null as Record<string, string> | null }));

vi.mock('./contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => projectSettingsMock,
}));

beforeEach(() => {
  projectSettingsMock.settings = null;
});

const PARENT_NODE = 0; // TEXTURE_FILTER_PARENT_NODE and TEXTURE_REPEAT_PARENT_NODE, canvas_item.h:52-69
const NEAREST = 1; // TEXTURE_FILTER_NEAREST
const LINEAR = 2; // TEXTURE_FILTER_LINEAR
const NEAREST_WITH_MIPMAPS = 3;
const LINEAR_WITH_MIPMAPS = 4;
const NEAREST_WITH_MIPMAPS_ANISOTROPIC = 5;
const LINEAR_WITH_MIPMAPS_ANISOTROPIC = 6;
const REPEAT_DISABLED = 1; // TEXTURE_REPEAT_DISABLED
const REPEAT_ENABLED = 2; // TEXTURE_REPEAT_ENABLED
const REPEAT_MIRROR = 3; // TEXTURE_REPEAT_MIRROR

function resolveUnder(
  ambient: AmbientTextureSampler,
  ownFilter: number | undefined,
  ownRepeat: number | undefined
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TextureSampler2DContext.Provider value={ambient}>{children}</TextureSampler2DContext.Provider>
  );
  return renderHook(() => useInheritedTextureSampler(ownFilter, ownRepeat), { wrapper }).result.current;
}

describe('useInheritedTextureSampler', () => {
  it('lets a concrete own value win over the ambient', () => {
    const ambient = { filter: LINEAR, repeat: REPEAT_ENABLED };
    expect(resolveUnder(ambient, NEAREST, REPEAT_MIRROR)).toEqual({ filter: NEAREST, repeat: REPEAT_MIRROR });
  });

  it('defers PARENT_NODE to the ambient', () => {
    const ambient = { filter: NEAREST, repeat: REPEAT_MIRROR };
    expect(resolveUnder(ambient, PARENT_NODE, PARENT_NODE)).toEqual(ambient);
  });

  it('treats an absent own value as PARENT_NODE', () => {
    const ambient = { filter: NEAREST, repeat: REPEAT_ENABLED };
    expect(resolveUnder(ambient, undefined, undefined)).toEqual(ambient);
  });

  it('relays what a PARENT_NODE ancestor resolved, never resetting to undefined', () => {
    // A PARENT_NODE node takes its parent's cache (`parent_item->texture_filter_cache`).
    const grandparent = resolveUnder(ROOT_TEXTURE_SAMPLER, NEAREST, undefined);
    const middle = resolveUnder(grandparent, PARENT_NODE, PARENT_NODE);
    expect(resolveUnder(middle, PARENT_NODE, PARENT_NODE).filter).toBe(NEAREST);
  });

  it('resolves filter and repeat independently', () => {
    const ambient = { filter: LINEAR, repeat: REPEAT_MIRROR };
    expect(resolveUnder(ambient, NEAREST, PARENT_NODE)).toEqual({ filter: NEAREST, repeat: REPEAT_MIRROR });
  });

  describe('where no ancestor names a value', () => {
    it('ends at Linear and Disabled with no project (viewport.h:419-420)', () => {
      expect(resolveUnder(ROOT_TEXTURE_SAMPLER, PARENT_NODE, PARENT_NODE)).toEqual({
        filter: LINEAR,
        repeat: REPEAT_DISABLED,
      });
    });

    it("ends at the project's canvas texture defaults (editor_node.cpp:451-460)", () => {
      projectSettingsMock.settings = {
        'rendering/textures/canvas_textures/default_texture_filter': '0',
        'rendering/textures/canvas_textures/default_texture_repeat': '1',
      };
      expect(resolveUnder(ROOT_TEXTURE_SAMPLER, PARENT_NODE, PARENT_NODE)).toEqual({
        filter: NEAREST,
        repeat: REPEAT_ENABLED,
      });
    });

    it('lets a concrete own value beat the project default', () => {
      projectSettingsMock.settings = { 'rendering/textures/canvas_textures/default_texture_filter': '0' };
      expect(resolveUnder(ROOT_TEXTURE_SAMPLER, LINEAR, PARENT_NODE).filter).toBe(LINEAR);
    });

    it("ends at a SubViewport's own default, not the project's, inside it", () => {
      projectSettingsMock.settings = { 'rendering/textures/canvas_textures/default_texture_filter': '0' };
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ViewportSamplerProvider value={{ filter: LINEAR_WITH_MIPMAPS, repeat: REPEAT_MIRROR }}>
          {children}
        </ViewportSamplerProvider>
      );
      const { result } = renderHook(() => useInheritedTextureSampler(PARENT_NODE, PARENT_NODE), { wrapper });
      expect(result.current).toEqual({ filter: LINEAR_WITH_MIPMAPS, repeat: REPEAT_MIRROR });
    });
  });
});

describe('inheritTextureSampler', () => {
  it('lets a concrete own value win and defers PARENT_NODE, each property on its own', () => {
    const ambient = { filter: LINEAR, repeat: undefined };
    expect(inheritTextureSampler({ filter: PARENT_NODE, repeat: REPEAT_ENABLED }, ambient)).toEqual({
      filter: LINEAR,
      repeat: REPEAT_ENABLED,
    });
  });
});

/** A mipmapped image: three would build a GPU chain for it, as for a texture imported with mipmaps. */
function mipmappedTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** An image imported without mipmaps (the importer's default): a single level. */
function singleLevelTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

describe('canvasItemViewSampler applied to a texture', () => {
  const sampleWith = (texture: THREE.Texture, filter: number, repeat = REPEAT_DISABLED) =>
    applyViewSampler(texture, canvasItemViewSampler({ filter, repeat }));

  it('samples Nearest and Linear without mipmaps, even from a mipmapped texture (material_storage.cpp:2467-2476)', () => {
    const nearest = sampleWith(mipmappedTexture(), NEAREST);
    expect([nearest.magFilter, nearest.minFilter, nearest.generateMipmaps]).toEqual([
      THREE.NearestFilter,
      THREE.NearestFilter,
      false,
    ]);
    const linear = sampleWith(mipmappedTexture(), LINEAR);
    expect([linear.magFilter, linear.minFilter, linear.generateMipmaps]).toEqual([
      THREE.LinearFilter,
      THREE.LinearFilter,
      false,
    ]);
  });

  it('reads the mip chain of a mipmapped texture under the mipmap filters (material_storage.cpp:2477-2489)', () => {
    const linear = sampleWith(mipmappedTexture(), LINEAR_WITH_MIPMAPS);
    expect([linear.magFilter, linear.minFilter, linear.generateMipmaps]).toEqual([
      THREE.LinearFilter,
      THREE.LinearMipmapLinearFilter,
      true,
    ]);
    const nearest = sampleWith(mipmappedTexture(), NEAREST_WITH_MIPMAPS);
    expect([nearest.magFilter, nearest.minFilter, nearest.generateMipmaps]).toEqual([
      THREE.NearestFilter,
      THREE.NearestMipmapLinearFilter,
      true,
    ]);
  });

  it('samples a texture with a single level the same under every mipmap filter, which has no chain to read', () => {
    const linear = sampleWith(singleLevelTexture(), LINEAR_WITH_MIPMAPS);
    expect([linear.minFilter, linear.generateMipmaps]).toEqual([THREE.LinearFilter, false]);
    const nearest = sampleWith(singleLevelTexture(), NEAREST_WITH_MIPMAPS);
    expect([nearest.magFilter, nearest.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });

  it('samples the two anisotropic filters at 4 taps (material_storage.cpp:2490-2506)', () => {
    const linear = sampleWith(mipmappedTexture(), LINEAR_WITH_MIPMAPS_ANISOTROPIC);
    expect([linear.minFilter, linear.anisotropy]).toEqual([THREE.LinearMipmapLinearFilter, 4]);
    const nearest = sampleWith(mipmappedTexture(), NEAREST_WITH_MIPMAPS_ANISOTROPIC);
    expect([nearest.magFilter, nearest.minFilter, nearest.anisotropy]).toEqual([
      THREE.NearestFilter,
      THREE.NearestMipmapLinearFilter,
      4,
    ]);
  });

  it('applies no anisotropy under the four other filters', () => {
    expect(sampleWith(mipmappedTexture(), LINEAR_WITH_MIPMAPS).anisotropy).toBe(1);
    expect(sampleWith(mipmappedTexture(), NEAREST).anisotropy).toBe(1);
  });

  it('wraps an Enabled repeat with RepeatWrapping, a Mirror with MirroredRepeatWrapping, and clamps Disabled', () => {
    const wrapOf = (repeat: number) => {
      const texture = sampleWith(singleLevelTexture(), LINEAR, repeat);
      return [texture.wrapS, texture.wrapT];
    };
    expect(wrapOf(REPEAT_ENABLED)).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    expect(wrapOf(REPEAT_MIRROR)).toEqual([THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping]);
    expect(wrapOf(REPEAT_DISABLED)).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
  });
});

describe('canvasItemViewSampler', () => {
  it('samples the undecoded bytes the 2D canvas filters', () => {
    expect(canvasItemViewSampler({ filter: LINEAR, repeat: REPEAT_DISABLED }).colorSpace).toBe(
      THREE.NoColorSpace
    );
  });

  it("writes the item's filter and repeat", () => {
    const { filter, wrap } = canvasItemViewSampler({ filter: NEAREST, repeat: REPEAT_MIRROR });
    expect([filter?.magFilter, wrap]).toEqual([THREE.NearestFilter, THREE.MirroredRepeatWrapping]);
  });
});
