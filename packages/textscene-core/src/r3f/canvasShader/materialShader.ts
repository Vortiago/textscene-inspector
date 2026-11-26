import type { CanvasItemMaterialSlot } from '../../resources/materials/canvasitemmaterial/kind';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { canvasItemMaterialShader } from '../../shaders/canvas/canvasItemMaterialShader';
import { DEFAULT_CANVAS_SHADER } from '../../shaders/canvas/defaultCanvasShader';
import { canvasItemForm } from './canvasItemForm';

const DEFAULT_SHADER: ShaderText = Object.freeze({
  code: DEFAULT_CANVAS_SHADER,
  file: "Godot's default canvas shader",
  parameters: Object.freeze({}),
  textures: Object.freeze({}),
});

/** Written only by `generatedShader`, one shader per text as Godot's `shader_map`. It never clears. */
const generatedByKey = new Map<string, ShaderText>();

/** The translated form's shader for an item with no shader of its own (`canvas_item.cpp:1204`). */
export function materialShaderOf(slot: CanvasItemMaterialSlot): ShaderText | null {
  if (slot.shader || canvasItemForm() === 'classic') return null;
  return slot.properties ? generatedShader(slot.properties) : DEFAULT_SHADER;
}

function generatedShader(material: CanvasItemMaterialProperties): ShaderText {
  const { code, parameters } = canvasItemMaterialShader(material);
  const key = JSON.stringify([code, parameters]);
  let shader = generatedByKey.get(key);
  if (!shader) {
    shader = Object.freeze({ code, file: 'CanvasItemMaterial', parameters, textures: Object.freeze({}) });
    generatedByKey.set(key, shader);
  }
  return shader;
}
