import { GODOT_VERSION } from '../language/instructionTable.generated.js';
import {
  ALPHA_ANTIALIASING,
  DEPTH_DRAW_ALWAYS,
  SHADING_MODE,
  STENCIL_FLAG,
  STENCIL_MODE,
  TRANSPARENCY,
  type MaterialKey,
} from './materialKey.js';

/** Each list holds the text of one of Godot's switches, indexed by the enum value. */
const BLEND_MODES = ['blend_mix', 'blend_add', 'blend_sub', 'blend_mul', 'blend_premul_alpha'];
const DEPTH_DRAW_MODES = ['depth_draw_opaque', 'depth_draw_always', 'depth_draw_never'];
const CULL_MODES = ['cull_back', 'cull_front', 'cull_disabled'];
const DIFFUSE_MODES = ['diffuse_burley', 'diffuse_lambert', 'diffuse_lambert_wrap', 'diffuse_toon'];
const SPECULAR_MODES = ['specular_schlick_ggx', 'specular_toon', 'specular_disabled'];
const DEPTH_TESTS = ['', ', depth_test_inverted'];
const STENCIL_COMPARES = [
  'compare_always',
  'compare_less',
  'compare_equal',
  'compare_less_or_equal',
  'compare_greater',
  'compare_not_equal',
  'compare_greater_or_equal',
];

/** The comment Godot writes first, with `GODOT_VERSION_FULL_CONFIG` of an official build. */
export function originComment(key: MaterialKey): string {
  const materialClass = key.orm ? 'ORMMaterial3D' : 'StandardMaterial3D';
  return `// NOTE: Shader automatically converted from Godot Engine ${GODOT_VERSION}.stable's ${materialClass}.\n\n`;
}

/** The `shader_type` and `render_mode` lines (`material.cpp:780`). */
export function renderModes(key: MaterialKey): string {
  const { flags, features } = key;
  let code = 'shader_type spatial;\nrender_mode ';
  code += BLEND_MODES[key.blendMode];
  code += `, ${DEPTH_DRAW_MODES[features.has('REFRACTION') ? DEPTH_DRAW_ALWAYS : key.depthDrawMode]}`;
  code += `, ${CULL_MODES[key.cullMode]}`;
  code += `, ${DIFFUSE_MODES[key.diffuseMode]}`;
  code += `, ${SPECULAR_MODES[key.specularMode]}`;
  if (features.has('SUBSURFACE_SCATTERING') && flags.has('SUBSURFACE_MODE_SKIN')) code += ', sss_mode_skin';
  if (key.shadingMode === SHADING_MODE.UNSHADED) code += ', unshaded';
  code += flags.has('DISABLE_DEPTH_TEST') ? ', depth_test_disabled' : DEPTH_TESTS[key.depthTest];
  if (flags.has('PARTICLE_TRAILS_MODE')) code += ', particle_trails';
  if (key.shadingMode === SHADING_MODE.PER_VERTEX) code += ', vertex_lighting';
  if (flags.has('DONT_RECEIVE_SHADOWS')) code += ', shadows_disabled';
  if (flags.has('DISABLE_AMBIENT_LIGHT')) code += ', ambient_light_disabled';
  if (flags.has('USE_SHADOW_TO_OPACITY')) code += ', shadow_to_opacity';
  if (flags.has('DISABLE_FOG')) code += ', fog_disabled';
  if (flags.has('DISABLE_SPECULAR_OCCLUSION')) code += ', specular_occlusion_disabled';
  if (key.transparency === TRANSPARENCY.ALPHA_DEPTH_PRE_PASS) code += ', depth_prepass_alpha';
  if (isAlphaTested(key)) {
    if (key.alphaAntialiasingMode === ALPHA_ANTIALIASING.ALPHA_TO_COVERAGE) code += ', alpha_to_coverage';
    else if (key.alphaAntialiasingMode === ALPHA_ANTIALIASING.ALPHA_TO_COVERAGE_AND_TO_ONE)
      code += ', alpha_to_coverage_and_one';
  }
  return `${code};\n${stencilMode(key)}`;
}

/** Alpha hash and alpha scissor are the transparencies that take alpha antialiasing. */
export const isAlphaTested = (key: MaterialKey): boolean =>
  key.transparency === TRANSPARENCY.ALPHA_HASH || key.transparency === TRANSPARENCY.ALPHA_SCISSOR;

/** The `stencil_mode` line, or nothing for a disabled stencil or one with no flags. */
function stencilMode(key: MaterialKey): string {
  const flags = key.stencilFlags;
  if (key.stencilMode === STENCIL_MODE.DISABLED || flags === 0) return '';
  const operations = [
    flags & STENCIL_FLAG.READ && 'read',
    flags & STENCIL_FLAG.WRITE && 'write',
    flags & STENCIL_FLAG.WRITE_DEPTH_FAIL && 'write_depth_fail',
  ].filter(Boolean);
  return `stencil_mode ${operations.join(', ')}, ${STENCIL_COMPARES[key.stencilCompare]}, ${key.stencilReference};\n`;
}
