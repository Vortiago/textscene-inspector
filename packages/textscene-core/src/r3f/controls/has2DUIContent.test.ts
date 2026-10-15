import { describe, expect, it } from 'vitest';
import { is2DUIType } from './has2DUIContent';

describe('is2DUIType', () => {
  it('claims a Control', () => {
    expect(is2DUIType('Control')).toBe(true);
  });

  it('claims a Control subclass the previewer may not draw', () => {
    expect(is2DUIType('Button')).toBe(true);
  });

  it('claims a CanvasLayer, which derives from Node but roots a 2D UI subtree', () => {
    expect(is2DUIType('CanvasLayer')).toBe(true);
  });

  it('leaves a 3D type alone', () => {
    expect(is2DUIType('MeshInstance3D')).toBe(false);
  });

  it('leaves an unknown type alone', () => {
    expect(is2DUIType('NotAGodotClass')).toBe(false);
  });
});
