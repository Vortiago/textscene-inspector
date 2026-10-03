/**
 * Node types whose runtime effect in Godot is not nil: each either draws geometry
 * of its own or moves, deforms, animates or re-shades other nodes. A comparison
 * sheet for one of these may not claim `linter-only`, which says the runtime
 * effect is nil (ADR-0045). `effect` names which half of that claim holds; `cite`
 * grounds it in the Godot 4.6.3 source: the file that defines each hook it names.
 */

/** @typedef {'drives' | 'draws'} RuntimeEffect */

/** @typedef {{ type: string, effect: RuntimeEffect, cite: string }} RuntimeEffectNode */

/** @type {RuntimeEffectNode[]} */
export const RUNTIME_EFFECT_NODE_TYPES = [
  { type: 'Skeleton3D', effect: 'drives', cite: 'skeleton_3d.cpp:1166 `_process_modifiers`' },
  {
    type: 'AimModifier3D',
    effect: 'drives',
    cite: 'bone_constraint_3d.cpp `_process_modification` calls aim_modifier_3d.cpp `_process_aim`',
  },
  {
    type: 'BoneAttachment3D',
    effect: 'drives',
    cite: "bone_attachment_3d.cpp `on_skeleton_update`, on the skeleton's `skeleton_updated` signal",
  },
  { type: 'BoneConstraint3D', effect: 'drives', cite: 'bone_constraint_3d.cpp `_process_modification`' },
  {
    type: 'BoneTwistDisperser3D',
    effect: 'drives',
    cite: 'bone_twist_disperser_3d.cpp `_process_modification`',
  },
  {
    type: 'CCDIK3D',
    effect: 'drives',
    cite: 'ik_modifier_3d.cpp `_process_modification` calls ccd_ik_3d.cpp `_solve_iteration`',
  },
  {
    type: 'ConvertTransformModifier3D',
    effect: 'drives',
    cite: 'bone_constraint_3d.cpp `_process_modification` calls convert_transform_modifier_3d.cpp `_process_convert`',
  },
  {
    type: 'CopyTransformModifier3D',
    effect: 'drives',
    cite: 'bone_constraint_3d.cpp `_process_modification` calls copy_transform_modifier_3d.cpp `_process_copy`',
  },
  {
    type: 'FABRIK3D',
    effect: 'drives',
    cite: 'ik_modifier_3d.cpp `_process_modification` calls fabr_ik_3d.cpp `_solve_iteration`',
  },
  {
    type: 'JacobianIK3D',
    effect: 'drives',
    cite: 'ik_modifier_3d.cpp `_process_modification` calls jacobian_ik_3d.cpp `_solve_iteration`',
  },
  {
    type: 'LimitAngularVelocityModifier3D',
    effect: 'drives',
    cite: 'limit_angular_velocity_modifier_3d.cpp `_process_modification`',
  },
  { type: 'LookAtModifier3D', effect: 'drives', cite: 'look_at_modifier_3d.cpp `_process_modification`' },
  {
    type: 'ModifierBoneTarget3D',
    effect: 'drives',
    cite: 'modifier_bone_target_3d.cpp `_process_modification` mirrors its bone onto the node',
  },
  {
    type: 'PhysicalBoneSimulator3D',
    effect: 'drives',
    cite: 'physical_bone_simulator_3d.cpp `_process_modification`',
  },
  { type: 'RetargetModifier3D', effect: 'drives', cite: 'retarget_modifier_3d.cpp `_process_modification`' },
  {
    type: 'SkeletonIK3D',
    effect: 'drives',
    cite: 'skeleton_ik_3d.cpp `_process_modification` solves each frame',
  },
  { type: 'SkeletonModifier3D', effect: 'drives', cite: 'skeleton_modifier_3d.cpp `_process_modification`' },
  {
    type: 'SplineIK3D',
    effect: 'drives',
    cite: 'ik_modifier_3d.cpp `_process_modification` calls spline_ik_3d.cpp `_process_ik`',
  },
  {
    type: 'SpringBoneCollision3D',
    effect: 'drives',
    cite: 'spring_bone_collision_3d.cpp, read by the simulator each modification',
  },
  {
    type: 'SpringBoneCollisionCapsule3D',
    effect: 'drives',
    cite: 'spring_bone_collision_capsule_3d.cpp, read by the simulator each modification',
  },
  {
    type: 'SpringBoneCollisionPlane3D',
    effect: 'drives',
    cite: 'spring_bone_collision_plane_3d.cpp, read by the simulator each modification',
  },
  {
    type: 'SpringBoneCollisionSphere3D',
    effect: 'drives',
    cite: 'spring_bone_collision_sphere_3d.cpp, read by the simulator each modification',
  },
  {
    type: 'SpringBoneSimulator3D',
    effect: 'drives',
    cite: 'spring_bone_simulator_3d.cpp `_process_modification`',
  },
  {
    type: 'TwoBoneIK3D',
    effect: 'drives',
    cite: 'ik_modifier_3d.cpp `_process_modification` calls two_bone_ik_3d.cpp `_process_ik`',
  },
  { type: 'XRBodyModifier3D', effect: 'drives', cite: 'xr_body_modifier_3d.cpp `_process_modification`' },
  { type: 'XRHandModifier3D', effect: 'drives', cite: 'xr_hand_modifier_3d.cpp `_process_modification`' },
  {
    type: 'XRFaceModifier3D',
    effect: 'drives',
    cite: 'xr_face_modifier_3d.cpp `NOTIFICATION_INTERNAL_PROCESS` calls `_update_face_blends` on its target',
  },
  {
    type: 'OpenXRHand',
    effect: 'drives',
    cite: 'openxr_hand.cpp `NOTIFICATION_INTERNAL_PROCESS` calls `_update_skeleton` from tracking',
  },
  {
    type: 'Skeleton2D',
    effect: 'drives',
    cite: 'skeleton_2d.cpp `NOTIFICATION_INTERNAL_PROCESS` calls `execute_modifications` on its stack',
  },
  {
    type: 'SpringArm3D',
    effect: 'drives',
    cite: 'spring_arm_3d.cpp `NOTIFICATION_INTERNAL_PHYSICS_PROCESS` calls `process_spring`, which places each child',
  },
  {
    type: 'ShaderGlobalsOverride',
    effect: 'drives',
    cite: 'shader_globals_override.cpp `global_shader_parameter_set_override` re-shades each material that reads it',
  },
  {
    type: 'RemoteTransform2D',
    effect: 'drives',
    cite: 'remote_transform_2d.cpp `_update_remote` relays on each transform change',
  },
  {
    type: 'RemoteTransform3D',
    effect: 'drives',
    cite: 'remote_transform_3d.cpp `_update_remote` relays on each transform change',
  },
  {
    type: 'AnimationPlayer',
    effect: 'drives',
    cite: 'animation_mixer.cpp `_process_animation` calls animation_player.cpp `_process_playback_data`',
  },
  {
    type: 'AnimationTree',
    effect: 'drives',
    cite: 'animation_tree.cpp `AnimationNode::process` evaluates the blend tree',
  },
  {
    type: 'OpenXRRenderModel',
    effect: 'draws',
    cite: 'openxr_render_model.cpp:72 `add_child` mounts the model scene',
  },
  {
    type: 'OpenXRRenderModelManager',
    effect: 'draws',
    cite: 'openxr_render_model_manager.cpp spawns an OpenXRRenderModel child per tracked model',
  },
];
