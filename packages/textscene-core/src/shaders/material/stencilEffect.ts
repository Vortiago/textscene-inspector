import { STENCIL_FLAG, STENCIL_MODE } from './materialKey.js';
import type { MaterialSettings, MaterialState } from './materialProperties.js';

/** Godot's `Color()`, which the constructor leaves as the stencil effect's colour. */
const DEFAULT_EFFECT_COLOR = [0, 0, 0, 1];
const DEFAULT_OUTLINE_THICKNESS = 0.01;
const STENCIL_COMPARE_NOT_EQUAL = 5;

/** The pass Godot draws after a material with an outline or x-ray stencil, one render priority later. */
export interface StencilPass {
  readonly renderPriorityOffset: 1;
  readonly settings: MaterialSettings;
}

/** The pass `_prepare_stencil_effect` (`material.cpp:3159`) makes: it draws where `state` wrote none. */
export function stencilPassOf(state: MaterialState): StencilPass | undefined {
  const { stencilMode, stencilReference } = state.key;
  if (stencilMode !== STENCIL_MODE.OUTLINE && stencilMode !== STENCIL_MODE.XRAY) return undefined;
  const isOutline = stencilMode === STENCIL_MODE.OUTLINE;
  const thickness = state.values.stencil_outline_thickness ?? DEFAULT_OUTLINE_THICKNESS;
  return {
    renderPriorityOffset: 1,
    settings: {
      shading_mode: 0,
      transparency: 1,
      no_depth_test: !isOutline,
      grow: isOutline,
      grow_amount: isOutline ? thickness : 0,
      albedo_color: state.values.stencil_color ?? DEFAULT_EFFECT_COLOR,
      stencil_mode: STENCIL_MODE.CUSTOM,
      stencil_flags: STENCIL_FLAG.READ,
      stencil_compare: STENCIL_COMPARE_NOT_EQUAL,
      stencil_reference: stencilReference,
    },
  };
}
