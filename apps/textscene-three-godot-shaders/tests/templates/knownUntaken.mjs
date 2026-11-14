/**
 * The branches of Godot's templates that no variant Godot compiles takes, each with its cause. The
 * template check fails on an untaken branch this list does not hold, and on an entry no longer
 * untaken. A key is the stage's file and stage, then the branch's `file:line`.
 */

const UNUSED_FILE = 'no C++ of Godot compiles giprobe_write.glsl, and glslang refuses each mode of it';
const MOBILE_ONLY = 'only the mobile renderer defines EXPLICIT_FP16 (scene_shader_forward_mobile.cpp:593)';
const NO_CLIP_ALPHA = 'no C++ of Godot defines ENABLE_CLIP_ALPHA, and glslang refuses it on a vec3 albedo';
const DOUBLE_PRECISION =
  'USE_DOUBLE_PRECISION is a build option, and glslang refuses the mobile vertex stage with it and no material';
const MOBILE_TRANSMITTANCE =
  "glslang refuses the mobile light_compute call with transmittance and no material's light code";

const entries = (stage, cause, branches) => branches.map((branch) => [`${stage}: ${branch}`, cause]);
const CLUSTERED = 'forward_clustered/scene_forward_clustered.glsl fragment';
const MOBILE_VERTEX = 'forward_mobile/scene_forward_mobile.glsl vertex';
const MOBILE_FRAGMENT = 'forward_mobile/scene_forward_mobile.glsl fragment';

export const KNOWN_UNTAKEN = new Map([
  [
    'environment/sdfgi_debug_probes.glsl vertex: environment/sdfgi_debug_probes.glsl:5',
    'the #ifdef comes before #VERSION_DEFINES, so no mode reaches it',
  ],
  [
    'environment/sdfgi_integrate.glsl compute: environment/sdfgi_integrate.glsl:149',
    'the C++ always defines SH_SIZE as 16 (gi.h:560)',
  ],
  ...entries(CLUSTERED, MOBILE_ONLY, ['half_inc.glsl:10', 'scene_forward_lights_inc.glsl:18']),
  ...entries(CLUSTERED, NO_CLIP_ALPHA, [
    'forward_clustered/scene_forward_clustered.glsl:1465',
    'forward_clustered/scene_forward_clustered.glsl:1466',
    'forward_clustered/scene_forward_clustered.glsl:1475',
  ]),
  ...entries(MOBILE_VERTEX, DOUBLE_PRECISION, [
    'scene_data_inc.glsl:21',
    'forward_mobile/scene_forward_mobile_inc.glsl:344',
    'forward_mobile/scene_forward_mobile.glsl:175',
    'forward_mobile/scene_forward_mobile.glsl:258',
    'forward_mobile/scene_forward_mobile.glsl:446',
    'forward_mobile/scene_forward_mobile.glsl:732',
    'forward_mobile/scene_forward_mobile.glsl:794',
  ]),
  ...entries(MOBILE_FRAGMENT, NO_CLIP_ALPHA, [
    'forward_mobile/scene_forward_mobile.glsl:1438',
    'forward_mobile/scene_forward_mobile.glsl:1439',
    'forward_mobile/scene_forward_mobile.glsl:1448',
  ]),
  ...entries(MOBILE_FRAGMENT, MOBILE_TRANSMITTANCE, [
    'forward_mobile/scene_forward_mobile.glsl:985',
    'forward_mobile/scene_forward_mobile.glsl:1347',
    'scene_forward_lights_inc.glsl:138',
  ]),
  ...entries('giprobe_write.glsl compute', UNUSED_FILE, [
    'giprobe_write.glsl:36',
    'giprobe_write.glsl:81',
    'giprobe_write.glsl:197',
    'giprobe_write.glsl:251',
    'giprobe_write.glsl:271',
  ]),
]);
