/**
 * `resolveInheritedSamplerValue`, the rule of the texture caches
 * (`scene/main/canvas_item.cpp:1625-1699`): PARENT_NODE (0,
 * `scene/main/canvas_item.h:52-69`) defers to the ambient, and a concrete value
 * wins. `ControlCanvasWalker.test.tsx` covers the propagation.
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
    // Godot's chain: the grandparent names NEAREST, and a PARENT_NODE node between
    // takes its parent's cache (`parent_item->texture_filter_cache`), so two
    // composed calls model it, as the walker composes them.
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
