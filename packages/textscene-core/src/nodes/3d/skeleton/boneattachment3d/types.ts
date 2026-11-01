/** BoneAttachment3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface BoneAttachment3DProperties extends Node3DProperties {
  /**
   * The `bone_name` the loader stores, as the plain text of its literal. The seat reads it only
   * while `bone_idx` sits below 0 (`bone_attachment_3d.cpp:113-126`).
   */
  boneName: string;
  /**
   * The `bone_idx` the loader stores, kept even where `bone_name` names no bone: the properties
   * land before the node takes its parent and its seat runs (`bone_attachment_3d.cpp:113-126`).
   */
  boneIdx: number;
  /**
   * Whether Godot leaves the node at its own transform and pushes that onto the bone instead
   * (`bone_attachment_3d.cpp:313-317`).
   */
  overridePose: boolean;
  /** Whether the skeleton comes from `external_skeleton` rather than the parent (`:128-142`). */
  useExternalSkeleton: boolean;
  /**
   * The `external_skeleton` literal as the file wrote it (`NodePath("../Skeleton3D")`), or
   * undefined when the file leaves the key out. An empty `NodePath("")` carries no path.
   */
  externalSkeleton?: string;
}
