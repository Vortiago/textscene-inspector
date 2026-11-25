import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { BLEND_MODES } from '../material/renderModes.js';
import { godotBlendState, type MaterialBlendState } from '../pipeline/blendState.js';

const BLEND_WORDS: Readonly<Record<string, EnumValue<typeof BlendMode>>> = Object.fromEntries(
  Object.entries(BLEND_MODES).map(([mode, word]) => [word, Number(mode) as EnumValue<typeof BlendMode>])
);

/** The blend of a canvas shader's one blend word (`renderer_canvas_render_rd.cpp:1566-1571`). */
export function canvasBlendState(tree: ShaderNode): MaterialBlendState {
  // Godot's default attachment, which blends nothing (`material_storage.cpp:710`).
  if (tree.renderModes.some(({ name }) => name === 'blend_disabled')) return { blending: THREE.NoBlending };
  const named = tree.renderModes.find(({ name }) => name in BLEND_WORDS);
  return godotBlendState(named ? BLEND_WORDS[named.name]! : BlendMode.MIX);
}
