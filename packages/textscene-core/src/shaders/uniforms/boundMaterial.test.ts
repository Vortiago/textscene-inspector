import { describe, expect, it } from 'vitest';
import type { TranspiledUniform } from './transpiledUniform.js';
import { BoundNodeMaterial } from './boundMaterial.js';

const uniform = (isDrawable: boolean) => ({ isDrawable }) as TranspiledUniform;

describe('BoundNodeMaterial', () => {
  it('is visible while every uniform can draw', () => {
    expect(new BoundNodeMaterial([uniform(true), uniform(true)]).visible).toBe(true);
  });

  it('is not visible while a uniform cannot draw', () => {
    expect(new BoundNodeMaterial([uniform(true), uniform(false)]).visible).toBe(false);
  });

  it('is not visible while the caller hides it', () => {
    const material = new BoundNodeMaterial([uniform(true)]);
    material.visible = false;
    expect(material.visible).toBe(false);
  });

  it('keeps the gate in a clone', () => {
    const blocked = { isDrawable: false };
    const clone = new BoundNodeMaterial([blocked as TranspiledUniform]).clone();
    const hidden = clone.visible;
    blocked.isDrawable = true;
    expect([hidden, clone.visible]).toEqual([false, true]);
  });

  it("keeps the caller's choice, not the gate's answer, in a clone", () => {
    const blocked = { isDrawable: false };
    const clone = new BoundNodeMaterial([blocked as TranspiledUniform]).clone();
    blocked.isDrawable = true;
    expect(clone.visible).toBe(true);
  });
});
