/**
 * A CanvasItem's effective `texture_filter`/`texture_repeat`
 * (`CanvasItem::TextureFilter`/`TextureRepeat`, `scene/main/canvas_item.h:52-69`):
 * PARENT_NODE (0, shared by both enums) walks up to the nearest ancestor that
 * names a concrete one, falling back to the viewport default when none does
 * (`CanvasItem::_refresh_texture_filter_cache`/`_refresh_texture_repeat_cache`,
 * `scene/main/canvas_item.cpp:1625-1699` — a PARENT_NODE ancestor just relays
 * whatever ITS OWN cache already resolved, so it is transparent rather than a
 * wall). The two properties propagate through separate caches in Godot and
 * resolve independently here too.
 *
 * Lives here rather than under `controls/native/` (unlike `Modulate2DContext`'s
 * neighbour `controlTint.ts`): `texture_filter`/`texture_repeat` belong to
 * EVERY CanvasItem, not just Control, so a future Node2D walk can subscribe to
 * the same context once it starts parsing these properties (out of scope
 * here — see `nodes/2d/ui/texturerect/comparison.md`).
 */
import { createContext, useContext, useMemo } from 'react';

/** `TEXTURE_FILTER_PARENT_NODE` / `TEXTURE_REPEAT_PARENT_NODE` — both 0. */
export const CANVAS_ITEM_SAMPLER_INHERIT = 0;

export interface CanvasItemTextureSampler {
  /** Effective `texture_filter` ordinal, or `undefined` when no ancestor ever named one (viewport default). */
  filter: number | undefined;
  /** Effective `texture_repeat` ordinal, or `undefined` when no ancestor ever named one (viewport default). */
  repeat: number | undefined;
}

/** No ancestor names either property — the viewport-default cue every reader already treats an absent value as. */
export const ROOT_TEXTURE_SAMPLER: CanvasItemTextureSampler = { filter: undefined, repeat: undefined };

export const TextureSampler2DContext = createContext<CanvasItemTextureSampler>(ROOT_TEXTURE_SAMPLER);

/** The ambient sampler — what an unnamed (PARENT_NODE) property resolves to. */
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
 * This node's effective filter/repeat — also the value its descendants inherit.
 *
 * Idempotent, unlike modulate's multiplicative fold: a painter may call this on
 * its own properties even though the walker already did, which is what keeps a
 * painter correct when mounted without one.
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
