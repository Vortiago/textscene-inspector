/** A `CanvasItemMaterial` for a test, with Godot's defaults except the light mode. */
import type { EnumValue } from '../../godot/classdb/enumNames';
import {
  CanvasItemMaterialBlendMode,
  CanvasItemMaterialLightMode,
} from '../../godot/scene/canvasItemMaterial';
import type { CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types';

export function canvasItemMaterial(
  lightMode: EnumValue<typeof CanvasItemMaterialLightMode>
): CanvasItemMaterialProperties {
  return {
    blendMode: CanvasItemMaterialBlendMode.MIX,
    lightMode,
    particlesAnimation: false,
    particlesAnimHFrames: 1,
    particlesAnimVFrames: 1,
    particlesAnimLoop: false,
  };
}
