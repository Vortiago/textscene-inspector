/**
 * Gizmos, both halves of each pair: the unselected render, and the selected one that adds the
 * helper. A scene that sets `gizmos: true` opens with the Gizmos toggle on, which every other
 * capture keeps off. With it on and nothing selected, a node Godot draws a gizmo for in every node
 * shows it faint (ADR-0056), and a node Godot draws it for only when selected shows none.
 */

export const GIZMO_SCENES = [
  // Select the node, capture the gizmo. These pin the real tree-click → selection → gizmo path for
  // every gizmo node type. Thin AA gizmo lines and the selection box are AA-sensitive.
  { name: 'marker2d-selected', file: 'unit-marker2d.tscn', gizmos: true, select: 'Marker2DRoot/DefaultMarker', mode: '2d' },
  { name: 'path2d-selected', file: 'unit-path2d.tscn', gizmos: true, select: 'Path2DRoot/ArcPath', mode: '2d' },
  { name: 'pathfollow2d-selected', file: 'unit-pathfollow2d.tscn', gizmos: true, select: 'PathFollow2DRoot/TrackPath/Follower', mode: '2d' },
  { name: 'marker3d-selected', file: 'unit-marker-3d.tscn', gizmos: true, select: 'Root/MyMarker3D' },
  { name: 'path3d-selected', file: 'unit-pathfollow-3d.tscn', gizmos: true, select: 'PathFollow3DRoot/TrackPath' },
  { name: 'path3d-unselected', file: 'unit-pathfollow-3d.tscn', gizmos: true },
  { name: 'pathfollow3d-selected', file: 'unit-pathfollow-3d.tscn', gizmos: true, select: 'PathFollow3DRoot/TrackPath/Follower' },
  // The VehicleWheel3D gizmo: radius circle, spring coil, travel line, axle
  // ticks and forward arrow.
  { name: 'vehiclewheel3d-selected', file: 'unit-physics-vehicle.tscn', gizmos: true, select: 'Root/Vehicle/Wheel1' },
  // The SpringArm3D length line: one segment from the origin along +Z, spring_length long.
  { name: 'spring-arm-3d-selected', file: 'unit-spring-arm-3d.tscn', gizmos: true, select: 'Root/MySpringArm3D' },
  // The SoftBody3D wireframe: the triangle edges of its mesh in the collision debug colour.
  { name: 'softbody3d-selected', file: 'unit-softbody3d.tscn', gizmos: true, select: 'Root/SoftBody3D' },
  { name: 'softbody3d-unselected', file: 'unit-softbody3d.tscn', gizmos: true },
  // The particle emitters: the visibility_aabb box and the emission shape lines, with the axes from
  // the box centre on CPUParticles3D. The GPUParticles3D scene gives its box shape the offset and
  // scale only a ParticleProcessMaterial has.
  {
    name: 'gpuparticles3d-emission-selected',
    file: 'unit-gpuparticles3d-emission.tscn',
    gizmos: true,
    select: 'Root/Emitter',
  },
  { name: 'cpuparticles3d-selected', file: 'unit-cpuparticles3d-gizmo.tscn', gizmos: true, select: 'Root/Emitter' },
  // The faint variant: the Gizmos toggle on and nothing selected. CPUParticles3D draws its box and
  // axes for every node (`cpu_particles_3d_gizmo_plugin.cpp:98`) but not the solid box or the
  // emission shape, and Path3D draws its curve (`path_3d_editor_plugin.cpp:320`).
  { name: 'cpuparticles3d-unselected', file: 'unit-cpuparticles3d-gizmo.tscn', gizmos: true },
  // The same emitter inside two instances. `Locked` is a plain instance, so Godot draws its gizmo in the
  // grey of a node the edited scene does not own (`node_3d_editor_gizmos.cpp:907-917`). `Editable` is
  // listed by `[editable]` and keeps the particles colour. One golden has nothing selected, and one
  // selects the locked emitter.
  { name: 'cpuparticles3d-instanced-unselected', file: 'unit-gizmo-instance.tscn', gizmos: true },
  {
    name: 'cpuparticles3d-instanced-selected',
    file: 'unit-gizmo-instance.tscn',
    gizmos: true,
    select: 'Root/Locked/Emitter',
  },
  // The box gizmos of the types whose Godot editor gizmo is a box volume. VisibleOnScreenNotifier3D and
  // its Enabler draw the box, the axes and a faint fill. ReflectionProbe draws the blend box, the lines
  // to the outer box and the origin cross. VoxelGI draws the box and its cell grid. FogVolume draws the box.
  {
    name: 'visibleonscreennotifier3d-selected',
    file: 'unit-visibleonscreennotifier3d-gizmo.tscn',
    gizmos: true,
    select: 'Root/Notifier',
  },
  {
    name: 'visibleonscreenenabler3d-selected',
    file: 'unit-visibleonscreenenabler3d-gizmo.tscn',
    gizmos: true,
    select: 'Root/Enabler',
  },
  { name: 'reflectionprobe-selected', file: 'unit-reflectionprobe-gizmo.tscn', gizmos: true, select: 'Root/Probe' },
  { name: 'voxelgi-selected', file: 'unit-voxelgi-gizmo.tscn', gizmos: true, select: 'Root/Voxels' },
  { name: 'fogvolume-selected', file: 'unit-fogvolume-gizmo.tscn', gizmos: true, select: 'Root/Fog' },

  // Lights, Camera3D and AudioStreamPlayer3D gizmos. Unselected: the render
  // with ground and shading only, no helper.
  { name: 'directional-light-3d', file: 'unit-directional-light-3d.tscn' },
  { name: 'omni-light-3d', file: 'unit-omni-light-3d.tscn' },
  { name: 'spot-light-3d', file: 'unit-spot-light-3d.tscn' },
  { name: 'camera-basic', file: 'unit-camera-basic.tscn' },
  { name: 'audio-stream-player-3d', file: 'unit-audio-stream-player.tscn' },
  // Selected: the real tree-click → selection → gizmo render for each gate.
  // Thin helper wireframes are AA-sensitive.
  {
    name: 'directional-light-3d-selected',
    file: 'unit-directional-light-3d.tscn',
    gizmos: true,
    select: 'Root/DirectionalLight3D',
  },
  {
    name: 'omni-light-3d-selected',
    file: 'unit-omni-light-3d.tscn',
    gizmos: true,
    select: 'Root/OmniLight3D',
  },
  {
    name: 'spot-light-3d-selected',
    file: 'unit-spot-light-3d.tscn',
    gizmos: true,
    select: 'Root/SpotLight3D',
  },
  // The Camera3D gizmo is Godot's pyramid or box, drawn for every camera (`camera_3d_gizmo_plugin.cpp:258`).
  // unit-multi-camera.tscn (not unit-camera-basic.tscn): a red box sits in-frustum for depth
  // reference. The selected golden draws MainCamera in full beside three faint cameras, and the
  // unselected one draws all four faint.
  {
    name: 'camera3d-selected',
    file: 'unit-multi-camera.tscn',
    gizmos: true,
    select: 'Root/MainCamera',
  },
  { name: 'camera3d-unselected', file: 'unit-multi-camera.tscn', gizmos: true },
  // The Decal gizmo is Godot's box with vertical stubs and a tick (`decal_gizmo_plugin.cpp:92-128`),
  // drawn for every decal. The selected golden draws one decal in full beside a faint one.
  { name: 'decal-selected', file: 'unit-decal.tscn', gizmos: true, select: 'Scene/Decal_Albedo' },
  { name: 'decal-unselected', file: 'unit-decal.tscn', gizmos: true },
  {
    name: 'audio-stream-player-3d-selected',
    file: 'unit-audio-stream-player.tscn',
    gizmos: true,
    select: 'Scene/Speaker_Default',
  },
  // The emission cone: `Speaker_Cone` is the only corpus node that sets
  // `emission_angle_enabled`.
  {
    name: 'audio-stream-player-3d-cone-selected',
    file: 'unit-audio-stream-player.tscn',
    gizmos: true,
    select: 'Scene/Speaker_Cone',
  },
  // The node icons: Godot's billboard icon at the origin of a light, a camera, both particle emitters
  // and an audio player. The tinted lights show the light colour, and the selected spot light shows an
  // icon at full colour beside the dimmed rest.
  { name: 'node-icons', file: 'unit-node-icons.tscn', gizmos: true },
  { name: 'node-icons-selected', file: 'unit-node-icons.tscn', gizmos: true, select: 'Root/Spot' },
];
