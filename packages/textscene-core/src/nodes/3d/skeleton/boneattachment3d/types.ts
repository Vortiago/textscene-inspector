import type { Node3DProperties } from '../../../base/node3d/types';

export interface AttachmentSettings {
  boneName: string;
  boneIdx: number;
  overridePose: boolean;
  useExternalSkeleton: boolean;
  externalSkeleton?: string;
}

export type AttachmentWrite =
  | {
      [K in keyof Required<AttachmentSettings>]: { key: K; value: Required<AttachmentSettings>[K] };
    }[keyof AttachmentSettings]
  | { key: 'transform' };

export interface AttachmentLayer {
  writes: readonly AttachmentWrite[];
  beforeParenting: boolean;
  writerScene?: string;
  line: number;
}

export interface BoneAttachment3DProperties extends Node3DProperties, AttachmentSettings {
  bindingOverrides?: {
    base: AttachmentSettings;
    layers: readonly AttachmentLayer[];
  };
}
