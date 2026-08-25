/**
 * `resolveInheritedSamplerValue` — the pure resolution rule behind
 * `CanvasItem::_refresh_texture_filter_cache`/`_refresh_texture_repeat_cache`
 * (`scene/main/canvas_item.cpp:1625-1699`): PARENT_NODE (0, shared by
 * `TextureFilter` and `TextureRepeat`, `scene/main/canvas_item.h:52-69`)
 * defers to the ambient; a concrete value wins outright and is what
 * propagates. No context/React involved — see
 * `ControlCanvasWalker.test.tsx`'s walker-level suite for the propagation
 * itself.
 */
import { describe, expect, it } from 'vitest';
import {
  CANVAS_ITEM_SAMPLER_INHERIT,
  resolveInheritedSamplerValue,
} from './canvasItemTextureSampler';

const NEAREST = 1; // TEXTURE_FILTER_NEAREST / (unused by repeat, ordinal only)
const LINEAR = 2; // TEXTURE_FILTER_LINEAR
const REPEAT_ENABLED = 2; // TEXTURE_REPEAT_ENABLED
const REPEAT_MIRROR = 3; // TEXTURE_REPEAT_MIRROR

describe('resolveInheritedSamplerValue', () => {
  it('a concrete own value wins outright, regardless of ambient', () => {
    expect(resolveInheritedSamplerValue(NEAREST, LINEAR)).toBe(NEAREST);
    expect(resolveInheritedSamplerValue(REPEAT_MIRROR, REPEAT_ENABLED)).toBe(REPEAT_MIRROR);
  });

  it('PARENT_NODE (0) defers to the ambient — the nearest NAMING ancestor wins', () => {
    expect(resolveInheritedSamplerValue(CANVAS_ITEM_SAMPLER_INHERIT, NEAREST)).toBe(NEAREST);
  });

  it('an absent own value (never authored) behaves exactly like PARENT_NODE', () => {
    expect(resolveInheritedSamplerValue(undefined, NEAREST)).toBe(NEAREST);
  });

  it('a PARENT_NODE ancestor is transparent: it relays whatever IT resolved, never resetting to undefined', () => {
    // Godot's own chain: grandparent names NEAREST, an in-between PARENT_NODE
    // node's cache is just its OWN parent's cache (`_refresh...cache`'s
    // `parent_item->texture_filter_cache` branch) — modelled here as two
    // resolve calls composed, exactly as the walker composes them one Control
    // at a time.
    const grandparentEffective = resolveInheritedSamplerValue(NEAREST, undefined);
    const middleEffective = resolveInheritedSamplerValue(
      CANVAS_ITEM_SAMPLER_INHERIT,
      grandparentEffective
    );
    const leafEffective = resolveInheritedSamplerValue(CANVAS_ITEM_SAMPLER_INHERIT, middleEffective);
    expect(leafEffective).toBe(NEAREST);
  });

  it('no ancestor ever names one: resolves to undefined, the caller\'s cue to use the viewport default', () => {
    expect(resolveInheritedSamplerValue(CANVAS_ITEM_SAMPLER_INHERIT, undefined)).toBeUndefined();
  });

  it('filter and repeat resolve independently — one naming, the other still deferring', () => {
    const filter = resolveInheritedSamplerValue(NEAREST, undefined);
    const repeat = resolveInheritedSamplerValue(CANVAS_ITEM_SAMPLER_INHERIT, undefined);
    expect(filter).toBe(NEAREST);
    expect(repeat).toBeUndefined();
  });
});
