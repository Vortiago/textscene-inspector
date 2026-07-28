/**
 * Slot allocation inside a cull-mask class.
 *
 * Lights of one class accumulate into ONE buffer in ONE pass, so their shadow
 * stamps share an 8-bit stencil. The ordinal is what keeps those stamps apart,
 * and three properties make it usable: distinct within a class, DENSE (they
 * index a 255-value stencil), and independent across classes (a class pass
 * renders no other class's layer, so two classes may reuse the same number).
 */

import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLighting2DProvider, useRegisterCanvasLight2D } from './CanvasLighting2D';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** Reports every ordinal this light has been given, newest last. */
function Light({ cullMask, seen }: { cullMask: number; seen: number[] }) {
  seen.push(useRegisterCanvasLight2D(true, cullMask));
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
        <Light cullMask={1} seen={a} />
        <Light cullMask={1} seen={b} />
        <Light cullMask={1} seen={c} />
      </>
    );
    expect([a.at(-1), b.at(-1), c.at(-1)]).toEqual([0, 1, 2]);
  });

  it('restarts the numbering in a second class', async () => {
    // Nothing draws two classes into one stencil, so reusing 0 costs nothing —
    // and NOT reusing it would burn the 255-value range on a scene with many
    // classes.
    const first: number[] = [];
    const second: number[] = [];
    await mount(
      <>
        <Light cullMask={1} seen={first} />
        <Light cullMask={2} seen={second} />
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
        <Light cullMask={1} seen={a} />
        <Light cullMask={1} seen={b} />
      </>
    );
    expect([a.at(-1), b.at(-1)]).toEqual([0, 1]);

    await renderer.update(
      <CanvasLighting2DProvider canvasModulate={WHITE}>
        <Light cullMask={1} seen={a} />
        <Light cullMask={1} seen={late} />
      </CanvasLighting2DProvider>
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(late.at(-1)).toBe(1);
  });

  it('gives 0 while a light is registering, which is a real ordinal', async () => {
    // Nothing has a slot on the mount pass, so the first render must not invent
    // one — a light that reported -1 or NaN would derive a stencil ref from it.
    const seen: number[] = [];
    await mount(<Light cullMask={1} seen={seen} />);
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(0);
  });
});
