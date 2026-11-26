import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useLayoutEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasLightDeclaration, ItemPlacement, LitItemRead } from '../lighting2d/itemLightList';
import { directionalLightCullKey } from '../lighting2d/lightCullKey';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../lighting2d/lightPassContext';
import { LitCanvasItemPixels, useTemplateDrawClaim } from './LitCanvasItemPixels';

/** The reads the item declares now: each registration not yet released. */
/** A DirectionalLight2D that casts a shadow on every lit item of layer 0. */
const SHADOWING_SUN: CanvasLightDeclaration = {
  reach: directionalLightCullKey(0, 0),
  sequence: null,
  slot: 0,
  shadowItemCullMask: null,
  castsShadow: true,
  tintsShadow: false,
  mixes: false,
};

function spyReads(lights: ReadonlyMap<number, CanvasLightDeclaration> = new Map()) {
  const reads = new Set<LitItemRead>();
  const registerItem = vi.fn((_placement: ItemPlacement, read: LitItemRead) => {
    reads.add(read);
    return () => reads.delete(read);
  });
  const value: CanvasLighting2D = { ...INERT_CANVAS_LIGHTING, lights, registerItem };
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

async function itemWith(children: ReactNode, lights?: ReadonlyMap<number, CanvasLightDeclaration>) {
  const { Wrap, reads } = spyReads(lights);
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

  it('keeps the plain light read under a shadowing light, as the template draws no 2D shadow yet', async () => {
    const { reads } = await itemWith(<TemplateDraw />, new Map([[0, SHADOWING_SUN]]));
    expect([...reads]).toEqual(['plain']);
  });

  it('declares the read again once the template draw lets the pixels go', async () => {
    const { reads, redraw } = await itemWith(<TemplateDraw />);
    await redraw(null);
    expect([...reads]).toEqual(['plain']);
  });
});
