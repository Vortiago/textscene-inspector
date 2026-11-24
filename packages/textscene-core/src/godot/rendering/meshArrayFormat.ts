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
