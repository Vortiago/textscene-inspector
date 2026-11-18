import { describe, expect, it } from 'vitest';
import type { TranspiledUniform } from './transpiledUniform.js';
import { TranslatorFault } from '../fault/translatorFault.js';
import { BoundNodeMaterial } from './boundMaterial.js';

const uniform = (isDrawable: boolean) => ({ isDrawable }) as TranspiledUniform;

const SOURCE = { text: 'shader_type spatial;', file: 'res://tint.gdshader' };

const materialOf = (parameters: TranspiledUniform[]) => new BoundNodeMaterial({ parameters, source: SOURCE });

describe('BoundNodeMaterial', () => {
  it('is visible while every uniform can draw', () => {
    expect(materialOf([uniform(true), uniform(true)]).visible).toBe(true);
  });

  it('is not visible while a uniform cannot draw', () => {
    expect(materialOf([uniform(true), uniform(false)]).visible).toBe(false);
  });

  it('is not visible while the caller hides it', () => {
    const material = materialOf([uniform(true)]);
    material.visible = false;
    expect(material.visible).toBe(false);
  });

  it('keeps the gate in a clone', () => {
    const blocked = { isDrawable: false };
    const clone = materialOf([blocked as TranspiledUniform]).clone();
    const hidden = clone.visible;
    blocked.isDrawable = true;
    expect([hidden, clone.visible]).toEqual([false, true]);
  });

  it("keeps the caller's choice, not the gate's answer, in a clone", () => {
    const blocked = { isDrawable: false };
    const clone = materialOf([blocked as TranspiledUniform]).clone();
    blocked.isDrawable = true;
    expect(clone.visible).toBe(true);
  });

  it('keeps its source and its fault hook in a clone', () => {
    const material = materialOf([]);
    material.onTranslatorFault = () => {};
    const clone = material.clone();
    expect([clone.source, clone.onTranslatorFault]).toEqual([SOURCE, material.onTranslatorFault]);
  });

  it('hands a fault to its hook', () => {
    const material = materialOf([]);
    const faults: TranslatorFault[] = [];
    material.onTranslatorFault = (fault) => faults.push(fault);
    const fault = new TranslatorFault(SOURCE, 'program: Could not pack varying');
    material.reportFault(fault);
    expect(faults).toEqual([fault]);
  });
});
