/**
 * Ordinal allocation on a canvas. Lights of any reach can share an item's list buffer and its
 * 8-bit stencil, so the ordinal keeps their shadow stamps apart: distinct on the canvas and dense
 * for 255 values.
 */

import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLighting2DProvider, useRegisterCanvasLight2D } from './CanvasLighting2D';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from './lightCullKey';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** Reports every ordinal this light has been given, newest last. */
function Light({ reach = DEFAULT_LIGHT_CULL_KEY, seen }: { reach?: LightCullKey; seen: (number | null)[] }) {
  seen.push(useRegisterCanvasLight2D(true, { reach, shadowItemCullMask: null, tintsShadow: false }));
  return null;
}

function provider(children: ReactNode) {
  return <CanvasLighting2DProvider canvasModulate={WHITE}>{children}</CanvasLighting2DProvider>;
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
}

async function mount(children: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(provider(children));
  await settle();
  return renderer;
}

describe('useRegisterCanvasLight2D', () => {
  it('numbers the lights on a canvas from zero, densely', async () => {
    const a: (number | null)[] = [];
    const b: (number | null)[] = [];
    const c: (number | null)[] = [];
    await mount(
      <>
        <Light seen={a} />
        <Light seen={b} />
        <Light seen={c} />
      </>
    );
    expect([a.at(-1), b.at(-1), c.at(-1)]).toEqual([0, 1, 2]);
  });

  it('keeps one numbering across lights of different reach', async () => {
    // An item both reach draws both into one buffer, so a repeated ordinal would make one light
    // reject the other's shadow.
    const first: (number | null)[] = [];
    const second: (number | null)[] = [];
    await mount(
      <>
        <Light seen={first} />
        <Light reach={{ ...DEFAULT_LIGHT_CULL_KEY, itemCullMask: 2 }} seen={second} />
      </>
    );
    expect([first.at(-1), second.at(-1)]).toEqual([0, 1]);
  });

  it('hands a withdrawn ordinal to the next light rather than growing', async () => {
    const a: (number | null)[] = [];
    const b: (number | null)[] = [];
    const late: (number | null)[] = [];
    const renderer = await mount(
      <>
        <Light key="a" seen={a} />
        <Light key="b" seen={b} />
      </>
    );
    expect([a.at(-1), b.at(-1)]).toEqual([0, 1]);

    await renderer.update(
      provider(
        <>
          <Light key="a" seen={a} />
          <Light key="late" seen={late} />
        </>
      )
    );
    await settle();
    expect(late.at(-1)).toBe(1);
  });

  it('gives null until the light is declared, so no stencil ref derives from a guess', async () => {
    const seen: (number | null)[] = [];
    await mount(<Light seen={seen} />);
    expect(seen[0]).toBeNull();
    expect(seen.at(-1)).toBe(0);
  });
});
