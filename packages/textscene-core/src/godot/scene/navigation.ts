/** Godot 4.6.3's navigation facts a scene's properties carry. */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';

/**
 * `NavigationPathQueryParameters2D::PathfindingAlgorithm`
 * (`servers/navigation_2d/navigation_path_query_parameters_2d.h:43-45`). It has one member.
 */
const PathfindingAlgorithm = {
  ASTAR: 0,
} as const;

/** Each pathfinding algorithm by its integer, spelled as its constant. */
export const NAVIGATION_2D_PATHFINDING_ALGORITHM_NAMES = relabelEnumNames(
  enumNamesByValue(PathfindingAlgorithm),
  (name) => `PATHFINDING_ALGORITHM_${name}`
);

/** `NavigationPathQueryParameters2D::PathPostProcessing` (`navigation_path_query_parameters_2d.h:47-51`). */
const PathPostProcessing = {
  CORRIDORFUNNEL: 0,
  EDGECENTERED: 1,
  NONE: 2,
} as const;

/** Each post-processing by its integer, spelled as its constant. */
export const NAVIGATION_2D_PATH_POSTPROCESSING_NAMES = relabelEnumNames(
  enumNamesByValue(PathPostProcessing),
  (name) => `PATH_POSTPROCESSING_${name}`
);

/**
 * `NavigationPathQueryParameters2D::PathMetadataFlags` (`navigation_path_query_parameters_2d.h:53-59`).
 * `INCLUDE_NONE` is 0 and `INCLUDE_ALL` is the OR of the three bits, so neither is a bit.
 */
const PathMetadataFlag = {
  INCLUDE_TYPES: 1,
  INCLUDE_RIDS: 2,
  INCLUDE_OWNERS: 4,
} as const;

/** Each path metadata bit by its value, spelled as its constant. */
export const NAVIGATION_2D_PATH_METADATA_FLAG_NAMES = relabelEnumNames(
  enumNamesByValue(PathMetadataFlag),
  (name) => `PATH_METADATA_${name}`
);

/**
 * `NavigationPathQueryParameters3D::PathfindingAlgorithm`
 * (`servers/navigation_3d/navigation_path_query_parameters_3d.h:43-45`). It has one member.
 */
const PathfindingAlgorithm3D = {
  ASTAR: 0,
} as const;

/** Each pathfinding algorithm by its integer, spelled as its constant. */
export const NAVIGATION_3D_PATHFINDING_ALGORITHM_NAMES = relabelEnumNames(
  enumNamesByValue(PathfindingAlgorithm3D),
  (name) => `PATHFINDING_ALGORITHM_${name}`
);

/** `NavigationPathQueryParameters3D::PathPostProcessing` (`navigation_path_query_parameters_3d.h:47-51`). */
const PathPostProcessing3D = {
  CORRIDORFUNNEL: 0,
  EDGECENTERED: 1,
  NONE: 2,
} as const;

/** Each post-processing by its integer, spelled as its constant. */
export const NAVIGATION_3D_PATH_POSTPROCESSING_NAMES = relabelEnumNames(
  enumNamesByValue(PathPostProcessing3D),
  (name) => `PATH_POSTPROCESSING_${name}`
);

/**
 * `NavigationPathQueryParameters3D::PathMetadataFlags` (`navigation_path_query_parameters_3d.h:53-59`).
 * `INCLUDE_NONE` is 0 and `INCLUDE_ALL` is the OR of the three bits, so neither is a bit.
 */
const PathMetadataFlag3D = {
  INCLUDE_TYPES: 1,
  INCLUDE_RIDS: 2,
  INCLUDE_OWNERS: 4,
} as const;

/** Each path metadata bit by its value, spelled as its constant. */
export const NAVIGATION_3D_PATH_METADATA_FLAG_NAMES = relabelEnumNames(
  enumNamesByValue(PathMetadataFlag3D),
  (name) => `PATH_METADATA_${name}`
);
