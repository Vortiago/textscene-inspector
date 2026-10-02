/**
 * Node types whose runtime effect in Godot is not nil: each either draws geometry
 * of its own or moves, deforms or animates other nodes. A comparison sheet for one
 * of these may not claim `linter-only`, which says the runtime effect is nil
 * (ADR-0045). `effect` names which half of that claim holds; `cite` grounds it in
 * the engine source.
 */

export const RUNTIME_EFFECT_NODE_TYPES = [
  { type: 'Skeleton3D', effect: 'drives', cite: 'skeleton_3d.cpp:1166 `_process_modifiers`' },
  { type: 'AimModifier3D', effect: 'drives', cite: 'skeleton_modifier_3d.cpp `_process_modification`' },
  { type: 'BoneAttachment3D', effect: 'drives', cite: 'bone_attachment_3d.cpp `_process` follows its bone' },
  { type: 'BoneConstraint3D', effect: 'drives', cite: 'bone_constraint_3d.cpp `_process_modification`' },
  {
    type: 'BoneTwistDisperser3D',
    effect: 'drives',
    cite: 'bone_twist_disperser_3d.cpp `_process_modification`',
  },
  { type: 'CCDIK3D', effect: 'drives', cite: 'ccdik_3d.cpp `_process` solves each frame' },
  {
    type: 'ConvertTransformModifier3D',
    effect: 'drives',
    cite: 'convert_transform_modifier_3d.cpp `_process_modification`',
  },
  {
    type: 'CopyTransformModifier3D',
    effect: 'drives',
    cite: 'copy_transform_modifier_3d.cpp `_process_modification`',
  },
  { type: 'FABRIK3D', effect: 'drives', cite: 'fabrik_3d.cpp `_process` solves each frame' },
  { type: 'JacobianIK3D', effect: 'drives', cite: 'jacobianik_3d.cpp `_process` solves each frame' },
  {
    type: 'LimitAngularVelocityModifier3D',
    effect: 'drives',
    cite: 'limit_angular_velocity_modifier_3d.cpp `_process_modification`',
  },
  { type: 'LookAtModifier3D', effect: 'drives', cite: 'lookat_modifier_3d.cpp `_process_modification`' },
  {
    type: 'ModifierBoneTarget3D',
    effect: 'drives',
    cite: 'modifier_bone_target_3d.cpp `_process` mirrors its bone onto the node',
  },
  {
    type: 'PhysicalBoneSimulator3D',
    effect: 'drives',
    cite: 'physical_bone_simulator_3d.cpp `_process_modification`',
  },
  { type: 'RetargetModifier3D', effect: 'drives', cite: 'retarget_modifier_3d.cpp `_process_modification`' },
  { type: 'SkeletonIK3D', effect: 'drives', cite: 'skeleton_ik_3d.cpp `_process` solves each frame' },
  { type: 'SkeletonModifier3D', effect: 'drives', cite: 'skeleton_modifier_3d.cpp `_process_modification`' },
  { type: 'SplineIK3D', effect: 'drives', cite: 'spline_ik_3d.cpp `_process` solves each frame' },
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
  { type: 'TwoBoneIK3D', effect: 'drives', cite: 'twoboneik_3d.cpp `_process_modification`' },
  { type: 'XRBodyModifier3D', effect: 'drives', cite: 'xr_body_modifier_3d.cpp `_process_modification`' },
  { type: 'XRHandModifier3D', effect: 'drives', cite: 'xr_hand_modifier_3d.cpp `_process_modification`' },
  { type: 'XRFaceModifier3D', effect: 'drives', cite: 'xr_face_modifier_3d.cpp `_process_modification`' },
  {
    type: 'OpenXRHand',
    effect: 'drives',
    cite: 'openxr_hand.cpp `_process` poses skeleton bones from tracking',
  },
  {
    type: 'RemoteTransform2D',
    effect: 'drives',
    cite: 'remote_transform_2d.cpp `_update_transform` relays every frame',
  },
  {
    type: 'RemoteTransform3D',
    effect: 'drives',
    cite: 'remote_transform_3d.cpp `_update_transform` relays every frame',
  },
  { type: 'AnimationPlayer', effect: 'drives', cite: 'animation_player.cpp `process` advances its tracks' },
  { type: 'AnimationTree', effect: 'drives', cite: 'animation_tree.cpp `process` evaluates the blend tree' },
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
