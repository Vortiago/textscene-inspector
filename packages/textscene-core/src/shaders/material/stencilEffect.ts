import { ShadingMode } from '../../godot/rendering/materials/shadingMode.js';
import { StencilCompare, StencilFlag, StencilMode } from '../../godot/rendering/materials/stencil.js';
import { Transparency } from '../../godot/rendering/materials/transparency.js';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D.js';
import type { MaterialSettings, MaterialState } from './materialProperties.js';

/** The pass Godot draws after a material with an outline or x-ray stencil, one render priority later. */
export interface StencilPass {
  /** `_prepare_stencil_effect` makes a StandardMaterial3D, whatever the class of the material. */
  readonly materialClass: 'StandardMaterial3D';
  readonly renderPriorityOffset: 1;
  readonly settings: MaterialSettings;
}

/** The pass `_prepare_stencil_effect` (`material.cpp:3159`) makes: it draws where `state` wrote none. */
export function stencilPassOf(state: MaterialState): StencilPass | undefined {
  const { stencilMode, stencilReference } = state.key;
  if (stencilMode !== StencilMode.OUTLINE && stencilMode !== StencilMode.XRAY) return undefined;
  const isOutline = stencilMode === StencilMode.OUTLINE;
  const thickness =
    state.values.stencil_outline_thickness ?? BASE_MATERIAL_3D_DEFAULTS.stencilEffectOutlineThickness;
  return {
    materialClass: 'StandardMaterial3D',
    renderPriorityOffset: 1,
    settings: {
      shading_mode: ShadingMode.UNSHADED,
      transparency: Transparency.ALPHA,
      no_depth_test: !isOutline,
      grow: isOutline,
      grow_amount: isOutline ? thickness : 0,
      albedo_color: state.values.stencil_color ?? BASE_MATERIAL_3D_DEFAULTS.stencilEffectColor,
      stencil_mode: StencilMode.CUSTOM,
      stencil_flags: StencilFlag.READ,
      stencil_compare: StencilCompare.NOT_EQUAL,
      stencil_reference: stencilReference,
    },
  };
}
