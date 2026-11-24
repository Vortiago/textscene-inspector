/** `RenderingServer::ArrayFormat` flags (`rendering_server.h:311-345`). */
export const ARRAY_FORMAT_VERTEX = 1 << 0;
export const ARRAY_FORMAT_NORMAL = 1 << 1;
export const ARRAY_FORMAT_TANGENT = 1 << 2;
export const ARRAY_FORMAT_COLOR = 1 << 3;
export const ARRAY_FORMAT_TEX_UV = 1 << 4;
export const ARRAY_FORMAT_TEX_UV2 = 1 << 5;
/** `ARRAY_FORMAT_CUSTOM0`: CUSTOM1 to CUSTOM3 follow it (`rendering_server.h:319`). */
export const ARRAY_FORMAT_CUSTOM0 = 1 << 6;
export const ARRAY_FORMAT_BONES = 1 << 10;
export const ARRAY_FORMAT_WEIGHTS = 1 << 11;
/** Each custom array's format is 3 bits from bit 13, CUSTOM0 first (`rendering_server.h:329-335`). */
export const ARRAY_FORMAT_CUSTOM_BASE = 13;
export const ARRAY_FORMAT_CUSTOM_BITS = 3;
export const ARRAY_FORMAT_CUSTOM_MASK = 0x7;
/** Eight bones and weights for each vertex, not four (`rendering_server.h:341`). */
export const ARRAY_FLAG_USE_8_BONE_WEIGHTS = 1 << 27;
/** Positions are 2×float32, not 3 (`rendering_server.h:339`). */
export const ARRAY_FLAG_USE_2D_VERTICES = 1 << 25;
/** Quantised attributes. `&` reads only bits below 32, so `surfaceVersion.ts` reads the version first. */
export const ARRAY_FLAG_COMPRESS_ATTRIBUTES = 1 << 29;

/** `RenderingServer::ArrayCustomFormat` (`rendering_server.h:299-308`). */
export const ArrayCustomFormat = {
  RGBA8_UNORM: 0,
  RGBA8_SNORM: 1,
  RG_HALF: 2,
  RGBA_HALF: 3,
  R_FLOAT: 4,
  RG_FLOAT: 5,
  RGB_FLOAT: 6,
  RGBA_FLOAT: 7,
} as const;

/** `RenderingServer::ARRAY_CUSTOM_COUNT` (`rendering_server.h:296`). */
export const ARRAY_CUSTOM_COUNT = 4;

/** The lanes of each custom format and the bytes of one lane (`rendering_server.cpp:1102-1132`). */
export const CUSTOM_FORMAT_LANES: readonly { lanes: number; laneBytes: number }[] = [
  { lanes: 4, laneBytes: 1 },
  { lanes: 4, laneBytes: 1 },
  { lanes: 2, laneBytes: 2 },
  { lanes: 4, laneBytes: 2 },
  { lanes: 1, laneBytes: 4 },
  { lanes: 2, laneBytes: 4 },
  { lanes: 3, laneBytes: 4 },
  { lanes: 4, laneBytes: 4 },
];
