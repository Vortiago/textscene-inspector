/**
 * A CanvasItem's effective `texture_filter` and `texture_repeat`: PARENT_NODE takes the nearest concrete
 * ancestor value (`canvas_item.cpp:1625-1699`), else the viewport default: the project setting at the
 * root (`editor_node.cpp:451-460`) and the SubViewport's own property inside one.
 */
import { createContext, useContext, useMemo } from 'react';
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
import { godotTextureFilterState, applyTextureFilterState } from '../resources/textures/godotTextureFilter';
import { useProjectSettings } from './contexts/ProjectSettingsContext';

/** three's wrapping for each of Godot's repeat modes. */
export const WRAP: Record<'clamp' | 'repeat' | 'mirror', THREE.Wrapping> = {
  clamp: THREE.ClampToEdgeWrapping,
  repeat: THREE.RepeatWrapping,
  mirror: THREE.MirroredRepeatWrapping,
};

/**
 * Writes a filter onto a texture the caller owns. The mipmap filters read the chain the texture has,
 * and a texture imported without one samples its base level under them, as the NEAREST and LINEAR
 * samplers do (`max_lod = 0`, `material_storage.cpp:2467-2476`). An anisotropic filter reads 4 taps whatever
 * the project or viewport level: the canvas binds the default samplers (`renderer_canvas_render_rd.cpp:460`),
 * which are allocated with the 4x default argument (`material_storage.cpp:1291`, `material_storage.h:370`).
 */
export function applyCanvasItemFilter(texture: THREE.Texture, filter: number): void {
  applyTextureFilterState(texture, godotTextureFilterState(canvasItemSamplerFilter(filter)));
}

/** Writes a resolved sampler's filter and wrap onto a texture the caller owns, before it first uploads. */
export function applyCanvasItemSampler(texture: THREE.Texture, sampler: CanvasItemTextureSampler): void {
  applyCanvasItemFilter(texture, sampler.filter);
  const wrap = WRAP[canvasItemSamplerRepeat(sampler.repeat)];
  texture.wrapS = wrap;
  texture.wrapT = wrap;
}

/** What the ancestors name, `undefined` where none does. */
export interface AmbientTextureSampler {
  filter: number | undefined;
  repeat: number | undefined;
}

/** A CanvasItem's effective sampler, with the viewport default applied. */
export interface CanvasItemTextureSampler {
  filter: number;
  repeat: number;
}

/** No ancestor names either property, so the viewport default applies. */
export const ROOT_TEXTURE_SAMPLER: AmbientTextureSampler = { filter: undefined, repeat: undefined };

export const TextureSampler2DContext = createContext<AmbientTextureSampler>(ROOT_TEXTURE_SAMPLER);

/**
 * Written only by a SubViewport: the default of its own canvas. `null`, with no SubViewport above,
 * is the root viewport, whose default is the project setting.
 */
const ViewportSamplerContext = createContext<CanvasItemTextureDefaults | null>(null);

export const ViewportSamplerProvider = ViewportSamplerContext.Provider;

/** The ambient sampler, which an unnamed (PARENT_NODE) property resolves to. */
function useParentTextureSampler(): AmbientTextureSampler {
  return useContext(TextureSampler2DContext);
}

/** What a PARENT_NODE item with nothing to defer to resolves to: its viewport's default. */
function useViewportTextureDefaults(): CanvasItemTextureDefaults {
  const viewport = useContext(ViewportSamplerContext);
  const { settings } = useProjectSettings();
  return useMemo(() => viewport ?? projectCanvasTextureDefaults(settings), [viewport, settings]);
}

/**
 * One property's resolution rule, shared by filter and repeat: an unnamed own value or the
 * property's PARENT_NODE defers to the ambient; a concrete one wins and is what gets published back out.
 */
function resolveInheritedSamplerValue(
  own: number | undefined,
  ambient: number | undefined,
  parentNode: number
): number | undefined {
  return own === undefined || own === parentNode ? ambient : own;
}

/** `own` laid over `ambient`: the sampler a node's descendants inherit, still with gaps where none names one. */
export function inheritTextureSampler(
  own: AmbientTextureSampler,
  ambient: AmbientTextureSampler
): AmbientTextureSampler {
  return {
    filter: resolveInheritedSamplerValue(own.filter, ambient.filter, CanvasItemTextureFilter.PARENT_NODE),
    repeat: resolveInheritedSamplerValue(own.repeat, ambient.repeat, CanvasItemTextureRepeat.PARENT_NODE),
  };
}

/**
 * This node's effective filter and repeat, which its descendants inherit. Idempotent, unlike the
 * modulate product, so a painter may call it on its own properties. `skippedAncestors` names the
 * Node2D ancestors a promoted Control was walked past.
 */
export function useInheritedTextureSampler(
  ownFilter: number | undefined,
  ownRepeat: number | undefined,
  skippedAncestors: AmbientTextureSampler = ROOT_TEXTURE_SAMPLER
): CanvasItemTextureSampler {
  const parent = useParentTextureSampler();
  const viewport = useViewportTextureDefaults();
  const named = inheritTextureSampler(
    { filter: ownFilter, repeat: ownRepeat },
    inheritTextureSampler(skippedAncestors, parent)
  );
  const filter = named.filter ?? viewport.filter;
  const repeat = named.repeat ?? viewport.repeat;
  // Keyed on the two values, not the contexts: a new settings object with the same defaults must
  // not hand every textured item a new sampler, which re-clones and re-uploads its texture.
  return useMemo(() => ({ filter, repeat }), [filter, repeat]);
}

/** `useInheritedTextureSampler` for a Node2D's own properties. */
export function useNode2DTextureSampler(
  props: Pick<Node2DProperties, 'texture_filter' | 'texture_repeat'>
): CanvasItemTextureSampler {
  return useInheritedTextureSampler(props.texture_filter, props.texture_repeat);
}

/**
 * The sampler a Control painter draws with. `ControlCanvasWalker` publishes the node's own effective
 * sampler around the painter, so the painter reads it as is, where a Node2D reads it before its own
 * group exists and so lays its properties over the ambient with `useInheritedTextureSampler`.
 */
export function useResolvedTextureSampler(): CanvasItemTextureSampler {
  return useInheritedTextureSampler(undefined, undefined);
}
