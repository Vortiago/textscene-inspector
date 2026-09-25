/**
 * Slot allocation in a light class, one cull tuple of `drivers/gles3/rasterizer_canvas_gles3.cpp`
 * and `servers/rendering/renderer_viewport.cpp`. A class shares one pass and 8-bit stencil, so the
 * ordinal keeps its shadow stamps apart: distinct in a class, dense for 255 values, and free to
 * repeat across classes.
 */

import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLighting2DProvider, useRegisterCanvasLight2D } from './CanvasLighting2D';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from './lightCullKey';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** A cull key with Godot's defaults, overridden field by field. */
function key(overrides: Partial<LightCullKey> = {}): LightCullKey {
  return { ...DEFAULT_LIGHT_CULL_KEY, ...overrides };
}

const DEFAULT_KEY = key();
const MASK_2_KEY = key({ itemCullMask: 2 });

/** Reports every ordinal this light has been given, newest last. */
function Light({ cullKey, seen }: { cullKey: LightCullKey; seen: number[] }) {
  seen.push(useRegisterCanvasLight2D(true, cullKey));
  return null;
}

async function mount(children: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasLighting2DProvider canvasModulate={WHITE}>{children}</CanvasLighting2DProvider>
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

describe('useRegisterCanvasLight2D', () => {
  it('numbers the lights of one class from zero, densely', async () => {
    const a: number[] = [];
    const b: number[] = [];
    const c: number[] = [];
    await mount(
      <>
        <Light cullKey={DEFAULT_KEY} seen={a} />
        <Light cullKey={DEFAULT_KEY} seen={b} />
        <Light cullKey={DEFAULT_KEY} seen={c} />
      </>
    );
    expect([a.at(-1), b.at(-1), c.at(-1)]).toEqual([0, 1, 2]);
  });

  it('keeps two lights in one class when only their key VALUES match', async () => {
    // The registry is keyed by the tuple's value, never by object identity: a
    // light rebuilds its key object whenever its component re-renders.
    const a: number[] = [];
    const b: number[] = [];
    await mount(
      <>
        <Light cullKey={key({ zMax: 4 })} seen={a} />
        <Light cullKey={key({ zMax: 4 })} seen={b} />
      </>
    );
    expect([a.at(-1), b.at(-1)]).toEqual([0, 1]);
  });

  it('restarts the numbering in a second class', async () => {
    // Nothing draws two classes into one stencil, so reusing 0 costs nothing, and not reusing it
    // would burn the 255-value range on a scene with many classes.
    const first: number[] = [];
    const second: number[] = [];
    await mount(
      <>
        <Light cullKey={DEFAULT_KEY} seen={first} />
        <Light cullKey={MASK_2_KEY} seen={second} />
      </>
    );
    expect([first.at(-1), second.at(-1)]).toEqual([0, 0]);
  });

  it('splits a class on a z window even when the cull masks agree', async () => {
    // The accumulator is a screen-space sum, so a light that reaches fewer items
    // than its pass-mate cannot be un-summed per fragment. It needs its own pass.
    const first: number[] = [];
    const second: number[] = [];
    await mount(
      <>
        <Light cullKey={DEFAULT_KEY} seen={first} />
        <Light cullKey={key({ zMax: 4 })} seen={second} />
      </>
    );
    expect([first.at(-1), second.at(-1)]).toEqual([0, 0]);
  });

  it('splits a class on a layer window even when the cull masks agree', async () => {
    const first: number[] = [];
    const second: number[] = [];
    await mount(
      <>
        <Light cullKey={DEFAULT_KEY} seen={first} />
        <Light cullKey={key({ layerMax: 1 })} seen={second} />
      </>
    );
    expect([first.at(-1), second.at(-1)]).toEqual([0, 0]);
  });

  it('hands a withdrawn ordinal to the next light rather than growing', async () => {
    const a: number[] = [];
    const b: number[] = [];
    const late: number[] = [];
    const renderer = await mount(
      <>
        <Light cullKey={DEFAULT_KEY} seen={a} />
        <Light cullKey={DEFAULT_KEY} seen={b} />
      </>
    );
    expect([a.at(-1), b.at(-1)]).toEqual([0, 1]);

    await renderer.update(
      <CanvasLighting2DProvider canvasModulate={WHITE}>
        <Light cullKey={DEFAULT_KEY} seen={a} />
        <Light cullKey={DEFAULT_KEY} seen={late} />
      </CanvasLighting2DProvider>
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(late.at(-1)).toBe(1);
  });

  it('gives 0 while a light is registering, which is a real ordinal', async () => {
    // Nothing has a slot on the mount pass, so the first render must not invent one: a light that
    // reported -1 or NaN would derive a stencil ref from it.
    const seen: number[] = [];
    await mount(<Light cullKey={DEFAULT_KEY} seen={seen} />);
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(0);
  });
});
