/**
 * BoneAttachment3D sits on a bone of the Skeleton3D that is its parent, or of the one the
 * `external_skeleton` path names (`bone_attachment_3d.cpp:128-142`), and its children move with
 * the bone. The seat pass answers where (ADR-0060), and the poses a clip pushes on the skeleton
 * move the node in place.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { BoneAttachment3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'BoneAttachment3D',
  Component: BoneAttachment3D,
  renderIntent: 'transform-only',
  scenePass: true,
});
