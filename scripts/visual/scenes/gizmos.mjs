/**
 * Gizmos, both halves of each pair: the unselected render that shows no helper,
 * and the selected one that does.
 */

export const GIZMO_SCENES = [
  // Selection-gated gizmos (ADR-0018): select the node, capture the gizmo. These
  // pin the real tree-click → selection → gizmo path for every gizmo node type.
  // Thin AA gizmo lines and the selection box are AA-sensitive.
  { name: 'marker2d-selected', file: 'unit-marker2d.tscn', select: 'Marker2DRoot/DefaultMarker', maxDiffPct: 0.5, mode: '2d' },
  { name: 'path2d-selected', file: 'unit-path2d.tscn', select: 'Path2DRoot/ArcPath', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pathfollow2d-selected', file: 'unit-pathfollow2d.tscn', select: 'PathFollow2DRoot/TrackPath/Follower', maxDiffPct: 0.5, mode: '2d' },
  { name: 'marker3d-selected', file: 'unit-marker-3d.tscn', select: 'Root/MyMarker3D', maxDiffPct: 0.5 },
  { name: 'path3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath', maxDiffPct: 0.5 },
  { name: 'pathfollow3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath/Follower', maxDiffPct: 0.5 },
  // The VehicleWheel3D gizmo: radius circle, spring coil, travel line, axle
  // ticks and forward arrow. No unselected companion: with the gizmo hidden this
  // scene renders like any other transform-only body fixture.
  { name: 'vehiclewheel3d-selected', file: 'unit-physics-vehicle.tscn', select: 'Root/Vehicle/Wheel1', maxDiffPct: 0.5 },

  // Lights, Camera3D and AudioStreamPlayer3D gizmos. Unselected: the render
  // with ground and shading only, no helper.
  { name: 'directional-light-3d', file: 'unit-directional-light-3d.tscn' },
  { name: 'omni-light-3d', file: 'unit-omni-light-3d.tscn' },
  { name: 'spot-light-3d', file: 'unit-spot-light-3d.tscn', maxDiffPct: 0.5 },
  { name: 'camera-basic', file: 'unit-camera-basic.tscn' },
  { name: 'audio-stream-player-3d', file: 'unit-audio-stream-player.tscn' },
  // Selected: the real tree-click → selection → gizmo render for each gate.
  // Thin helper wireframes are AA-sensitive.
  {
    name: 'directional-light-3d-selected',
    file: 'unit-directional-light-3d.tscn',
    select: 'Root/DirectionalLight3D',
    maxDiffPct: 0.5,
  },
  {
    name: 'omni-light-3d-selected',
    file: 'unit-omni-light-3d.tscn',
    select: 'Root/OmniLight3D',
    maxDiffPct: 0.5,
  },
  {
    name: 'spot-light-3d-selected',
    file: 'unit-spot-light-3d.tscn',
    select: 'Root/SpotLight3D',
    maxDiffPct: 0.5,
  },
  // unit-multi-camera.tscn (not unit-camera-basic.tscn): a red box sits
  // in-frustum for depth reference alongside the selected CameraHelper.
  {
    name: 'camera3d-selected',
    file: 'unit-multi-camera.tscn',
    select: 'Root/MainCamera',
    maxDiffPct: 0.5,
  },
  {
    name: 'audio-stream-player-3d-selected',
    file: 'unit-audio-stream-player.tscn',
    select: 'Scene/Speaker_Default',
    maxDiffPct: 0.5,
  },
  // The emission cone: `Speaker_Cone` is the only corpus node that sets
  // `emission_angle_enabled`.
  {
    name: 'audio-stream-player-3d-cone-selected',
    file: 'unit-audio-stream-player.tscn',
    select: 'Scene/Speaker_Cone',
    maxDiffPct: 0.5,
  },
];
