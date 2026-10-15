/**
 * `useInheritedTextureSampler`, the rule of the texture caches
 * (`scene/main/canvas_item.cpp:1625-1699`): PARENT_NODE (0,
 * `scene/main/canvas_item.h:52-69`) defers to the ambient, and a concrete value
 * wins. `ControlCanvasWalker.test.tsx` covers the propagation through the walker.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TextureSampler2DContext, useInheritedTextureSampler } from './canvasItemTextureSampler';

const PARENT_NODE = 0; // TEXTURE_FILTER_PARENT_NODE and TEXTURE_REPEAT_PARENT_NODE, canvas_item.h:52-69
const NEAREST = 1; // TEXTURE_FILTER_NEAREST
const LINEAR = 2; // TEXTURE_FILTER_LINEAR
const REPEAT_ENABLED = 2; // TEXTURE_REPEAT_ENABLED
const REPEAT_MIRROR = 3; // TEXTURE_REPEAT_MIRROR

interface Sampler {
  filter: number | undefined;
  repeat: number | undefined;
}

function resolveUnder(
  ambient: Sampler,
  ownFilter: number | undefined,
  ownRepeat: number | undefined
): Sampler {
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
    const root = { filter: undefined, repeat: undefined };
    const grandparent = resolveUnder(root, NEAREST, undefined);
    const middle = resolveUnder(grandparent, PARENT_NODE, PARENT_NODE);
    expect(resolveUnder(middle, PARENT_NODE, PARENT_NODE).filter).toBe(NEAREST);
  });

  it('resolves to undefined when no ancestor names a value, the cue for the viewport default', () => {
    const root = { filter: undefined, repeat: undefined };
    expect(resolveUnder(root, PARENT_NODE, PARENT_NODE)).toEqual(root);
  });

  it('resolves filter and repeat independently', () => {
    const root = { filter: undefined, repeat: undefined };
    expect(resolveUnder(root, NEAREST, PARENT_NODE)).toEqual({ filter: NEAREST, repeat: undefined });
  });
});
