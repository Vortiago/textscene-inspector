import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { BLEND_MODES } from '../material/renderModes.js';
import { godotBlendState, type MaterialBlendState } from '../pipeline/blendState.js';

/** `blend_disabled` programs Godot's default attachment, which blends nothing (`material_storage.cpp:710`). */
const DISABLED = 'blend_disabled';

const CANVAS_BLEND_MODES: Readonly<Record<string, EnumValue<typeof BlendMode> | typeof DISABLED>> = {
  ...Object.fromEntries(Object.entries(BLEND_MODES).map(([mode, word]) => [word, Number(mode)])),
  [DISABLED]: DISABLED,
};

/** The blend state of a canvas shader's blend mode, one at most (`renderer_canvas_render_rd.cpp:1566-1571`). */
export function canvasBlendState(tree: ShaderNode): MaterialBlendState {
  const named = tree.renderModes.find(({ name }) => name in CANVAS_BLEND_MODES);
  const mode = named ? CANVAS_BLEND_MODES[named.name]! : BlendMode.MIX;
  return mode === DISABLED ? { blending: THREE.NoBlending } : godotBlendState(mode);
}
