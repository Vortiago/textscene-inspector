/** Godot 4.6.3's VoxelGI facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `VoxelGI::Subdiv` (`scene/3d/voxel_gi.h:101-108`), `SUBDIV_MAX` left out. */
const Subdiv = {
  SUBDIV_64: 0,
  SUBDIV_128: 1,
  SUBDIV_256: 2,
  SUBDIV_512: 3,
} as const;

/** Each subdivision by its integer, spelled as its constant (`voxel_gi.cpp:575-578`). */
export const VOXEL_GI_SUBDIV_NAMES = enumNamesByValue(Subdiv);
