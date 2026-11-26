import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useLayoutEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ItemPlacement, LitItemRead } from '../lighting2d/itemLightList';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../lighting2d/lightPassContext';
import { LitCanvasItemPixels, useTemplateDrawClaim } from './LitCanvasItemPixels';

/** The reads the item declares now: each registration not yet released. */
function spyReads() {
  const reads = new Set<LitItemRead>();
  const registerItem = vi.fn((_placement: ItemPlacement, read: LitItemRead) => {
    reads.add(read);
    return () => reads.delete(read);
  });
  const value: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, registerItem };
  const Wrap = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return { Wrap, reads };
}

/** A template draw of the item's pixels, which holds them while mounted. */
function TemplateDraw() {
  const claim = useTemplateDrawClaim();
  useLayoutEffect(() => claim?.(), [claim]);
  return null;
}

async function itemWith(children: ReactNode) {
  const { Wrap, reads } = spyReads();
  const tree = (inside: ReactNode) => (
    <Wrap>
      <LitCanvasItemPixels material={null} lightMask={undefined} zFinal={0}>
        {inside}
      </LitCanvasItemPixels>
    </Wrap>
  );
  const renderer = await ReactThreeTestRenderer.create(tree(children));
  return { reads, redraw: (inside: ReactNode) => renderer.update(tree(inside)) };
}

describe('LitCanvasItemPixels', () => {
  it('declares the plain light read of pixels it draws itself', async () => {
    const { reads } = await itemWith(null);
    expect([...reads]).toEqual(['plain']);
  });

  it('declares no light read while a template draw holds its pixels, as the template lights them', async () => {
    const { reads } = await itemWith(<TemplateDraw />);
    expect([...reads]).toEqual([]);
  });

  it('declares the read again once the template draw lets the pixels go', async () => {
    const { reads, redraw } = await itemWith(<TemplateDraw />);
    await redraw(null);
    expect([...reads]).toEqual(['plain']);
  });
});
