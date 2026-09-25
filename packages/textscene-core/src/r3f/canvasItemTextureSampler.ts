/**
 * A CanvasItem's effective `texture_filter` and `texture_repeat`
 * (`scene/main/canvas_item.h:52-69`): PARENT_NODE (0 in both) takes the nearest
 * concrete ancestor value or the viewport default, each through its own cache
 * (`scene/main/canvas_item.cpp:1625-1699`). Only the Control walk reads it so far.
 */
import { createContext, useContext, useMemo } from 'react';

/** `TEXTURE_FILTER_PARENT_NODE` and `TEXTURE_REPEAT_PARENT_NODE`, both 0. */
export const CANVAS_ITEM_SAMPLER_INHERIT = 0;

export interface CanvasItemTextureSampler {
  /** Effective `texture_filter` ordinal, or `undefined` when no ancestor ever named one (viewport default). */
  filter: number | undefined;
  /** Effective `texture_repeat` ordinal, or `undefined` when no ancestor ever named one (viewport default). */
  repeat: number | undefined;
}

/** No ancestor names either property: the viewport default, as every reader reads an absent value. */
export const ROOT_TEXTURE_SAMPLER: CanvasItemTextureSampler = { filter: undefined, repeat: undefined };

export const TextureSampler2DContext = createContext<CanvasItemTextureSampler>(ROOT_TEXTURE_SAMPLER);

/** The ambient sampler, which an unnamed (PARENT_NODE) property resolves to. */
export function useParentTextureSampler(): CanvasItemTextureSampler {
  return useContext(TextureSampler2DContext);
}

/**
 * One property's resolution rule, shared by filter and repeat since both
 * enums use 0 for PARENT_NODE: an unnamed own value defers to the ambient;
 * a concrete one wins and is what gets published back out.
 */
export function resolveInheritedSamplerValue(
  own: number | undefined,
  ambient: number | undefined
): number | undefined {
  return own === undefined || own === CANVAS_ITEM_SAMPLER_INHERIT ? ambient : own;
}

/**
 * This node's effective filter and repeat, which its descendants inherit.
 * Idempotent, unlike the modulate product, so a painter mounted without a walker
 * may call it on its own properties.
 */
export function useInheritedTextureSampler(
  ownFilter: number | undefined,
  ownRepeat: number | undefined
): CanvasItemTextureSampler {
  const parent = useParentTextureSampler();
  return useMemo(
    () => ({
      filter: resolveInheritedSamplerValue(ownFilter, parent.filter),
      repeat: resolveInheritedSamplerValue(ownRepeat, parent.repeat),
    }),
    [ownFilter, ownRepeat, parent]
  );
}
