import { describe, expect, it, vi } from 'vitest';
import { NO_MATERIAL, type CanvasItemMaterialSlot } from '../../resources/materials/canvasitemmaterial/kind';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import { DEFAULT_CANVAS_SHADER } from '../../shaders/canvas/defaultCanvasShader';
import { canvasItemForm, type CanvasItemForm } from './canvasItemForm';
import { materialShaderOf } from './materialShader';

vi.mock('./canvasItemForm', () => ({ canvasItemForm: vi.fn() }));

const inForm = (form: CanvasItemForm) => vi.mocked(canvasItemForm).mockReturnValue(form);

const ADD: CanvasItemMaterialProperties = {
  blendMode: 1,
  lightMode: 1,
  particlesAnimation: true,
  particlesAnimHFrames: 4,
  particlesAnimVFrames: 2,
  particlesAnimLoop: true,
};

const shaderSlot: CanvasItemMaterialSlot = {
  properties: null,
  shader: { code: 'shader_type canvas_item;\n', file: 'res://own.gdshader', parameters: {}, textures: {} },
};
const materialSlot: CanvasItemMaterialSlot = { properties: ADD, shader: null };

describe('materialShaderOf', () => {
  it.each([
    ['classic', 'a shader', shaderSlot],
    ['translated', 'a shader', shaderSlot],
    ['classic', 'a CanvasItemMaterial', materialSlot],
    ['classic', 'no material', NO_MATERIAL],
  ] as const)('gives none in the %s form to an item with %s', (form, _slotName, slot) => {
    inForm(form);

    expect(materialShaderOf(slot)).toBeNull();
  });

  it("gives Godot's default canvas shader to an item with no material", () => {
    inForm('translated');

    expect(materialShaderOf(NO_MATERIAL)?.code).toBe(DEFAULT_CANVAS_SHADER);
  });

  it("gives the CanvasItemMaterial's generated text with its particle parameters", () => {
    inForm('translated');
    const shader = materialShaderOf(materialSlot);

    expect(shader?.code).toContain('render_mode blend_add,unshaded;');
    expect(shader?.parameters).toEqual({
      particles_anim_h_frames: '4',
      particles_anim_v_frames: '2',
      particles_anim_loop: 'true',
    });
  });

  it('gives one shader to every material of one key, so the translator builds it once', () => {
    inForm('translated');

    expect(materialShaderOf({ properties: { ...ADD }, shader: null })).toBe(materialShaderOf(materialSlot));
  });

  it('gives another shader for another particle parameter', () => {
    inForm('translated');
    const other = { properties: { ...ADD, particlesAnimHFrames: 8 }, shader: null };

    expect(materialShaderOf(other)).not.toBe(materialShaderOf(materialSlot));
  });
});
