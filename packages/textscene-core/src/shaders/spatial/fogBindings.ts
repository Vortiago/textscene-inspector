import { renderedDepthFogRange } from '../../godot/rendering/environment/depthFog.js';
import type { Binding } from '../uniforms/bindingTable.js';
import { fogLightColor } from '../pipeline/environmentFog.js';
import type { SpatialFrame } from './spatialBindings.js';
import { SCENE_DATA } from './sceneDataBlock.js';

const depthRangeOf = ({ fog, camera }: SpatialFrame) =>
  renderedDepthFogRange({ begin: fog?.depthBegin ?? 0, end: fog?.depthEnd ?? 0 }, camera.far);

/** Each fog member of `SceneData`. */
export const FOG_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${SCENE_DATA}.fog_density`,
    godot: 'render_scene_data_rd.cpp:209',
    value: ({ fog }) => fog?.density ?? 0,
  },
  {
    uniform: `${SCENE_DATA}.fog_height`,
    godot: 'render_scene_data_rd.cpp:210',
    value: ({ fog }) => fog?.height ?? 0,
  },
  {
    uniform: `${SCENE_DATA}.fog_height_density`,
    godot: 'render_scene_data_rd.cpp:211',
    value: ({ fog }) => fog?.heightDensity ?? 0,
  },
  {
    uniform: `${SCENE_DATA}.fog_aerial_perspective`,
    godot: 'render_scene_data_rd.cpp:212',
    value: ({ fog }) => fog?.aerialPerspective ?? 0,
  },
  {
    uniform: `${SCENE_DATA}.fog_depth_curve`,
    godot: 'render_scene_data_rd.cpp:214',
    value: ({ fog }) => fog?.depthCurve ?? 0,
  },
  {
    uniform: `${SCENE_DATA}.fog_depth_end`,
    godot: 'render_scene_data_rd.cpp:215',
    value: (frame) => depthRangeOf(frame).end,
  },
  {
    uniform: `${SCENE_DATA}.fog_depth_begin`,
    godot: 'render_scene_data_rd.cpp:216',
    value: (frame) => depthRangeOf(frame).begin,
  },
  {
    uniform: `${SCENE_DATA}.fog_light_color`,
    godot: 'render_scene_data_rd.cpp:218-223',
    value: ({ fog }) => fogLightColor(fog),
  },
  {
    uniform: `${SCENE_DATA}.fog_sun_scatter`,
    godot: 'render_scene_data_rd.cpp:225',
    value: ({ fog }) => fog?.sunScatter ?? 0,
  },
];
