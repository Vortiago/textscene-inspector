/**
 * XR and OpenXR nodes.
 *
 * This family is where the per-`push_back` visibility gate shows: `XROrigin3D`
 * and `OpenXRCompositionLayer` each gate SOME of their rows and leave the rest
 * unconditional. `OpenXRRenderModel` and `OpenXRRenderModelManager` are also the
 * only two overrides in the closure that start a fresh `PackedStringArray` and
 * never call their parent, so both carry an `appliesTo`.
 */
import type { WarningRow } from './types.js';

export const xrWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  OpenXRCompositionLayer: [
    {
      at: 'openxr_composition_layer.cpp:765',
      says: 'must have an XROrigin3D node as parent',
      verdict: { rule: 'openxrcompositionlayer-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'openxr_composition_layer.cpp:770',
      says: 'must have an orthonormalized transform (no scale or shearing)',
      verdict: { rule: 'openxrcompositionlayer-non-orthonormal-transform' },
    },
    {
      at: 'openxr_composition_layer.cpp:774',
      says: "hole punching won't work unless sort order is negative",
      verdict: { rule: 'openxrcompositionlayer-hole-punch-sort-order' },
    },
  ],

  OpenXRRenderModel: [
    {
      at: 'openxr_render_model.cpp:151',
      says: 'must be a child of an XROrigin3D or OpenXRRenderModelManager node',
      verdict: { rule: 'openxrrendermodel-parent-not-origin-or-manager' },
    },
    {
      at: 'openxr_render_model.cpp:155',
      says: 'the render model extension is not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/render_model"), openxr_render_model.cpp:154',
      },
    },
  ],

  OpenXRRenderModelManager: [
    {
      at: 'openxr_render_model_manager.cpp:205',
      says: 'must specify a tracker to make the node local to pose',
      verdict: { rule: 'openxrrendermodelmanager-tracker-required-for-local-pose' },
    },
    {
      at: 'openxr_render_model_manager.cpp:218',
      says: 'must be a child of an XROrigin3D node',
      verdict: { rule: 'openxrrendermodelmanager-parent-not-xrorigin3d' },
    },
    {
      at: 'openxr_render_model_manager.cpp:222',
      says: 'the render model extension is not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/render_model"), openxr_render_model_manager.cpp:221',
      },
    },
  ],

  OpenXRVisibilityMask: [
    {
      at: 'openxr_visibility_mask.cpp:73',
      says: 'must have an XRCamera3D node as parent',
      verdict: { rule: 'openxrvisibilitymask-parent-not-xrcamera3d' },
      gate: 'visible',
    },
  ],

  XRCamera3D: [
    {
      at: 'xr_nodes.cpp:102',
      says: 'may not function as expected without an XROrigin3D parent',
      verdict: { rule: 'xrcamera3d-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:106',
      says: 'should have physics_interpolation_mode OFF to avoid jitter',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, xr_nodes.cpp:105',
      },
      gate: 'visible',
    },
  ],

  XRHandModifier3D: [
    {
      at: 'xr_hand_modifier_3d.cpp:295',
      says: 'requires the OpenXR Hand Tracking extension to be enabled',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/hand_tracking"), xr_hand_modifier_3d.cpp:294',
      },
    },
  ],

  XRNode3D: [
    {
      at: 'xr_nodes.cpp:503',
      says: 'may not function as expected without an XROrigin3D parent',
      verdict: { rule: 'xrnode3d-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:507',
      says: 'no tracker name is set',
      verdict: {
        declined: 'default-omitted',
        because: 'tracker_name field-initialises to "" (xr_nodes.h:81), which is the trigger itself',
      },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:511',
      says: 'no pose is set',
      verdict: { rule: 'xrnode3d-no-pose-set' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:515',
      says: 'should have physics_interpolation_mode OFF to avoid jitter',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, xr_nodes.cpp:514',
      },
      gate: 'visible',
    },
  ],

  XROrigin3D: [
    {
      at: 'xr_nodes.cpp:695',
      says: 'requires an XRCamera3D child node',
      verdict: { rule: 'xrorigin3d-missing-camera-child' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:699',
      says: 'changing scale on XROrigin3D is not supported',
      verdict: { rule: 'xrorigin3d-unsupported-scale' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:705',
      says: 'XR shaders are not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/shaders/enabled"), a project setting, unconditional outside the visibility gate, xr_nodes.cpp:704',
      },
    },
  ],
};
