/**
 * Godot's normal map read: red and green only, with blue rebuilt as `sqrt(max(0, 1 - dot(xy, xy)))`
 * (`scene_forward_clustered.glsl:1437-1438`), since an RGTC import stores no blue. three rebuilds
 * blue the same way under `USE_PACKED_NORMALMAP`, which it defines itself only for an RG format.
 */

import { defining, type ProgramInjection } from '../materialProgramInputs';

export const GODOT_NORMAL_MAP_READ: ProgramInjection = defining('USE_PACKED_NORMALMAP');
