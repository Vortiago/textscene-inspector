/**
 * A CanvasItem's effective `texture_filter` and `texture_repeat`: PARENT_NODE takes the nearest concrete
 * ancestor value (`canvas_item.cpp:1625-1699`), else the viewport default: the project setting at the
 * root (`editor_node.cpp:451-460`) and the SubViewport's own property inside one.
 */
import { createContext, useContext, useMemo } from 'react';
import { useEnclosingCanvasState, useInheritedCanvasState } from './canvasItemPass/inheritedCanvasState';
import { useNodePath } from './contexts/NodePathContext';
import { inheritTextureSampler, type AmbientTextureSampler } from './textureSamplerInheritance';
import * as THREE from 'three';
import {
  CanvasItemTextureFilter,
  CanvasItemTextureRepeat,
  canvasItemSamplerFilter,
  canvasItemSamplerRepeat,
} from '../godot/scene/canvasItem';
import type { CanvasItemTextureDefaults } from '../godot/scene/viewport';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import { projectCanvasTextureDefaults } from '../parser/projectSettingsParser';
import { godotTextureFilterState, type TextureFilterState } from '../resources/textures/godotTextureFilter';
import { useProjectSettings } from './contexts/ProjectSettingsContext';
import { useCanvasColorSpace } from './canvasColorSpace';
import type { ViewSampler } from '../resources/textures/textureView';
import type { CanvasTextureData } from '../resources/textures/canvastexture/types';

/** three's wrapping for each of Godot's repeat modes. */
export const WRAP: Record<'clamp' | 'repeat' | 'mirror', THREE.Wrapping> = {
  clamp: THREE.ClampToEdgeWrapping,
  repeat: THREE.RepeatWrapping,
  mirror: THREE.MirroredRepeatWrapping,
};

/**
 * The sampler state of a CanvasItem filter. The mipmap filters read the chain the texture has, and a
 * texture imported without one samples its base level under them, as the NEAREST and LINEAR samplers
 * do (`max_lod = 0`, `material_storage.cpp:2467-2476`). An anisotropic filter reads 4 taps whatever the
 * project or viewport level: the canvas binds the default samplers (`renderer_canvas_render_rd.cpp:460`),
 * which are allocated with the 4x default argument (`material_storage.cpp:1291`, `material_storage.h:370`).
 */
export function canvasItemFilterState(filter: number): TextureFilterState {
  return godotTextureFilterState(canvasItemSamplerFilter(filter));
}

function canvasItemWrap(repeat: number): THREE.Wrapping {
  return WRAP[canvasItemSamplerRepeat(repeat)];
}

/**
 * What a 2D view samples with `sampler` in `colorSpace`: a colour map in its canvas's
 * `textureColorSpace`, a normal or specular map raw.
 */
export function canvasItemViewSampler(
  sampler: CanvasItemTextureSampler,
  colorSpace: THREE.ColorSpace
): ViewSampler {
  return {
    colorSpace,
    filter: canvasItemFilterState(sampler.filter),
    wrap: canvasItemWrap(sampler.repeat),
  };
}

/**
 * `canvasItemViewSampler` for a colour map, in the texture colour space of the canvas the item
 * draws in. Memoised on the sampler and the canvas.
 *
 * @canonical The view sampler of a colour map a canvas item draws
 */
export function useCanvasItemViewSampler(sampler: CanvasItemTextureSampler): ViewSampler {
  const { textureColorSpace } = useCanvasColorSpace();
  return useMemo(() => canvasItemViewSampler(sampler, textureColorSpace), [sampler, textureColorSpace]);
}

/** A CanvasItem's effective sampler, with the viewport default applied. */
export interface CanvasItemTextureSampler {
  filter: number;
  repeat: number;
}

/**
 * Written only by a SubViewport: the default of its own canvas. `null`, with no SubViewport above,
 * is the root viewport, whose default is the project setting.
 */
const ViewportSamplerContext = createContext<CanvasItemTextureDefaults | null>(null);

export const ViewportSamplerProvider = ViewportSamplerContext.Provider;

/** What a PARENT_NODE item with nothing to defer to resolves to: its viewport's default. */
function useViewportTextureDefaults(): CanvasItemTextureDefaults {
  const viewport = useContext(ViewportSamplerContext);
  const { settings } = useProjectSettings();
  return useMemo(() => viewport ?? projectCanvasTextureDefaults(settings), [viewport, settings]);
}

/**
 * The effective filter and repeat of an item that names `ownFilter` and `ownRepeat` below the
 * enclosing drawn item. Idempotent, unlike the modulate product, so a painter may call it on its own
 * properties.
 */
export function useInheritedTextureSampler(
  ownFilter: number | undefined,
  ownRepeat: number | undefined
): CanvasItemTextureSampler {
  return useTextureSamplerOver(ownFilter, ownRepeat, useEnclosingCanvasState().sampler);
}

/** The effective filter and repeat of an item that names `ownFilter` and `ownRepeat` and inherits `ambient`. */
export function useTextureSamplerOver(
  ownFilter: number | undefined,
  ownRepeat: number | undefined,
  ambient: AmbientTextureSampler
): CanvasItemTextureSampler {
  const viewport = useViewportTextureDefaults();
  const named = inheritTextureSampler({ filter: ownFilter, repeat: ownRepeat }, ambient);
  const filter = named.filter ?? viewport.filter;
  const repeat = named.repeat ?? viewport.repeat;
  // Keyed on the two values, not the contexts: a new settings object with the same defaults must
  // not hand every textured item a new sampler, which re-clones and re-uploads its texture.
  return useMemo(() => ({ filter, repeat }), [filter, repeat]);
}

/** The effective sampler of the Node2D the dispatcher draws here, from its own properties. */
export function useNode2DTextureSampler(
  props: Pick<Node2DProperties, 'texture_filter' | 'texture_repeat'>
): CanvasItemTextureSampler {
  const { sampler } = useInheritedCanvasState(useNodePath());
  return useTextureSamplerOver(props.texture_filter, props.texture_repeat, sampler);
}

/**
 * The sampler a Control painter draws with: the one its Control's group hands down, which is the
 * Control's own. A Node2D reads its sampler before its own group exists, so it lays its properties
 * over what it inherits with `useNode2DTextureSampler`.
 */
export function useResolvedTextureSampler(): CanvasItemTextureSampler {
  return useInheritedTextureSampler(undefined, undefined);
}

/**
 * The sampler an item draws a CanvasTexture with: the texture's own filter and repeat, each unless
 * it inherits (`texture_storage.cpp:737-738`), else the item's. `item` itself while nothing
 * overrides it, so a texture view keyed on the sampler keeps.
 */
export function useCanvasTextureSampler(
  item: CanvasItemTextureSampler,
  texture: Pick<CanvasTextureData, 'textureFilter' | 'textureRepeat'> | undefined
): CanvasItemTextureSampler {
  const filter = texture?.textureFilter ?? CanvasItemTextureFilter.PARENT_NODE;
  const repeat = texture?.textureRepeat ?? CanvasItemTextureRepeat.PARENT_NODE;
  return useMemo(() => {
    const named = inheritTextureSampler({ filter, repeat }, item);
    const unchanged = named.filter === item.filter && named.repeat === item.repeat;
    return unchanged ? item : { filter: named.filter ?? item.filter, repeat: named.repeat ?? item.repeat };
  }, [item, filter, repeat]);
}
