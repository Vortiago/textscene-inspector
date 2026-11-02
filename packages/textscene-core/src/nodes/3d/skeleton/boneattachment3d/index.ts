/**
 * BoneAttachment3D registration: the parser. The five own properties reach the parse; the seat
 * they drive lives in `boneAttachmentSeats.ts`, and index.r3f.ts registers the seat component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseBoneAttachment3D } from './parser';

const boneAttachment3DRegistration: NodeTypeRegistration = {
  typeName: 'BoneAttachment3D',
  parser: parseBoneAttachment3D,
};

nodeRegistry.register(boneAttachment3DRegistration);

export * from './parser';
export * from './types';
