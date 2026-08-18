/**
 * The material `cast_shadow = SHADOWS_ONLY` mounts over a CSG node's own.
 *
 * `visible = false` is not the same thing: three's `WebGLShadowMap.renderObject`
 * returns on it and stops walking the subtree, so the mesh would stop casting
 * too. Writing neither colour nor depth is what separates the two passes —
 * `getDepthMaterial` copies alphaMap/alphaTest/map and never `colorWrite`.
 *
 * Shared by both CSG draw sites (the node's own solid and a root's evaluated
 * mesh), and literal-only so the key is constant and it never remounts.
 */

import { materialProgramInputs } from '../materialProgramInputs';

export const CSG_SHADOWS_ONLY_MATERIAL = materialProgramInputs({
  props: { attach: 'material', colorWrite: false, depthWrite: false },
});
