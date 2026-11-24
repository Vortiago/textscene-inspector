import { describe, expect, it } from 'vitest';
import type { TranspiledUniform } from './transpiledUniform.js';
import { TranslatorFault } from '../fault/translatorFault.js';
import { BoundNodeMaterial } from './boundMaterial.js';
import { Specialisation } from '../template/specialisation.js';

const uniform = (isDrawable: boolean) => ({ isDrawable }) as TranspiledUniform;

const SOURCE = { text: 'shader_type spatial;', file: 'res://tint.gdshader' };

const materialOf = (parameters: TranspiledUniform[]) => new BoundNodeMaterial({ parameters, source: SOURCE });

/** A material whose programs fold one specialisation constant, which starts at 0. */
function specialised() {
  const constant = new Specialisation('uint', 0);
  const specialisations = new Map([['packed', constant]]);
  const material = new BoundNodeMaterial({ parameters: [], source: SOURCE, specialisations });
  material.stageWith(() => {});
  return { constant, material };
}

describe('the specialisation constants of a BoundNodeMaterial', () => {
  it('give a program key of their values', () => {
    const { constant, material } = specialised();
    const before = material.customProgramCacheKey();
    constant.value = 64;
    expect(material.customProgramCacheKey()).not.toBe(before);
  });

  it('key the first program on the values its draw writes before three keys it', () => {
    const { constant, material } = specialised();
    material.onBeforeProgram = () => {
      constant.value = 64;
    };
    expect(material.customProgramCacheKey()).toMatch(/\|64$/);
  });

  it('ask for the program of a new value', () => {
    const { constant, material } = specialised();
    const version = material.version;
    constant.value = 64;
    expect(material.version).toBe(version + 1);
  });

  it('emit the stages again for a new value', () => {
    const { constant, material } = specialised();
    let stagings = 0;
    material.stageWith(() => stagings++);
    constant.value = 64;
    expect(stagings).toBe(2);
  });

  it('ask for no program when a binding writes the same value', () => {
    const { constant, material } = specialised();
    const version = material.version;
    constant.value = 0;
    expect(material.version).toBe(version);
  });

  it('stop asking once the material is disposed', () => {
    const { constant, material } = specialised();
    material.dispose();
    expect(constant.readers.size).toBe(0);
  });
});

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
