import { FogMode, renderedDepthFogRange } from '../../godot/rendering/environment/depthFog.js';
import type { Binding } from '../uniforms/bindingTable.js';
import { fogLightColor } from '../pipeline/environmentFog.js';
import type { SpatialFrame } from './spatialBindings.js';

/** `SCENE_DATA_FLAGS_USE_FOG` (`scene_data_inc.glsl:10`). */
export const USE_FOG = 1 << 4;

/** `use_depth_fog` in the first packed specialisation constant (`scene_forward_clustered_inc.glsl:101`). */
const USE_DEPTH_FOG = 1 << 6;

const DATA = 'scene_data_block.data';

const depthRangeOf = ({ fog, camera }: SpatialFrame) =>
  renderedDepthFogRange({ begin: fog?.depthBegin ?? 0, end: fog?.depthEnd ?? 0 }, camera.far);

/** Each fog member of `SceneData`. */
export const FOG_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${DATA}.fog_density`,
    godot: 'render_scene_data_rd.cpp:209',
    value: ({ fog }) => fog?.density ?? 0,
  },
  {
    uniform: `${DATA}.fog_height`,
    godot: 'render_scene_data_rd.cpp:210',
    value: ({ fog }) => fog?.height ?? 0,
  },
  {
    uniform: `${DATA}.fog_height_density`,
    godot: 'render_scene_data_rd.cpp:211',
    value: ({ fog }) => fog?.heightDensity ?? 0,
  },
  // The scene template binds no sky radiance yet, which the aerial perspective reads.
  { uniform: `${DATA}.fog_aerial_perspective`, godot: 'render_scene_data_rd.cpp:212', value: () => 0 },
  {
    uniform: `${DATA}.fog_depth_curve`,
    godot: 'render_scene_data_rd.cpp:214',
    value: ({ fog }) => fog?.depthCurve ?? 0,
  },
  {
    uniform: `${DATA}.fog_depth_end`,
    godot: 'render_scene_data_rd.cpp:215',
    value: (frame) => depthRangeOf(frame).end,
  },
  {
    uniform: `${DATA}.fog_depth_begin`,
    godot: 'render_scene_data_rd.cpp:216',
    value: (frame) => depthRangeOf(frame).begin,
  },
  {
    uniform: `${DATA}.fog_light_color`,
    godot: 'render_scene_data_rd.cpp:218-223',
    value: ({ fog }) => fogLightColor(fog),
  },
  {
    uniform: `${DATA}.fog_sun_scatter`,
    godot: 'render_scene_data_rd.cpp:225',
    value: ({ fog }) => fog?.sunScatter ?? 0,
  },
];

/** The depth fog's specialisation constant, one program for each mode. */
export const FOG_SPECIALISATIONS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: 'pso_sc_packed_0',
    godot: 'render_forward_clustered.cpp:2084',
    value: ({ fog }) => (fog?.mode === FogMode.DEPTH ? USE_DEPTH_FOG : 0),
  },
];
