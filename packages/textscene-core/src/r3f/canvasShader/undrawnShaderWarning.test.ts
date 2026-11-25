import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { useUndrawnShaderWarning } from './undrawnShaderWarning';

const shaderOf = (): ShaderText => ({
  code: 'shader_type canvas_item;\n',
  file: '',
  parameters: {},
  textures: {},
});
const NODE = { type: 'Polygon2D', name: 'Body' };

afterEach(() => vi.restoreAllMocks());

describe('useUndrawnShaderWarning', () => {
  it("warns once that an item the shader draw cannot draw keeps Godot's default canvas shader", () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shader = shaderOf();

    renderHook(() => useUndrawnShaderWarning(shader, NODE, true)).rerender();

    expect(warn.mock.calls).toEqual([
      [
        "[material] The previewer draws Polygon2D 'Body' with Godot's default canvas shader: it cannot draw this item with a canvas_item shader yet.",
      ],
    ]);
  });

  it('warns for no item the shader draw draws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    renderHook(() => useUndrawnShaderWarning(shaderOf(), NODE, false));

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns for no item with no shader', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    renderHook(() => useUndrawnShaderWarning(null, NODE, true));

    expect(warn).not.toHaveBeenCalled();
  });
});
