import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { coversOneSample } from './oneSampleTarget.js';

/** A renderer that draws into `target`, or into a canvas whose context is `antialias`. */
function rendererOn(target: { samples: number } | null, antialias = false) {
  const getContextAttributes = vi.fn(() => ({ antialias }));
  const context = { getContextAttributes };
  const renderer = { getRenderTarget: () => target, getContext: () => context };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, getContextAttributes };
}

const material = (alphaToCoverage: boolean) => ({ alphaToCoverage }) as THREE.Material;

describe('coversOneSample', () => {
  it('is true for alpha to coverage on a target of one sample', () => {
    expect(coversOneSample(material(true), rendererOn({ samples: 0 }).renderer)).toBe(true);
  });

  it('is false on a multisampled target, where WebGL turns alpha to coverage on', () => {
    expect(coversOneSample(material(true), rendererOn({ samples: 4 }).renderer)).toBe(false);
  });

  it('is false for a material with no alpha to coverage', () => {
    expect(coversOneSample(material(false), rendererOn({ samples: 0 }).renderer)).toBe(false);
  });

  it('reads the canvas context’s antialias attribute when no target is bound', () => {
    expect(coversOneSample(material(true), rendererOn(null, true).renderer)).toBe(false);
    expect(coversOneSample(material(true), rendererOn(null, false).renderer)).toBe(true);
  });

  it('asks a context for its attributes once', () => {
    const { renderer, getContextAttributes } = rendererOn(null, true);
    coversOneSample(material(true), renderer);
    coversOneSample(material(true), renderer);
    expect(getContextAttributes).toHaveBeenCalledTimes(1);
  });
});
