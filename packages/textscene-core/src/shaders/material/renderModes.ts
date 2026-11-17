import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { AlphaAntiAliasing } from '../../godot/rendering/materials/alphaAntialiasing.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import { DepthTest } from '../../godot/rendering/materials/depthTest.js';
import { DiffuseMode } from '../../godot/rendering/materials/diffuseMode.js';
import { ShadingMode } from '../../godot/rendering/materials/shadingMode.js';
import { SpecularMode } from '../../godot/rendering/materials/specularMode.js';
import { StencilCompare, StencilFlag, StencilMode } from '../../godot/rendering/materials/stencil.js';
import { Transparency } from '../../godot/rendering/materials/transparency.js';
import { GODOT_VERSION } from '../language/instructionTable.generated.js';
import { MaterialFeature, MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import { isAlphaTested, type MaterialKey } from './materialKey.js';

/** The text of each of Godot's `render_mode` switches, by enum value. */
const BLEND_MODES: Readonly<Record<EnumValue<typeof BlendMode>, string>> = {
  [BlendMode.MIX]: 'blend_mix',
  [BlendMode.ADD]: 'blend_add',
  [BlendMode.SUB]: 'blend_sub',
  [BlendMode.MUL]: 'blend_mul',
  [BlendMode.PREMULT_ALPHA]: 'blend_premul_alpha',
};
const DEPTH_DRAW_MODES: Readonly<Record<EnumValue<typeof DepthDrawMode>, string>> = {
  [DepthDrawMode.OPAQUE_ONLY]: 'depth_draw_opaque',
  [DepthDrawMode.ALWAYS]: 'depth_draw_always',
  [DepthDrawMode.DISABLED]: 'depth_draw_never',
};
const CULL_MODES: Readonly<Record<EnumValue<typeof CullMode>, string>> = {
  [CullMode.BACK]: 'cull_back',
  [CullMode.FRONT]: 'cull_front',
  [CullMode.DISABLED]: 'cull_disabled',
};
const DIFFUSE_MODES: Readonly<Record<EnumValue<typeof DiffuseMode>, string>> = {
  [DiffuseMode.DIFFUSE_BURLEY]: 'diffuse_burley',
  [DiffuseMode.DIFFUSE_LAMBERT]: 'diffuse_lambert',
  [DiffuseMode.DIFFUSE_LAMBERT_WRAP]: 'diffuse_lambert_wrap',
  [DiffuseMode.DIFFUSE_TOON]: 'diffuse_toon',
};
const SPECULAR_MODES: Readonly<Record<EnumValue<typeof SpecularMode>, string>> = {
  [SpecularMode.SPECULAR_SCHLICK_GGX]: 'specular_schlick_ggx',
  [SpecularMode.SPECULAR_TOON]: 'specular_toon',
  [SpecularMode.SPECULAR_DISABLED]: 'specular_disabled',
};
/** Godot writes no word for the default depth test. */
const DEPTH_TESTS: Readonly<Record<EnumValue<typeof DepthTest>, string>> = {
  [DepthTest.DEFAULT]: '',
  [DepthTest.INVERTED]: ', depth_test_inverted',
};
const STENCIL_COMPARES: Readonly<Record<EnumValue<typeof StencilCompare>, string>> = {
  [StencilCompare.ALWAYS]: 'compare_always',
  [StencilCompare.LESS]: 'compare_less',
  [StencilCompare.EQUAL]: 'compare_equal',
  [StencilCompare.LESS_OR_EQUAL]: 'compare_less_or_equal',
  [StencilCompare.GREATER]: 'compare_greater',
  [StencilCompare.NOT_EQUAL]: 'compare_not_equal',
  [StencilCompare.GREATER_OR_EQUAL]: 'compare_greater_or_equal',
};

/** A mode after the first, or nothing for a value Godot's switch has no case for. */
const listed = (mode: string | undefined): string => (mode === undefined ? '' : `, ${mode}`);

/** The comment Godot writes first, with `GODOT_VERSION_FULL_CONFIG` of an official build. */
export function originComment(key: MaterialKey): string {
  const materialClass = key.orm ? 'ORMMaterial3D' : 'StandardMaterial3D';
  return `// NOTE: Shader automatically converted from Godot Engine ${GODOT_VERSION}.stable's ${materialClass}.\n\n`;
}

/** The `shader_type` and `render_mode` lines (`material.cpp:780`). */
export function renderModes(key: MaterialKey): string {
  const { flags, features } = key;
  let code = 'shader_type spatial;\nrender_mode ';
  code += BLEND_MODES[key.blendMode] ?? '';
  code += listed(
    DEPTH_DRAW_MODES[features.has(MaterialFeature.REFRACTION) ? DepthDrawMode.ALWAYS : key.depthDrawMode]
  );
  code += listed(CULL_MODES[key.cullMode]);
  code += listed(DIFFUSE_MODES[key.diffuseMode]);
  code += listed(SPECULAR_MODES[key.specularMode]);
  if (features.has(MaterialFeature.SUBSURFACE_SCATTERING) && flags.has(MaterialFlag.SUBSURFACE_MODE_SKIN))
    code += ', sss_mode_skin';
  if (key.shadingMode === ShadingMode.UNSHADED) code += ', unshaded';
  code += flags.has(MaterialFlag.DISABLE_DEPTH_TEST)
    ? ', depth_test_disabled'
    : (DEPTH_TESTS[key.depthTest] ?? '');
  if (flags.has(MaterialFlag.PARTICLE_TRAILS_MODE)) code += ', particle_trails';
  if (key.shadingMode === ShadingMode.PER_VERTEX) code += ', vertex_lighting';
  if (flags.has(MaterialFlag.DONT_RECEIVE_SHADOWS)) code += ', shadows_disabled';
  if (flags.has(MaterialFlag.DISABLE_AMBIENT_LIGHT)) code += ', ambient_light_disabled';
  if (flags.has(MaterialFlag.USE_SHADOW_TO_OPACITY)) code += ', shadow_to_opacity';
  if (flags.has(MaterialFlag.DISABLE_FOG)) code += ', fog_disabled';
  if (flags.has(MaterialFlag.DISABLE_SPECULAR_OCCLUSION)) code += ', specular_occlusion_disabled';
  if (key.transparency === Transparency.ALPHA_DEPTH_PRE_PASS) code += ', depth_prepass_alpha';
  if (isAlphaTested(key)) {
    if (key.alphaAntialiasingMode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE)
      code += ', alpha_to_coverage';
    else if (key.alphaAntialiasingMode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE)
      code += ', alpha_to_coverage_and_one';
  }
  return `${code};\n${stencilMode(key)}`;
}

/** The `stencil_mode` line, or nothing for a disabled stencil or one with no flags. */
function stencilMode(key: MaterialKey): string {
  const flags = key.stencilFlags;
  if (key.stencilMode === StencilMode.DISABLED || flags === 0) return '';
  const operations = [
    flags & StencilFlag.READ && 'read',
    flags & StencilFlag.WRITE && 'write',
    flags & StencilFlag.WRITE_DEPTH_FAIL && 'write_depth_fail',
  ].filter(Boolean);
  return `stencil_mode ${operations.join(', ')}${listed(STENCIL_COMPARES[key.stencilCompare])}, ${key.stencilReference};\n`;
}
