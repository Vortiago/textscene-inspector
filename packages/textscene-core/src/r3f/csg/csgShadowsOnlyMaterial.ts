/**
 * The material `cast_shadow = SHADOWS_ONLY` mounts over a CSG node's own, at both CSG draw sites.
 * Not `visible = false`, which stops `WebGLShadowMap.renderObject` casting too. It writes no colour
 * or depth, and `getDepthMaterial` never copies `colorWrite`. Literal-only, so it never remounts.
 */

import { materialProgramInputs } from '../materialProgramInputs';

export const CSG_SHADOWS_ONLY_MATERIAL = materialProgramInputs({
  props: { attach: 'material', colorWrite: false, depthWrite: false },
});
